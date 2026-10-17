import type { Archetype } from "@/lib/types";
import type { Answer, Fact } from "./types";

export type QuestionState = {
  answers: Answer[];
  researchState: "idle" | "running" | "done" | "none" | "failed";
  facts: Fact[];
  storyEntry: { id: string; label: string } | null;
  archetype: Archetype | null;
  hasTouchpointAnswer: boolean;
  company: string;
  /** A saved answer exists for this story, so the "Use my saved answer" chip is offered. */
  hasSavedStory?: boolean;
};
export type Question = { id: Answer["question"]; text: string; chips: string[] };

const MAX_QUESTIONS = 4;
/** why_firm already names a person or an event, so a touchpoint question would repeat it. */
const MENTIONS_PERSON_OR_EVENT = /\b(met|meet|meeting|spoke|speak|talked|chatted|event|webinar|panel|workshop|careers? fair|insight (?:day|week)|open day|networking|coffee chat|speaker|alumn\w*|recruiter|mentor)\b/i;

export function nextQuestion(s: QuestionState): Question | { id: "wait_research" } | null {
  if (s.answers.length >= MAX_QUESTIONS) return null;
  const done = new Set(s.answers.map((a) => a.question));
  const whyFirm = s.answers.find((a) => a.question === "why_firm");
  const ask = (id: Question["id"], text: string, extra: string[] = []): Question => ({ id, text, chips: ["Skip", ...extra] });

  if (!done.has("why_firm")) return ask("why_firm", `Why ${s.company}, in one sentence? Something you saw, read, or someone you met.`);

  if (!done.has("facts")) {
    if (s.researchState === "running") return { id: "wait_research" };
    if (s.researchState === "done" && s.facts.length >= 1) {
      return ask("facts", `I found ${s.facts.length} things about ${s.company}. Which ones actually interest you?`);
    }
  }

  if (!done.has("story") && s.storyEntry) {
    return ask("story", `Your CV mentions ${s.storyEntry.label}. What did you do there, and what happened?`, s.hasSavedStory ? ["Use my saved answer"] : []);
  }

  const covered = s.hasTouchpointAnswer || (whyFirm?.text != null && MENTIONS_PERSON_OR_EVENT.test(whyFirm.text));
  if (!covered && !done.has("touchpoint") && !done.has("product")) {
    return s.archetype === "product"
      ? ask("product", `Have you used ${s.company}'s product? One thing you noticed is enough.`)
      : ask("touchpoint", `Have you met anyone from ${s.company} or been to one of their events?`);
  }
  return null;
}
