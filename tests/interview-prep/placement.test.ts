import { describe, expect, it, vi } from "vitest";
import { LOCAL_USER_ID } from "@/lib/auth/local-user";
import { insertEntry } from "@/lib/bank/store";
import { buildStructurePrompt } from "@/lib/ai/interviewPrep";
import { bansAiInInterviews } from "@/lib/interview-prep/ai-ban";
import {
  PLACEMENT_GROUPS, PLACEMENT_QUESTIONS, placementContext, placementPracticeSet, placementPrepNote, placementQuestions, streamFor,
} from "@/lib/interview-prep/placement-bank";
import { withTempDb } from "../cv/temp-db";

vi.mock("server-only", () => ({}));
const { placementPrep } = await import("@/lib/interview-prep/placement");

withTempDb();

describe("placement question bank", () => {
  it("has 40 questions with unique ids, every group used, one technical per stream", () => {
    expect(PLACEMENT_QUESTIONS.map((q) => q.id)).toEqual(Array.from({ length: 40 }, (_, i) => i + 1));
    for (const g of PLACEMENT_GROUPS) expect(PLACEMENT_QUESTIONS.some((q) => q.group === g.key)).toBe(true);
    const streams = PLACEMENT_QUESTIONS.filter((q) => q.group === "technical").map((q) => q.stream);
    expect(new Set(streams).size).toBe(7);
    expect(PLACEMENT_QUESTIONS.every((q) => q.whyTheyAsk && q.prepTip)).toBe(true);
  });
});

describe("streamFor", () => {
  it("reads the title first, then the archetype, then the text", () => {
    expect(streamFor({ title: "Audit Placement 2027", archetype: "finance_banking" })).toBe("audit_tax");
    expect(streamFor({ title: "Industrial Placement", archetype: "software_eng" })).toBe("software");
    expect(streamFor({ title: "Industrial Placement", archetype: null, textLines: ["Join our formulation laboratory"] })).toBe("pharma_chemistry");
    expect(streamFor({ title: "Placement", archetype: null, textLines: [] })).toBeNull();
  });
});

describe("placementQuestions and practice", () => {
  it("fills the firm and keeps only this stream's technical", () => {
    const qs = placementQuestions(placementContext({ company: "Arup", title: "Civil Engineering Placement", archetype: null }));
    expect(qs).toHaveLength(34);
    expect(qs.filter((q) => q.group === "technical").map((q) => q.id)).toEqual([33]);
    expect(qs.find((q) => q.id === 5)!.text).toBe("Why Arup? Why this site or location?");
    expect(qs.some((q) => /\{firm\}/.test(q.text + q.whyTheyAsk + q.prepTip))).toBe(false);
    expect(placementQuestions(placementContext({ company: "X", title: "Placement", archetype: null }))).toHaveLength(40);
  });
  it("pages through different practice runs", () => {
    const c = placementContext({ company: "Arup", title: "Placement", archetype: null });
    const a = placementPracticeSet(c, { seed: 0 }).map((q) => q.id);
    const b = placementPracticeSet(c, { seed: 1 }).map((q) => q.id);
    expect(a).toHaveLength(5);
    expect(a).not.toEqual(b);
  });
  it("adds a programme note to the AI pack prompt for placements only", () => {
    const input = { company: "Arup", jobTitle: "Placement", roleKey: "research:placement", jdText: "About" };
    expect(buildStructurePrompt({ ...input, track: "placement" }, null, [])).toContain(placementPrepNote("placement")!);
    expect(buildStructurePrompt(input, null, [])).not.toContain("PROGRAMME:");
  });
});

describe("placementPrep", () => {
  const job = (over: Partial<Parameters<typeof placementPrep>[1]> = {}) =>
    ({ employmentType: "placement", company: "Arup", title: "Civil Engineering Placement", archetype: null, textLines: [], ...over }) as Parameters<typeof placementPrep>[1];
  it("is null for anything but a placement", () => {
    expect(placementPrep(LOCAL_USER_ID, job({ employmentType: "internship" }))).toBeNull();
    expect(placementPrep(LOCAL_USER_ID, job({ employmentType: "spring_week" }))).toBeNull();
  });
  it("matches STAR stories from the Experience Bank and flags AI-ban employers", () => {
    expect(placementPrep(LOCAL_USER_ID, job())).toMatchObject({ bankEmpty: true, stories: [], coachOnly: null });
    insertEntry(LOCAL_USER_ID, {
      section: "projects", org: "UCL", title: "Bridge design group project", dates: "2026", startYm: "2026-01", endYm: "2026-04", location: "",
      pinned: false, hidden: false, sourceIds: [],
      bullets: [{ text: "Worked with a team of 4 to deliver the design 2 days early", position: 0, pinned: false, hidden: false, sourceIds: [], sourceText: null }],
    });
    const p = placementPrep(LOCAL_USER_ID, job())!;
    expect(p.bankEmpty).toBe(false);
    expect(p.stories.length).toBeGreaterThan(0);
    expect(placementPrep(LOCAL_USER_ID, job({ company: "Bank of England" }))!.coachOnly).toContain("Bank of England doesn't allow AI tools");
  });
});

describe("bansAiInInterviews", () => {
  it("reads the curated policy, the advert and the research list", () => {
    expect(bansAiInInterviews("Goldman Sachs", "")).toBe(true);
    expect(bansAiInInterviews("Acme", "AI tools are not permitted during the video interview.")).toBe(true);
    expect(bansAiInInterviews("Barclays UK", "")).toBe(true);
    expect(bansAiInInterviews("Acme", "")).toBe(false);
  });
});
