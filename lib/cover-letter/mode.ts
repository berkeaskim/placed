import { RULES } from "./rules";
import type { Limit, Mode, OutputTarget } from "./types";

const MOTIVATION = /cover letter|covering letter|why (do you want|are you interested|this|us|join)\b|\bmotivation\b|what motivates you|motivated to (apply|join)|interest in (the )?(role|firm|company|programme|program|division|team)\b/i;
const NO_LETTER = /no (cover|covering) letter|cover letters? (are|is) not (required|needed|accepted)|do not (send|include) a cover letter/i;
const AI_POLICY = new RegExp(RULES.lexicon.counters.aiPolicy, RULES.lexicon.flags);

/** True for a free-text prompt asking why the student wants this role or firm. "Additional information" and "anything else" never match. */
export function isMotivationLabel(label: string): boolean {
  return MOTIVATION.test(label);
}

/** True when the posting says an AI-written application is not welcome. */
export function aiPolicyBlocks(jdText: string): boolean {
  return AI_POLICY.test(jdText);
}

/** True when the posting says not to send a cover letter. */
export function noLetterWanted(jdText: string): boolean {
  return NO_LETTER.test(jdText);
}

export type ModeInput = {
  target: OutputTarget;
  fieldType?: "file" | "textarea";
  wordLimit?: number;
  charLimit?: number;
  jdText: string;
};

/** Which kind of letter a target needs, with the form limit it must respect. */
export function chooseMode(input: ModeInput): { mode: Mode; limit: Limit; reason: string } {
  if (noLetterWanted(input.jdText)) return { mode: "skip", limit: null, reason: "The posting says not to send a cover letter." };
  if (input.target.kind === "upload" || input.fieldType === "file") {
    return { mode: "full_letter", limit: null, reason: "A cover letter upload takes a full letter." };
  }
  if (input.wordLimit) return { mode: "field_answer", limit: { unit: "words", max: input.wordLimit }, reason: `The form asks for up to ${input.wordLimit} words.` };
  if (input.charLimit) return { mode: "field_answer", limit: { unit: "chars", max: input.charLimit }, reason: `The form asks for up to ${input.charLimit} characters.` };
  const max = RULES.modes.field_answer.defaultWords as number;
  return { mode: "field_answer", limit: { unit: "words", max }, reason: `The form states no limit, so ${max} words is used.` };
}
