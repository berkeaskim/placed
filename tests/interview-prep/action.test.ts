import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { db } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { applications, interviewPreps, jobs } from "@/lib/db/schema";
import { DAILY_CAP } from "@/lib/interview-prep/service";
import { seedJob, U, withTempDb } from "../gamify/temp-db";

const generatePrepPack = vi.fn();
const mockJob = vi.hoisted(() => ({ employmentType: "internship" }));
vi.mock("@/lib/db/queries", () => ({
  getJob: async () => ({ id: "j", title: "Summer Analyst", company: "Goldman Sachs", archetype: "investment_banking", employmentType: mockJob.employmentType, textLines: ["x"], extId: "e" }),
  getActiveCv: async () => null,
}));
vi.mock("@/lib/ai/interviewPrep", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/interviewPrep")>();
  return { ...actual, generatePrepPack, mapStories: vi.fn().mockResolvedValue([]) };
});

const { getInterviewPrep } = await import("@/app/(app)/jobs/[id]/prep-actions");

let ID = "";
withTempDb(() => {
  db.delete(interviewPreps).run();
  db.delete(applications).run();
  ID = seedJob();
});
const track = (status: "saved" | "applied" | "interview") => db.insert(applications).values({ user_id: U, job_id: ID, status }).run();

describe("getInterviewPrep", () => {
  // A provider key makes aiMode() "live", so the shared cache and the daily cap are in play (fixture mode skips both).
  const savedKey = process.env.GEMINI_API_KEY;
  const savedMode = process.env.AI_MODE;
  beforeEach(() => { process.env.GEMINI_API_KEY = "test"; delete process.env.AI_MODE; });
  afterEach(() => {
    if (savedKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = savedKey;
    if (savedMode === undefined) delete process.env.AI_MODE; else process.env.AI_MODE = savedMode;
  });
  beforeEach(() => { generatePrepPack.mockReset().mockResolvedValue({ pack: { process: [], questions: [], tips: [] }, sources: [], grounded: false }); });

  it("refuses an untracked or saved job without generating", async () => {
    expect(await getInterviewPrep(ID)).toEqual({ error: expect.stringContaining("applied") });
    track("saved");
    expect(await getInterviewPrep(ID)).toEqual({ error: expect.stringContaining("applied") });
    expect(generatePrepPack).not.toHaveBeenCalled();
  });

  it("generates for an applied job, caches it, and serves the cache next time", async () => {
    track("interview");
    const r = await getInterviewPrep(ID);
    expect(r).toMatchObject({ cached: false, stories: [] });
    expect(generatePrepPack).toHaveBeenCalledWith(expect.objectContaining({ company: "Goldman Sachs", roleKey: "investment_banking:internship" }));
    expect(db.select().from(interviewPreps).all()).toMatchObject([{ role_key: "investment_banking:internship", created_by: U, grounded: false }]);
    expect(await getInterviewPrep(ID)).toMatchObject({ cached: true });
    expect(generatePrepPack).toHaveBeenCalledTimes(1);
  });

  it("refuses to generate past the daily cap", async () => {
    track("applied");
    for (let i = 0; i < DAILY_CAP; i++) {
      const { company_id } = db.select({ company_id: jobs.company_id }).from(jobs).where(eq(jobs.id, seedJob({}, `Co${i}`))).get()!;
      db.insert(interviewPreps).values({ company_id, role_key: "x", pack: {}, grounded: false, model_id: "m", created_by: U }).run();
    }
    expect(await getInterviewPrep(ID)).toEqual({ error: expect.stringContaining(String(DAILY_CAP)) });
    expect(generatePrepPack).not.toHaveBeenCalled();
  });

  it("never builds or caches a generic pack for a spring week: those have their own prep", async () => {
    track("applied");
    mockJob.employmentType = "spring_week";
    try {
      expect(await getInterviewPrep(ID)).toEqual({ error: expect.stringContaining("Spring weeks") });
      expect(generatePrepPack).not.toHaveBeenCalled();
      expect(db.select().from(interviewPreps).all()).toEqual([]);
    } finally {
      mockJob.employmentType = "internship";
    }
  });

  it("rejects a non-uuid", async () => {
    expect(await getInterviewPrep("1; drop")).toEqual({ error: expect.any(String) });
  });
});
