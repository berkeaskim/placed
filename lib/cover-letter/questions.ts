import type { Archetype } from "@/lib/types";
import type { Track } from "@/lib/cv-rules/types";
import { maxQuestions, needsHook, PLACEMENT_SLOTS } from "./track";
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
  /** The job's track (spring/placement add the firm-hook question and the placement slots). Absent = standard. */
  track?: Track;
  /** Firm-specific hooks so far (lib/cover-letter/track firmHooks). */
  hooks?: number;
};
export type Question = { id: Answer["question"]; text: string; chips: string[] };

/** why_firm already names a person or an event, so a touchpoint question would repeat it. */
const MENTIONS_PERSON_OR_EVENT = /\b(met|meet|meeting|spoke|speak|talked|chatted|event|webinar|panel|workshop|careers? fair|insight (?:day|week)|open day|networking|coffee chat|speaker|alumn\w*|recruiter|mentor)\b/i;

export function nextQuestion(s: QuestionState): Question | { id: "wait_research" } | null {
  const track = s.track ?? "standard";
  if (s.answers.length >= maxQuestions(track)) return null;
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

  // Spring/placement: fewer than two firm-specific hooks after research → ask for one more rather than write filler.
  if (needsHook(track, s.hooks ?? 0, s.answers) && s.researchState !== "running") {
    return ask("hook", `I only have ${s.hooks ?? 0} thing${s.hooks === 1 ? "" : "s"} that ${s.company} alone could say. Add one more: a programme detail, a recent deal or news story you read, or someone you met.`);
  }

  if (track === "placement") {
    for (const slot of PLACEMENT_SLOTS) if (!done.has(slot.id)) return ask(slot.id, slot.text);
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
