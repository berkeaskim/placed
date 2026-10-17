import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, resetDbForTests } from "@/lib/db/client";
import { companies, jobs } from "@/lib/db/schema";
import { getLiveJobs } from "@/lib/db/queries";
import { ingestCompany, type CompanyRow } from "@/lib/ingest/run";
import { sqliteStore } from "@/lib/ingest/store";

let dir: string;
const prevDir = process.env.PLACED_DATA_DIR;
beforeAll(() => {
  dir = mkdtempSync(path.join(tmpdir(), "placed-curated-"));
  process.env.PLACED_DATA_DIR = dir;
  resetDbForTests();
});
afterAll(() => {
  resetDbForTests();
  process.env.PLACED_DATA_DIR = prevDir;
  rmSync(dir, { recursive: true, force: true });
});

const TODAY = "2026-10-17";
const mk = (ats: "workday" | "curated", slug: string, employer: string) =>
  db.insert(companies).values({ slug, name: "Barclays", ats, employer, api_host: ats === "workday" ? "x.wd3.myworkdayjobs.com" : null }).returning().get();
const addJob = (company_id: number, title: string, over: Record<string, unknown> = {}) =>
  db.insert(jobs).values({ company_id, ext_id: crypto.randomUUID(), title, url: "https://x", ...over }).returning().get();

describe("curated overlap hiding in getLiveJobs", () => {
  it("hides curated cards while the employer has a live job", async () => {
    const wd = mk("workday", "barclays", "barclays");
    const cur = mk("curated", "barclays", "barclays");
    const live = addJob(wd.id, "Summer Analyst");
    addJob(cur.id, "Spring Week", { opens_on: "2026-12-01" });
    expect((await getLiveJobs(TODAY)).map((j) => j.title)).toEqual(["Summer Analyst"]);

    db.update(jobs).set({ is_live: false }).where(eq(jobs.id, live.id)).run();
    const out = await getLiveJobs(TODAY);
    expect(out.map((j) => j.title)).toEqual(["Spring Week"]);
    expect(out[0]).toMatchObject({ curated: true, opensOn: "2026-12-01" });
  });

  it("does not hide curated cards of a different employer", async () => {
    const wd = mk("workday", "other", "other-bank");
    const cur = mk("curated", "lonely", "lonely");
    addJob(wd.id, "Other Analyst");
    addJob(cur.id, "Lonely Graduate Programme");
    const titles = (await getLiveJobs(TODAY)).map((j) => j.title);
    expect(titles).toContain("Lonely Graduate Programme");
  });

  it("keeps curated hidden when the live board errored this run", async () => {
    const wd = mk("workday", "hsbc", "hsbc");
    const cur = mk("curated", "hsbc", "hsbc");
    addJob(wd.id, "HSBC Analyst");
    addJob(cur.id, "HSBC Spring Week");
    const deps = {
      fetchJobs: async () => { throw new Error("network down"); },
      tagJob: async () => { throw new Error("unused"); },
      store: sqliteStore(),
    };
    await expect(ingestCompany(wd as unknown as CompanyRow, deps as never)).rejects.toThrow(/network down/);
    const titles = (await getLiveJobs(TODAY)).map((j) => j.title);
    expect(titles).toContain("HSBC Analyst");
    expect(titles).not.toContain("HSBC Spring Week");
  });
});
