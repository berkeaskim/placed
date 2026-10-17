import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, resetDbForTests } from "@/lib/db/client";
import { companies, ingestState, jobs } from "@/lib/db/schema";
import { heuristicTagJob } from "@/lib/ai/heuristics";
import { IngestBusyError, ingestRunning, lastIngestAt, lastIngestSummary, runIngest } from "@/lib/ingest/local";
import { getSetting, setSetting } from "@/lib/settings/store";
import { sqliteStore } from "@/lib/ingest/store";
import type { RawJob } from "@/lib/types";

let dir: string;
const prev = { dir: process.env.PLACED_DATA_DIR, mode: process.env.AI_MODE };
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "placed-ingest-"));
  process.env.PLACED_DATA_DIR = dir;
  process.env.AI_MODE = "fixture";
  resetDbForTests();
  db.insert(companies).values([
    { slug: "acme", name: "Acme", ats: "lever" },
    { slug: "boom", name: "Boom", ats: "greenhouse" },
    { slug: "off", name: "Off", ats: "lever", enabled: false },
  ]).run();
});
afterAll(() => {
  resetDbForTests();
  process.env.PLACED_DATA_DIR = prev.dir;
  if (prev.mode === undefined) delete process.env.AI_MODE;
  else process.env.AI_MODE = prev.mode;
  rmSync(dir, { recursive: true, force: true });
});

const raw = (extId: string, over: Partial<RawJob> = {}): RawJob => ({
  extId, title: "Data Analyst Intern", url: `https://jobs.example/${extId}`, location: "London", remote: false,
  html: "<h3>Requirements</h3><ul><li>SQL</li></ul>", postedAt: "2026-10-01T00:00:00.000Z", ...over,
});
const tagJob = vi.fn(async (i: { title: string; textLines: string[] }) => heuristicTagJob(i));
let feed: Record<string, RawJob[] | Error>;
const fetchJobs = async (c: { slug: string }) => {
  const r = feed[c.slug] ?? [];
  if (r instanceof Error) throw r;
  return r;
};
const acmeId = () => db.select().from(companies).where(eq(companies.slug, "acme")).get()!.id;
const acmeJobs = () => db.select().from(jobs).where(eq(jobs.company_id, acmeId())).all();

beforeEach(() => { tagJob.mockClear(); });
afterEach(() => { setSetting("ingest.lock", null); });

describe("sqliteStore", () => {
  it("upserts on (company_id, ext_id) keeping id and first_seen, touches and marks dead", async () => {
    const store = sqliteStore();
    const id = acmeId();
    const row = (ext: string, title: string) => ({
      company_id: id, ext_id: ext, title, url: "https://x", location: "London", remote: false, deadline: null, deadline_source: null, rolling: false,
      closed_at: null, posted_at: null, opens_on: null, archetype: "data_analytics", field_tags: [], year_eligibility: ["2nd"], sponsors_visa: "unknown",
      employment_type: "internship", first_year_friendly: false, cohort_clash: false, requirements: [], skills: ["SQL"], summary: "", raw_html: "",
      text_lines: ["x"], fingerprint: "f", content_hash: "h1", tag_status: "ok" as const, is_live: true, last_seen: "2026-10-01T00:00:00.000Z",
    });
    await store.upsert([row("s1", "First"), row("s2", "Second")]);
    const before = db.select().from(jobs).where(eq(jobs.ext_id, "s1")).get()!;
    await store.upsert([{ ...row("s1", "Renamed"), content_hash: "h2" }]);
    const after = db.select().from(jobs).where(eq(jobs.ext_id, "s1")).get()!;
    expect(after).toMatchObject({ id: before.id, first_seen: before.first_seen, title: "Renamed", content_hash: "h2", year_eligibility: ["2nd"] });
    expect((await store.existing(id)).get("s2")).toEqual({ content_hash: "h1", tag_status: "ok" });

    expect(await store.markDead(id, ["s1"])).toBe(1);
    expect(db.select().from(jobs).where(eq(jobs.ext_id, "s2")).get()).toMatchObject({ is_live: false });
    await store.touch(id, ["s2"]);
    expect(db.select().from(jobs).where(eq(jobs.ext_id, "s2")).get()).toMatchObject({ is_live: true, closed_at: null });
    expect(await store.markDead(id, [])).toBe(2);
    db.delete(jobs).run();
  });
});

describe("runIngest", () => {
  it("ingests enabled companies, continues past failures, counts new jobs and records the run", async () => {
    feed = { acme: [raw("1"), raw("2"), raw("3", { title: "Senior Engineer" })], boom: new Error("ATS 500"), off: [raw("9")] };
    const progress: { done: number; total: number; slug: string; error: boolean }[] = [];
    const s = await runIngest({ fetchJobs, tagJob, onProgress: ({ done, total, slug, error }) => progress.push({ done, total, slug, error }) });
    expect(s).toMatchObject({ companies: 2, failed: 1, kept: 2, newJobs: 2, dead: 0, aiTagging: false });
    expect(progress.map((p) => p.done)).toEqual([1, 2]);
    expect(progress.map(({ slug, error, total }) => ({ slug, error, total })).sort((a, b) => a.slug.localeCompare(b.slug)))
      .toEqual([{ slug: "acme", error: false, total: 2 }, { slug: "boom", error: true, total: 2 }]);
    expect(lastIngestAt()).toBe(s.finishedAt);
    expect(db.select().from(ingestState).get()?.cursor).toBe(0);
    expect(getSetting("ingest.lock")).toBeNull();
    expect(lastIngestSummary()).toEqual(s);

    // no live AI: stored heuristically as pending so a later run with an AI re-tags them
    expect(tagJob).not.toHaveBeenCalled();
    expect(acmeJobs().map((j) => j.tag_status)).toEqual(["pending", "pending"]);
  });

  it("a second run finds nothing new and closes postings that disappeared", async () => {
    feed = { acme: [raw("1")] };
    const s = await runIngest({ fetchJobs, tagJob });
    expect(s).toMatchObject({ newJobs: 0, dead: 1, kept: 1 });
    expect(acmeJobs().filter((j) => j.is_live).map((j) => j.ext_id)).toEqual(["1"]);
  });

  it("filters by ATS", async () => {
    feed = { acme: [raw("1")], boom: [raw("b1")] };
    const before = lastIngestAt();
    const s = await runIngest({ ats: "greenhouse", fetchJobs, tagJob });
    expect(s).toMatchObject({ companies: 1, failed: 0, newJobs: 1 });
    expect(lastIngestAt()).toBe(before); // a one-ATS run isn't a full refresh
  });

  it("an offline run (every company failed) isn't recorded as an update", async () => {
    const before = lastIngestAt();
    feed = { acme: new Error("ENOTFOUND"), boom: new Error("ENOTFOUND") };
    expect(await runIngest({ fetchJobs, tagJob })).toMatchObject({ companies: 2, failed: 2 });
    expect(lastIngestAt()).toBe(before);
  });

  it("refuses to start while another live run holds the lock; a stale lock is taken over", async () => {
    setSetting("ingest.lock", JSON.stringify({ pid: process.pid, at: Date.now(), token: "other" }));
    expect(ingestRunning()).toBe(true);
    await expect(runIngest({ fetchJobs, tagJob })).rejects.toBeInstanceOf(IngestBusyError);
    setSetting("ingest.lock", JSON.stringify({ pid: 2 ** 22 + 12345, at: Date.now(), token: "dead" }));
    expect(ingestRunning()).toBe(false);
    feed = {};
    await expect(runIngest({ fetchJobs, tagJob })).resolves.toMatchObject({ companies: 2 });
    expect(getSetting("ingest.lock")).toBeNull();
    setSetting("ingest.lock", JSON.stringify({ pid: process.pid, at: Date.now() - 3 * 3_600_000, token: "old" }));
    expect(ingestRunning()).toBe(false);
  });

  it("two concurrent runs: the second is refused", async () => {
    let release!: () => void;
    feed = {};
    const slow = async () => { await new Promise<void>((r) => { release = r; }); return []; };
    const first = runIngest({ fetchJobs: slow, tagJob, concurrency: 1 });
    await vi.waitFor(() => expect(release).toBeTypeOf("function"));
    await expect(runIngest({ fetchJobs, tagJob })).rejects.toBeInstanceOf(IngestBusyError);
    release();
    await vi.waitFor(() => { release(); expect(ingestRunning()).toBe(false); });
    await first;
  });
});
