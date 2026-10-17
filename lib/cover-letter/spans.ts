import type { Span } from "./types";

const hasText = (t: string) => /[\p{L}\p{N}]/u.test(t);

/**
 * The spans of `after`, a hand edit of `before`. The changed region (common prefix and suffix removed), merged with
 * every span it touches, becomes one span of the student's own ("theirs": editing a sentence makes it theirs). Spans
 * before the change keep their place; spans after it shift by the length difference.
 */
export function diffSpans(before: string, spans: Span[], after: string): Span[] {
  if (before === after) return spans;
  const max = Math.min(before.length, after.length);
  let p = 0;
  while (p < max && before[p] === after[p]) p++;
  let s = 0;
  while (s < max - p && before[before.length - 1 - s] === after[after.length - 1 - s]) s++;
  const oldEnd = before.length - s;
  const delta = after.length - before.length;
  let start = p;
  let end = after.length - s;
  const out: Span[] = [];
  for (const sp of spans) {
    // A pure insertion touches only the span it lands inside; a replacement touches every span it overlaps.
    const touched = p === oldEnd ? sp.start < p && sp.end > p : sp.start < oldEnd && sp.end > p;
    if (touched) {
      start = Math.min(start, sp.start);
      end = Math.max(end, sp.end + delta);
    } else if (sp.end <= p) out.push(sp);
    else out.push({ ...sp, start: sp.start + delta, end: sp.end + delta });
  }
  while (start < end && /\s/.test(after[start])) start++;
  while (end > start && /\s/.test(after[end - 1])) end--;
  if (end > start && hasText(after.slice(start, end))) out.push({ start, end, kind: "theirs", refs: [] });
  return out.sort((a, b) => a.start - b.start);
}
