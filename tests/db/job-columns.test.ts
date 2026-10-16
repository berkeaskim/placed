import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db, resetDbForTests } from "@/lib/db/client";
import { companies, cvs, jobs, profiles, type NewJob } from "@/lib/db/schema";
import { getActiveCv, getJob, getLiveJobs, getProfile } from "@/lib/db/queries";

let dir: string;
const prevDir = process.env.PLACED_DATA_DIR;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "placed-jobs-"));
  process.env.PLACED_DATA_DIR = dir;
  resetDbForTests();
});
afterAll(() => {
  resetDbForTests();
  process.env.PLACED_DATA_DIR = prevDir;
  rmSync(dir, { recursive: true, force: true });
});

const TODAY = "2026-10-16";
let companyId: number;
const job = (over: Partial<NewJob>) =>
  db.insert(jobs).values({ company_id: companyId, ext_id: crypto.randomUUID(), title: "Analyst", url: "https://x", ...over }).returning().get();

describe("job queries on SQLite", () => {
  beforeAll(() => {
    companyId = db.insert(companies).values({ slug: "acme", name: "Acme", ats: "lever" }).returning().get().id;
  });

  it("getLiveJobs: live, open (deadline today counts), newest first with undated last, id as tiebreak", async () => {
    const a = job({ title: "A", posted_at: "2026-10-01T09:00:00+00:00" });
    const b = job({ title: "B", posted_at: "2026-10-10T09:00:00+00:00", deadline: TODAY, rolling: true });
    const c = job({ title: "C", posted_at: null });
    job({ title: "closed", deadline: "2026-10-15" });
    job({ title: "dead", is_live: false });
    const live = await getLiveJobs(TODAY);
    expect(live.map((j) => j.title)).toEqual(["B", "A", "C"]);
    expect(live[0]).toMatchObject({ id: b.id, company: "Acme", rolling: true, deadline: TODAY, extId: b.ext_id, cohortClash: false });
    expect(live[1]).toMatchObject({ id: a.id, rolling: false, yearEligibility: [], requirements: [], textLines: [] });
    expect(live[2].id).toBe(c.id);
  });

  it("getLiveJobs rejects a non-date `today`", async () => {
    await expect(getLiveJobs("2026-10-16' or 1=1 --")).rejects.toThrow(/YYYY-MM-DD/);
  });

  it("getJob returns any job by id (live or not), null when missing", async () => {
    const d = job({ title: "Gone", is_live: false, text_lines: ["## About"] });
    expect(await getJob(d.id)).toMatchObject({ title: "Gone", company: "Acme", textLines: ["## About"] });
    expect(await getJob(crypto.randomUUID())).toBeNull();
  });

  it("getActiveCv / getProfile", async () => {
    expect(await getActiveCv("u1")).toBeNull();
    await expect(getProfile("u1")).rejects.toThrow(/not found/);
    db.insert(profiles).values({ user_id: "u1", skills: ["SQL"] }).run();
    expect(await getProfile("u1")).toMatchObject({ user_id: "u1", skills: ["SQL"], needs_visa: false });
    const cv = db.insert(cvs).values({ user_id: "u1", storage_path: "u1/cv.pdf", file_size: 1, page_count: 1, raw_text: "hi", parsed_json: { name: "S" } as never })
      .returning().get();
    expect(await getActiveCv("u1")).toEqual({ id: cv.id, parsed: { name: "S" }, rawText: "hi" });
  });
});
