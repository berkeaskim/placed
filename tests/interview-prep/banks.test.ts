import { describe, expect, it } from "vitest";
import { buildStructurePrompt } from "@/lib/ai/interviewPrep";
import { bansAiInInterviews, PLACEMENT_BANK, streamFor, trackBank, trackPrepNote } from "@/lib/interview-prep/banks";

describe("placement question bank", () => {
  it("has 40 distinct questions and one technical per stream", () => {
    expect(PLACEMENT_BANK).toHaveLength(40);
    expect(new Set(PLACEMENT_BANK.map((q) => q.question)).size).toBe(40);
    const streams = PLACEMENT_BANK.filter((q) => q.theme === "technical").map((q) => q.stream);
    expect(new Set(streams).size).toBe(streams.length);
    expect(streams).toHaveLength(7);
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

describe("trackBank", () => {
  it("is placement-only: spring weeks have their own panel", () => {
    expect(trackBank({ track: "standard", company: "Acme", title: "Intern", archetype: null })).toBeNull();
    expect(trackBank({ track: "spring", company: "HSBC", title: "Spring Insight", archetype: null })).toBeNull();
  });
  it("fills the firm and filters technicals to the job's stream", () => {
    const b = trackBank({ track: "placement", company: "Arup", title: "Civil Engineering Placement", archetype: null })!;
    expect(b.stream).toBe("engineering");
    expect(b.questions.filter((q) => q.theme === "technical").map((q) => q.stream)).toEqual(["engineering"]);
    expect(b.questions).toHaveLength(34);
    expect(b.questions.some((q) => q.question.includes("[firm]"))).toBe(false);
    expect(b.questions.find((q) => q.question.startsWith("Why Arup?"))).toBeDefined();
    expect(b.coachOnly).toBe(false);
    expect(b.practiceNotice).toMatch(/^Practice only/);
    expect(trackBank({ track: "placement", company: "X", title: "Placement", archetype: null })!.questions).toHaveLength(40);
  });
  it("is coach-only at employers that ban AI in interviews", () => {
    expect(trackBank({ track: "placement", company: "Bank of England", title: "Economics Placement", archetype: null })!.coachOnly).toBe(true);
    expect(trackBank({ track: "placement", company: "Goldman Sachs", title: "Placement", archetype: null })!.practiceNotice).toContain("doesn't allow AI tools");
    expect(bansAiInInterviews("Acme", "AI tools are not permitted during the video interview.")).toBe(true);
    expect(bansAiInInterviews("Barclays UK", "")).toBe(true);
    expect(bansAiInInterviews("Acme", "")).toBe(false);
  });
});

describe("trackPrepNote", () => {
  it("adds a programme line to the AI pack's prompt for placements only", () => {
    const input = { company: "Arup", jobTitle: "Placement", roleKey: "research:placement", jdText: "About" };
    expect(buildStructurePrompt({ ...input, track: "placement" }, null, [])).toContain(trackPrepNote("placement")!);
    expect(buildStructurePrompt(input, null, [])).not.toContain("PROGRAMME:");
    expect(trackPrepNote("spring")).toBeNull();
  });
});

