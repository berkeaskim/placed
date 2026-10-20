import { describe, expect, it } from "vitest";
import { nextQuestion } from "@/lib/cover-letter/questions";
import { lintLetter } from "@/lib/cover-letter/rules";
import { firmHooks, MIN_FIRM_HOOKS, needsHook, trackLetterBlock, trackLintHits } from "@/lib/cover-letter/track";
import type { Answer, Fact } from "@/lib/cover-letter/types";

const NOW = new Date("2026-10-20T12:00:00Z");
const fact = (id: string, date: string | null, claim = "Advised on the £2bn Thames Water refinancing"): Fact => ({ id, claim, url: `https://x.com/${id}`, publisher: "FT", date });
const ans = (question: Answer["question"], text: string | null = "text", extra: Partial<Answer> = {}): Answer => ({ id: question, question, text, ...extra });

describe("firmHooks", () => {
  it("counts dated picked facts and the student's own firm touchpoints", () => {
    const facts = [fact("f1", "2026-08"), fact("f2", null), fact("f3", "2024-01"), fact("f4", "2026-09")];
    const answers = [ans("facts", null, { pickedFactIds: ["f1", "f2", "f3"] }), ans("touchpoint", "Met Priya at the UCL careers fair")];
    const h = firmHooks({ facts, answers, now: NOW });
    // f1 dated and recent; f2 undated; f3 too old; f4 not picked.
    expect(h.sources).toEqual(["fact:f1", "answer:touchpoint"]);
    expect(h.count).toBe(2);
  });
  it("counts a why-firm answer only when it names a person or event", () => {
    expect(firmHooks({ facts: [], answers: [ans("why_firm", "Their culture seems great")], now: NOW }).count).toBe(0);
    expect(firmHooks({ facts: [], answers: [ans("why_firm", "I spoke to an analyst at their insight day")], now: NOW }).count).toBe(1);
  });
  it("needsHook is spring/placement only and stops once the hook question is answered or skipped", () => {
    expect(needsHook("standard", 0, [])).toBe(false);
    expect(needsHook("spring", MIN_FIRM_HOOKS - 1, [])).toBe(true);
    expect(needsHook("placement", MIN_FIRM_HOOKS, [])).toBe(false);
    expect(needsHook("spring", 0, [ans("hook", null)])).toBe(false);
  });
});

describe("nextQuestion on spring and placement tracks", () => {
  const base = { researchState: "done" as const, facts: [], storyEntry: { id: "e0", label: "Tesco" }, archetype: null, hasTouchpointAnswer: false, company: "Barclays" };
  it("asks for one more firm hook before the story on a spring job", () => {
    const q = nextQuestion({ ...base, answers: [ans("why_firm", "I like markets")], track: "spring", hooks: 1 });
    expect(q).toMatchObject({ id: "hook" });
    expect((q as { text: string }).text).toContain("I only have 1 thing that Barclays alone could say");
  });
  it("never asks the hook question on the standard track", () => {
    expect(nextQuestion({ ...base, answers: [ans("why_firm", "x")], hooks: 0 })).toMatchObject({ id: "story" });
  });
  it("walks the placement slots after the firm questions", () => {
    const a: Answer[] = [ans("why_firm", "x"), ans("hook", "x")];
    expect(nextQuestion({ ...base, answers: a, track: "placement", hooks: 2 })).toMatchObject({ id: "why_placement" });
    a.push(ans("why_placement"));
    expect(nextQuestion({ ...base, answers: a, track: "placement", hooks: 2 })).toMatchObject({ id: "bring_back" });
    a.push(ans("bring_back"));
    expect(nextQuestion({ ...base, answers: a, track: "placement", hooks: 2 })).toMatchObject({ id: "story" });
  });
});

describe("trackLintHits", () => {
  const o = (track: "spring" | "placement" | "standard", pickedFacts: Fact[] = []) => ({ track, company: "Barclays", role: "Spring Insight Programme", rivals: ["HSBC"], pickedFacts });
  const ids = (text: string, opts: ReturnType<typeof o>) => trackLintHits(text, opts).map((h) => h.ruleId);

  it("flags a firm sentence that would read the same for a rival", () => {
    const text = "I want to join Barclays because it is a great place to learn.";
    const hits = trackLintHits(text, o("spring"));
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ ruleId: "CL-80", label: "Would read the same for HSBC: add something only true of Barclays" });
    expect(text.slice(hits[0].start, hits[0].end)).toBe(text);
  });
  it("passes a firm sentence with a number, a named thing or a picked-fact word", () => {
    expect(ids("Barclays opened its Glasgow campus to 5,000 staff.", o("spring"))).toEqual([]);
    expect(ids("I was struck by how Barclays Eagle Labs backs early founders.", o("spring"))).toEqual([]);
    expect(ids("Reading about Barclays and the refinancing made me curious.", o("spring", [fact("f1", "2026-08")]))).toEqual([]);
  });
  it("flags spring clichés and placement clichés on their own tracks only", () => {
    expect(ids("I hope to learn from the best in a fast-paced environment.", o("spring"))).toEqual(["CL-81", "CL-81"]);
    expect(ids("I hope to learn from the best.", o("placement"))).toEqual([]);
    expect(ids("A placement would kick-start my career and help me gain invaluable experience.", o("placement"))).toContain("CL-81");
    expect(ids("I want real-world experience.", o("placement"))).toContain("CL-81");
    expect(ids("I want real-world experience of running a bottling line.", o("placement"))).not.toContain("CL-81");
  });
  it("asks a why-placement sentence to name a module, project or final-year plan", () => {
    expect(ids("I want a placement because I like working in teams.", o("placement"))).toContain("CL-82");
    expect(ids("I want a placement because my fluids module made me curious about pumps.", o("placement"))).not.toContain("CL-82");
  });
  it("does nothing on the standard track, and lintLetter only runs it when a track is given", () => {
    const text = "I want to join Barclays because it is a great place to learn.";
    expect(trackLintHits(text, o("standard"))).toEqual([]);
    const base = { mode: "field_answer" as const, limit: { unit: "words" as const, max: 300 }, company: "Barclays", role: "Spring Insight Programme", otherEmployers: [], ownSpans: [] };
    expect(lintLetter(text, base).some((h) => h.ruleId === "CL-80")).toBe(false);
    expect(lintLetter(text, { ...base, track: "spring", rivals: ["HSBC"] }).some((h) => h.ruleId === "CL-80")).toBe(true);
  });
});

describe("trackLetterBlock", () => {
  it("is spring- or placement-specific and absent for standard", () => {
    expect(trackLetterBlock("spring")).toContain("SPRING WEEK / INSIGHT MOTIVATION");
    expect(trackLetterBlock("placement")).toContain("bring_back");
    expect(trackLetterBlock("standard")).toBeNull();
  });
});
