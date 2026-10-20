/**
 * Which remembered long answers Autopilot may offer again (spring 05 §6d, placement 05 §4d). Pure.
 * - "Why [firm]?" is never reused: the memory keeps the student's reasons (cover-letter stories), never the text,
 *   which must be rewritten with this firm's own hooks.
 * - "A recent news story / deal you've followed" is only reusable for a few weeks: after that it is offered as a
 *   starting point with a note to check how the story has moved on, and it always opens in Edit.
 * - Everything else (competency stories, why this sector, why a placement) is reusable as before.
 */
export type MemoryRule = { kind: "never_reuse" } | { kind: "expires"; days: number } | { kind: "reuse" };

/** Recent-news answers go stale after this many days (spring 05 §6d: "4-8 weeks"). */
export const NEWS_STALE_DAYS = 42;

const WHY_FIRM = new RegExp([
  String.raw`^\s*why\s+(?:us|this\s+(?:firm|company|bank|organi[sz]ation|employer))\s*\??\s*$`,
  String.raw`\bwhy\s+(?:do\s+you\s+want\s+to\s+)?(?:work|join|apply)\w*\s+(?:(?:at|for|to|with)\s+)?(?:us|this\s+(?:firm|company|bank|organi[sz]ation)|our\s+(?:firm|company|bank))\b`,
  String.raw`\bwhat\s+(?:attracts|draws|interests)\s+you\s+to\s+(?:us|our\s+(?:firm|company|bank)|this\s+(?:firm|company|bank|organi[sz]ation))\b`,
  String.raw`\bwhy\s+(?:have\s+you\s+)?(?:chosen|chose|choose)\s+(?:us|this\s+(?:firm|company|bank|employer))\b`,
].join("|"), "i");
/** "Why Barclays?", "Why do you want to work at Goldman Sachs?": case-sensitive, so "Why … in finance?" is not a firm. */
const WHY_NAMED_FIRM = /^\s*[Ww]hy\s+[A-Z][\w.&'’ -]{0,40}\?\s*$|\b[Ww]hy\b[^?]{0,50}\b(?:work|join|apply)\w*\s+(?:at|for|to|with)\s+[A-Z][\w.&'’-]*/;

const RECENT_NEWS = /\b(?:recent|current)\s+(?:news|deal|transaction|event|development|story|market\s+(?:event|news|development))|\bdeal\s+(?:you(?:'ve|\s+have)\s+)?followed|\b(?:news|market)\s+stor(?:y|ies)\b|\bin\s+the\s+news\b|\bcurrent\s+affairs\b|\bcommercial\s+awareness\b|\bwhat(?:'s|\s+is)\s+happening\s+in\s+(?:the\s+)?markets?\b/i;

export function memoryRule(label: string): MemoryRule {
  if (WHY_FIRM.test(label) || WHY_NAMED_FIRM.test(label)) return { kind: "never_reuse" };
  if (RECENT_NEWS.test(label)) return { kind: "expires", days: NEWS_STALE_DAYS };
  return { kind: "reuse" };
}

/**
 * Whether a kept answer to `label`, last saved at `savedAt` (ISO), may be offered now: null = never; otherwise the
 * note to show with it (null when it is fresh).
 */
export function offerPrevious(label: string, savedAt: string, now: Date): { staleNote: string | null } | null {
  const rule = memoryRule(label);
  if (rule.kind === "never_reuse") return null;
  if (rule.kind === "reuse") return { staleNote: null };
  const days = Math.floor((now.getTime() - Date.parse(savedAt)) / 86_400_000);
  if (!(days > rule.days)) return { staleNote: null };
  const weeks = Math.floor(days / 7);
  return { staleNote: `You wrote this ${weeks} weeks ago. News moves fast: check how the story has developed and update it before you use it.` };
}
