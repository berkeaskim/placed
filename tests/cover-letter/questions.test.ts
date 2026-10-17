import { describe, expect, it } from "vitest";
import { nextQuestion } from "@/lib/cover-letter/questions";
import type { Answer } from "@/lib/cover-letter/types";

type State = Parameters<typeof nextQuestion>[0];
const story = { id: "e0", label: "Analyst at Hudson Fund" };
const fact = { id: "f1", claim: "c", url: "https://x.com", publisher: "X", date: null };
const ans = (question: Answer["question"], text: string | null = "text"): Answer => ({ id: question, question, text });
const base = (over: Partial<State> = {}): State => ({
  answers: [], researchState: "done", facts: [fact, fact], storyEntry: story, archetype: null, hasTouchpointAnswer: false, company: "Acme", ...over,
});

describe("nextQuestion", () => {
  it("walks why_firm, facts, story, touchpoint, then done", () => {
    const q1 = nextQuestion(base());
    expect(q1).toMatchObject({ id: "why_firm" });
    expect((q1 as { text: string }).text).toBe("Why Acme, in one sentence? Something you saw, read, or someone you met.");
    const a: Answer[] = [ans("why_firm", "I like their deals")];
    expect(nextQuestion(base({ answers: a}))).toMatchObject({ id: "facts", text: "I found 2 things about Acme. Which ones actually interest you?" });
    a.push(ans("facts"));
    expect(nextQuestion(base({ answers: a}))).toMatchObject({ id: "story", text: "Your CV mentions Analyst at Hudson Fund. What did you do there, and what happened?" });
    a.push(ans("story"));
    expect(nextQuestion(base({ answers: a}))).toMatchObject({ id: "touchpoint", text: "Have you met anyone from Acme or been to one of their events?" });
    a.push(ans("touchpoint"));
    expect(nextQuestion(base({ answers: a }))).toBeNull();
  });

  it("waits while research is running, after why_firm", () => {
    expect(nextQuestion(base({ researchState: "running" }))).toMatchObject({ id: "why_firm" });
    expect(nextQuestion(base({ researchState: "running", answers: [ans("why_firm")] }))).toEqual({ id: "wait_research" });
  });

  it.each(["none", "failed", "idle"] as const)("skips facts when research is %s", (researchState) => {
    expect(nextQuestion(base({ researchState, answers: [ans("why_firm")] }))).toMatchObject({ id: "story" });
  });

  it("skips facts when research is done with no facts", () => {
    expect(nextQuestion(base({ facts: [], answers: [ans("why_firm")] }))).toMatchObject({ id: "story" });
  });

  it("skips story without a story entry", () => {
    expect(nextQuestion(base({ storyEntry: null, answers: [ans("why_firm"), ans("facts")] }))).toMatchObject({ id: "touchpoint" });
  });

  it("no touchpoint when why_firm mentions meeting someone or an event", () => {
    const answers = [ans("why_firm", "I met your recruiter at the UCL careers fair"), ans("facts"), ans("story")];
    expect(nextQuestion(base({ answers }))).toBeNull();
    expect(nextQuestion(base({ answers: [ans("why_firm", "I liked their webinar"), ans("facts"), ans("story")] }))).toBeNull();
  });

  it("asks touchpoint when why_firm was skipped", () => {
    expect(nextQuestion(base({ answers: [ans("why_firm", null), ans("facts"), ans("story")] }))).toMatchObject({ id: "touchpoint" });
  });

  it("no touchpoint when the caller already has one", () => {
    expect(nextQuestion(base({ hasTouchpointAnswer: true, answers: [ans("why_firm", "Their deals"), ans("facts"), ans("story")] }))).toBeNull();
  });

  it("asks product instead of touchpoint for the product archetype", () => {
    const q = nextQuestion(base({ archetype: "product", answers: [ans("why_firm", "Their deals"), ans("facts"), ans("story")] }));
    expect(q).toMatchObject({ id: "product", text: "Have you used Acme's product? One thing you noticed is enough." });
  });

  it("never asks more than 4 questions", () => {
    const answers = [ans("why_firm", null), ans("facts"), ans("story"), ans("touchpoint", null)];
    expect(nextQuestion(base({ answers }))).toBeNull();
    expect(nextQuestion(base({ answers: [...answers, ans("product")] }))).toBeNull();
    expect(nextQuestion(base({ answers: [ans("why_firm"), ans("facts"), ans("story"), ans("product", null)], archetype: "product" }))).toBeNull();
  });

  it("chips: Skip always, saved-answer chip only on story", () => {
    expect((nextQuestion(base()) as { chips: string[] }).chips).toEqual(["Skip"]);
    const a = [ans("why_firm"), ans("facts")];
    expect((nextQuestion(base({ answers: a })) as { chips: string[] }).chips).toEqual(["Skip"]);
    expect((nextQuestion(base({ answers: a, hasSavedStory: true })) as { chips: string[] }).chips).toEqual(["Skip", "Use my saved answer"]);
  });
});
