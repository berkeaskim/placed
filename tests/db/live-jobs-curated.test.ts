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
  it("hides curated cards while the employer has a live job of the same kind", async () => {
    const wd = mk("workday", "barclays", "barclays");
    const cur = mk("curated", "barclays", "barclays");
    const live = addJob(wd.id, "Spring Insight Programme", { employment_type: "spring_week" });
    addJob(cur.id, "Spring Week", { opens_on: "2026-12-01", employment_type: "spring_week" });
    expect((await getLiveJobs(TODAY)).map((j) => j.title)).toEqual(["Spring Insight Programme"]);

    db.update(jobs).set({ is_live: false }).where(eq(jobs.id, live.id)).run();
    const out = await getLiveJobs(TODAY);
    expect(out.map((j) => j.title)).toEqual(["Spring Week"]);
    expect(out[0]).toMatchObject({ curated: true, opensOn: "2026-12-01" });
  });

  it("a live summer internship does not hide the same employer's spring week card", async () => {
    const wd = mk("workday", "citi", "citi");
    const cur = mk("curated", "citi", "citi");
    addJob(wd.id, "Citi Summer Analyst", { employment_type: "internship" });
    addJob(cur.id, "Citi Spring Week", { employment_type: "spring_week" });
    addJob(cur.id, "Citi Summer Internship", { employment_type: "internship" });
    const titles = (await getLiveJobs(TODAY)).map((j) => j.title);
    expect(titles).toContain("Citi Spring Week");
    expect(titles).not.toContain("Citi Summer Internship");
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
    addJob(wd.id, "HSBC Spring Insight", { employment_type: "spring_week" });
    addJob(cur.id, "HSBC Spring Week", { employment_type: "spring_week" });
    const deps = {
      fetchJobs: async () => { throw new Error("network down"); },
      tagJob: async () => { throw new Error("unused"); },
      store: sqliteStore(),
    };
    await expect(ingestCompany(wd as unknown as CompanyRow, deps as never)).rejects.toThrow(/network down/);
    const titles = (await getLiveJobs(TODAY)).map((j) => j.title);
    expect(titles).toContain("HSBC Spring Insight");
    expect(titles).not.toContain("HSBC Spring Week");
  });
});

describe("multi-employer listings (TargetJobs)", () => {
  const tj = () => db.insert(companies).values({ slug: "placement", name: "TargetJobs", ats: "targetjobs" }).returning().get();
  it("shows the posting's employer, via the board", async () => {
    const t = tj();
    addJob(t.id, "Year Out Placement", { employer_name: "Willmott Dixon", url: "https://willmottdixon.co.uk/careers/1" });
    const j = (await getLiveJobs(TODAY)).find((x) => x.title === "Year Out Placement")!;
    expect(j).toMatchObject({ company: "Willmott Dixon", via: "TargetJobs" });
  });
  it("hides a listing the employer's own board already has (same link, or same employer and title)", async () => {
    const wd = db.insert(companies).values({ slug: "lbg/undergraduate_careers", name: "Lloyds Banking Group", ats: "workday", api_host: "lbg.wd3.myworkdayjobs.com" }).returning().get();
    const t = db.select().from(companies).where(eq(companies.ats, "targetjobs")).get()!;
    addJob(wd.id, "Risk Industrial Placement (Leeds)", { url: "https://lbg.wd3.myworkdayjobs.com/en-US/undergraduate_careers/job/Leeds/Risk_1" });
    addJob(wd.id, "Software Engineering Industrial Placement (Bristol)", { url: "https://lbg.wd3.myworkdayjobs.com/en-US/undergraduate_careers/job/Bristol/SE_2" });
    addJob(t.id, "Risk Industrial Placement (Leeds)", { employer_name: "Lloyds Banking Group", url: "https://lbg.wd3.myworkdayjobs.com/en-US/undergraduate_careers/job/Leeds/Risk_1?utm_source=targetjobs" });
    addJob(t.id, "Software Engineering Industrial Placement (Bristol)", { employer_name: "Lloyds Banking Group", url: "https://targetjobs.co.uk/jobs/lbg-se-2" });
    addJob(t.id, "Data Industrial Placement (Leeds)", { employer_name: "Lloyds Banking Group", url: "https://targetjobs.co.uk/jobs/lbg-data-3" });
    const out = (await getLiveJobs(TODAY)).filter((j) => j.company === "Lloyds Banking Group");
    expect(out.map((j) => `${j.title}|${j.via ?? "direct"}`).sort()).toEqual([
      "Data Industrial Placement (Leeds)|TargetJobs",
      "Risk Industrial Placement (Leeds)|direct",
      "Software Engineering Industrial Placement (Bristol)|direct",
    ]);
  });
});
