import { RULES } from "./rules";
import { detectJdAiPolicy } from "@/lib/employer-policy";
import type { Limit, Mode, OutputTarget } from "./types";

/**
 * 09 #11: the standard UK motivation prompts ("Why are you applying to Goldman Sachs?", "What attracts you to this
 * programme?", "Why J.P. Morgan?", "Please explain your interest in this position"). "Describe a time you motivated a
 * team" and "your interest in teamwork" are not motivation prompts.
 */
const MOTIVATION = new RegExp([
  String.raw`cover(?:ing)? letter|personal statement`,
  String.raw`\bwhy\b[^?.]{0,60}\b(?:apply|applying|applied|join|joining|work(?:ing)?\s+(?:at|for|with|in)|chose|chosen|choose|us|our|this|these|interested|want|wish)\b`,
  String.raw`\bwhat\s+(?:attracts|interests|excites|draws|motivates|appeals\s+to)\s+you\b`,
  String.raw`\b(?:interest|interested|motivation|motivated)\s+(?:in|for|to)\s+(?:apply|applying|join|joining|work|working|the|this|our|us|these)\b`,
  String.raw`\bmotivation\b|\bwhat motivates you\b`,
].join("|"), "i");
/** "Why Anthropic?", "Why J.P. Morgan?": "Why" plus a capitalised name and nothing else. */
const WHY_FIRM = /^\s*[Ww]hy\s+[A-Z][\w.&'’ -]{0,40}\?\s*$/;
const NO_LETTER = /no (cover|covering) letter|cover letters? (are|is) not (required|needed|accepted)|do not (send|include) a cover letter/i;


/** True for a free-text prompt asking why the student wants this role or firm. "Additional information" and "anything else" never match. */
export function isMotivationLabel(label: string): boolean {
  return MOTIVATION.test(label) || WHY_FIRM.test(label);
}

/** True when the posting says not to use AI for the application at all (lib/employer-policy's advert detector). */
export function aiPolicyBlocks(jdText: string): boolean {
  return detectJdAiPolicy(jdText)?.policy === "not_permitted";
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
