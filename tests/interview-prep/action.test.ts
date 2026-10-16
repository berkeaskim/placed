import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

let appStatus: string | null = "saved";
let countResult: { count: number | null; error: { message: string } | null } = { count: 0, error: null };
const generatePrepPack = vi.fn();
const table = (name: string) => {
  const q: Record<string, unknown> = {};
  q.select = () => q; q.eq = () => q; q.gte = () => q;
  q.maybeSingle = async () => ({ data: name === "applications" ? (appStatus ? { status: appStatus } : null) : name === "jobs" ? { company_id: 7 } : null, error: null });
  return q;
};
vi.mock("@/lib/supabase/server", () => ({ requireUser: async () => ({ supabase: { from: table }, user: { id: "user-1" } }) }));
vi.mock("@/lib/db/queries", () => ({
  getJob: async () => ({ id: "j", title: "Summer Analyst", company: "Goldman Sachs", archetype: "investment_banking", employmentType: "internship", textLines: ["x"], extId: "e" }),
  getActiveCv: async () => null,
}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ from: () => ({ select: () => ({ eq: () => ({ gte: async () => countResult }) }), upsert: async () => ({ error: null }) }) }) }));
vi.mock("@/lib/ai/interviewPrep", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/ai/interviewPrep")>();
  return { ...actual, generatePrepPack, mapStories: vi.fn().mockResolvedValue([]) };
});

const { getInterviewPrep } = await import("@/app/(app)/jobs/[id]/prep-actions");
const ID = "0b6f2b1e-3c1a-4c55-9d7e-2f7a1c9b8e01";

describe("getInterviewPrep", () => {
  // A provider key makes aiMode() "live", so the shared cache and the daily cap are in play (fixture mode skips both).
  const savedKey = process.env.GEMINI_API_KEY;
  beforeEach(() => { process.env.GEMINI_API_KEY = "test"; });
  afterEach(() => { if (savedKey === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = savedKey; });
  beforeEach(() => { generatePrepPack.mockReset().mockResolvedValue({ pack: { process: [], questions: [], tips: [] }, sources: [], grounded: false }); });

  it("refuses a saved or untracked job without generating", async () => {
    appStatus = "saved";
    expect(await getInterviewPrep(ID)).toEqual({ error: expect.stringContaining("applied") });
    appStatus = null;
    expect(await getInterviewPrep(ID)).toEqual({ error: expect.stringContaining("applied") });
    expect(generatePrepPack).not.toHaveBeenCalled();
  });

  it("generates for an applied job, with no CV meaning no stories", async () => {
    appStatus = "interview";
    const r = await getInterviewPrep(ID);
    expect(r).toMatchObject({ cached: false, stories: [] });
    expect(generatePrepPack).toHaveBeenCalledWith(expect.objectContaining({ company: "Goldman Sachs", roleKey: "investment_banking:internship" }));
  });

  it("refuses to generate when the daily count cannot be read (e.g. table not migrated yet)", async () => {
    appStatus = "applied";
    countResult = { count: null, error: { message: "Could not find the table 'public.interview_preps'" } };
    expect(await getInterviewPrep(ID)).toEqual({ error: expect.any(String) });
    expect(generatePrepPack).not.toHaveBeenCalled();
    countResult = { count: 0, error: null };
  });

  it("rejects a non-uuid", async () => {
    expect(await getInterviewPrep("1; drop")).toEqual({ error: expect.any(String) });
  });
});
