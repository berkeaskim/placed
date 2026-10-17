import { describe, it, expect, vi } from "vitest";
import { ingestCompany, jobContentHash, type IngestStore, type JobRow } from "@/lib/ingest/run";
import type { RawJob } from "@/lib/types";
import { heuristicTagJob } from "@/lib/ai/heuristics";

const company = { id: 1, slug: "acme", name: "Acme", ats: "lever" as const, api_host: null, enabled: true, employer: null, transport: null };
const raw = (over: Partial<RawJob>): RawJob => ({
  extId: "1", title: "Data Analyst Intern", url: "https://jobs.lever.co/acme/1?utm_source=x", location: "London",
  remote: false, html: "<h3>Requirements</h3><ul><li>SQL</li></ul>", postedAt: null, ...over,
});

function fakeStore(existing = new Map<string, { content_hash: string | null; tag_status: string }>(), emptyRuns = 0) {
  const upserted: JobRow[] = [];
  const state = { emptyRuns };
  const store: IngestStore = {
    existing: async () => existing,
    upsert: async (rows) => { upserted.push(...rows); },
    touch: vi.fn(async () => {}),
    markDead: vi.fn(async () => 2),
    emptyRuns: async () => state.emptyRuns,
    setEmptyRuns: vi.fn(async (_id: number, n: number) => { state.emptyRuns = n; }),
  };
  return { store, upserted, state };
}

describe("ingestCompany", () => {
  it("filters non-early-career and non-UK jobs, keeps and flags cohort clashes, tags and upserts the rest", async () => {
    const { store, upserted } = fakeStore();
    const tag = vi.fn(async (i: { title: string; textLines: string[] }) => heuristicTagJob(i));
    const r = await ingestCompany(company, {
      fetchJobs: async () => [
        raw({ extId: "1" }),
        raw({ extId: "2", title: "Senior Data Engineer" }),
        raw({ extId: "3", location: "San Francisco, CA" }),
        raw({ extId: "4", title: "SWE Intern (Winter 2027)" }),
      ],
      tagJob: tag, store,
    });
    expect(r.fetched).toBe(4);
    expect(r.kept).toBe(2);
    expect(tag).toHaveBeenCalledTimes(2);
    expect(upserted[0].url).toBe("https://jobs.lever.co/acme/1");
    expect(upserted[0].requirements[0].skill).toBe("SQL");
    expect(store.markDead).toHaveBeenCalledWith(1, ["1", "4"]);
    expect(upserted.find((u) => u.ext_id === "4")?.cohort_clash).toBe(true);
    expect(upserted.find((u) => u.ext_id === "1")?.cohort_clash).toBe(false);
  });

  it("does not re-tag unchanged jobs that were tagged ok", async () => {
    const { htmlToLines } = await import("@/lib/text/jd");
    const job = raw({});
    const hash = jobContentHash(job, htmlToLines(job.html).join("\n"));
    const { store } = fakeStore(new Map([["1", { content_hash: hash, tag_status: "ok" }]]));
    const tag = vi.fn();
    const r = await ingestCompany(company, { fetchJobs: async () => [job], tagJob: tag as never, store });
    expect(tag).not.toHaveBeenCalled();
    expect(store.touch).toHaveBeenCalledWith(1, ["1"]);
    expect(r.tagged).toBe(0);
  });

  it("does not mark jobs dead when the fetch fails", async () => {
    const { store } = fakeStore();
    await expect(ingestCompany(company, { fetchJobs: async () => { throw new Error("HTTP 500"); }, tagJob: vi.fn() as never, store })).rejects.toThrow();
    expect(store.markDead).not.toHaveBeenCalled();
  });

  it("holds the board's live jobs open on the first empty listing", async () => {
    const { store, state } = fakeStore();
    const r = await ingestCompany(company, { fetchJobs: async () => [], tagJob: vi.fn() as never, store });
    expect(store.markDead).not.toHaveBeenCalled();
    expect(state.emptyRuns).toBe(1);
    expect(r).toMatchObject({ fetched: 0, kept: 0, dead: 0, heldEmpty: true });
  });

  it("closes the board's jobs once the listing is empty on a second consecutive run", async () => {
    const { store, state } = fakeStore();
    const deps = { fetchJobs: async () => [], tagJob: vi.fn() as never, store };
    await ingestCompany(company, deps);
    const r = await ingestCompany(company, deps);
    expect(store.markDead).toHaveBeenCalledTimes(1);
    expect(store.markDead).toHaveBeenCalledWith(1, []);
    expect(state.emptyRuns).toBe(2);
    expect(r).toMatchObject({ dead: 2, heldEmpty: false });
  });

  it("a non-empty listing resets the empty streak, so empty-full-empty never closes anything", async () => {
    const { store, state } = fakeStore();
    const empty = { fetchJobs: async () => [], tagJob: vi.fn() as never, store };
    await ingestCompany(company, empty);
    await ingestCompany(company, { fetchJobs: async () => [raw({})], tagJob: async (i) => heuristicTagJob(i), store });
    expect(state.emptyRuns).toBe(0);
    vi.mocked(store.markDead).mockClear();
    await ingestCompany(company, empty);
    expect(store.markDead).not.toHaveBeenCalled();
    expect(state.emptyRuns).toBe(1);
  });

  it("does not hold when postings came back but none passed the filters", async () => {
    const { store, state } = fakeStore();
    const r = await ingestCompany(company, { fetchJobs: async () => [raw({ title: "Senior Data Engineer" })], tagJob: vi.fn() as never, store });
    expect(store.markDead).toHaveBeenCalledWith(1, []);
    expect(state.emptyRuns).toBe(0);
    expect(r.heldEmpty).toBe(false);
  });

  it("does not touch the empty streak when nothing changed", async () => {
    const { store } = fakeStore();
    await ingestCompany(company, { fetchJobs: async () => [raw({})], tagJob: async (i) => heuristicTagJob(i), store });
    expect(store.setEmptyRuns).not.toHaveBeenCalled();
  });

  it("stores deterministic deadlines with provenance and ignores the tagger's deadline", async () => {
    const { store, upserted } = fakeStore();
    await ingestCompany(company, {
      fetchJobs: async () => [
        raw({ extId: "1", deadline: "2026-11-01", postedAt: "2026-10-01T00:00:00Z", html: "<p>Closing date: 31 October 2026</p>" }),
        raw({ extId: "2", postedAt: "2026-10-01T00:00:00Z", html: "<p>Closing date: 5 December 2026. We recruit on a rolling basis.</p>" }),
        raw({ extId: "3", postedAt: "2026-10-01T00:00:00Z", html: "<p>No dates here.</p>" }),
      ],
      tagJob: async (i) => ({ ...heuristicTagJob(i), deadline: "2030-01-01" }), store,
    });
    const by = (id: string) => upserted.find((r) => r.ext_id === id)!;
    expect(by("1")).toMatchObject({ deadline: "2026-10-31", deadline_source: "ats", rolling: false, closed_at: null });
    expect(by("2")).toMatchObject({ deadline: "2026-12-05", deadline_source: "text", rolling: true });
    expect(by("3")).toMatchObject({ deadline: null, deadline_source: null, rolling: false });
  });

  it("re-processes an unchanged JD when the ATS deadline moves", async () => {
    const { htmlToLines } = await import("@/lib/text/jd");
    const job = raw({ deadline: "2026-11-01" });
    const old = jobContentHash({ ...job, deadline: "2026-10-20" }, htmlToLines(job.html).join("\n"));
    const { store, upserted } = fakeStore(new Map([["1", { content_hash: old, tag_status: "ok" }]]));
    await ingestCompany(company, { fetchJobs: async () => [job], tagJob: async (i) => heuristicTagJob(i), store });
    expect(upserted).toHaveLength(1);
    expect(upserted[0].deadline).toBe("2026-10-31");
  });

  it("stores opensOn as opens_on", async () => {
    const { store, upserted } = fakeStore();
    await ingestCompany(company, {
      fetchJobs: async () => [raw({ extId: "1", opensOn: "2026-09-01" }), raw({ extId: "2" })],
      tagJob: async (i) => heuristicTagJob(i), store,
    });
    expect(upserted.find((r) => r.ext_id === "1")?.opens_on).toBe("2026-09-01");
    expect(upserted.find((r) => r.ext_id === "2")?.opens_on).toBeNull();
  });

  it("passes employer and transport to fetchJobs and re-processes when opensOn changes", async () => {
    const { htmlToLines } = await import("@/lib/text/jd");
    const job = raw({ opensOn: "2026-09-01" });
    const old = jobContentHash({ ...job, opensOn: "2026-08-01" }, htmlToLines(job.html).join("\n"));
    const { store, upserted } = fakeStore(new Map([["1", { content_hash: old, tag_status: "ok" }]]));
    const fetchJobs = vi.fn(async () => [job]);
    await ingestCompany({ ...company, employer: "acme-corp", transport: "stealth" }, { fetchJobs, tagJob: async (i) => heuristicTagJob(i), store });
    expect(fetchJobs).toHaveBeenCalledWith(expect.objectContaining({ employer: "acme-corp", transport: "stealth" }));
    expect(upserted).toHaveLength(1);
  });

  it("curated cards keep closes exactly: no ATS minus-one shift and no date pulled from the description", async () => {
    const { store, upserted } = fakeStore();
    const curated = { ...company, slug: "morganstanley", ats: "curated" as const };
    await ingestCompany(curated, {
      fetchJobs: async () => [
        raw({ extId: "c1", title: "Summer Analyst Programme", deadline: "2026-11-01", html: "<p>Closing date: 31 October 2026. Each programme closes on a rolling basis.</p>" }),
        raw({ extId: "c2", title: "Summer Analyst Programme", deadline: null, html: "<p>Each programme has its own deadline, the earliest falling on 19 October 2026. Closing date: 19 October 2026.</p>" }),
      ],
      tagJob: async (i) => heuristicTagJob(i), store, now: () => new Date("2026-10-17T08:00:00Z"),
    });
    const by = (id: string) => upserted.find((r) => r.ext_id === id)!;
    expect(by("c1")).toMatchObject({ deadline: "2026-11-01", deadline_source: "ats", rolling: true });
    expect(by("c2")).toMatchObject({ deadline: null, deadline_source: null });
  });

  it("jobContentHash is unchanged from before opensOn existed for jobs without opensOn", async () => {
    const { contentHash } = await import("@/lib/ingest/fingerprint");
    const j = { title: "Data Analyst Intern", deadline: "2026-11-01" };
    // Pre-branch formula: no opensOn segment at all. Changing it would re-tag every stored job on the next ingest.
    expect(jobContentHash(j, "text")).toBe(contentHash(`v2\nData Analyst Intern\n2026-11-01\ntext`));
    expect(jobContentHash({ ...j, opensOn: null }, "text")).toBe(contentHash(`v2\nData Analyst Intern\n2026-11-01\ntext`));
    expect(jobContentHash({ ...j, opensOn: "2026-09-01" }, "text")).not.toBe(jobContentHash(j, "text"));
  });
});
