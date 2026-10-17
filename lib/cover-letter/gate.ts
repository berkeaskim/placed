import { countChars, countWords } from "./rules";
import type { Limit, LintHit, Span } from "./types";

const quote = (text: string, s: Span) => {
  const t = text.slice(s.start, s.end).replace(/\s+/g, " ").trim();
  return t.length > 60 ? `${t.slice(0, 57)}…` : t;
};

/**
 * The Ready gate (spec "Calls made after the builder check"). Blocked only by a `block` lint hit in AI-written
 * or letter-level scope (placeholders, chatbot leftovers, other employers, missing company/role, hard lexicon),
 * an AI-written span the ground-check could not support, or going over the limit. The student's own text
 * (scope "theirs") never blocks.
 */
export function canMarkReady(o: { text: string; spans: Span[]; lint: LintHit[]; limit: Limit }): { ok: true } | { ok: false; reasons: string[] } {
  const reasons: string[] = [];
  if (!o.text.trim()) reasons.push("The letter is empty");
  for (const h of o.lint) if (h.severity === "block" && (h.scope === "ai" || h.scope === "letter")) reasons.push(h.label);
  for (const s of o.spans) if (s.kind === "ai" && s.flag) reasons.push(`Check "${quote(o.text, s)}": ${s.flag}`);
  if (o.limit) {
    const used = o.limit.unit === "words" ? countWords(o.text) : countChars(o.text);
    if (used > o.limit.max) reasons.push(`Over the limit (${used}/${o.limit.max} ${o.limit.unit})`);
  }
  const unique = [...new Set(reasons)];
  return unique.length ? { ok: false, reasons: unique } : { ok: true };
}
