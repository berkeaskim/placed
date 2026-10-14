/**
 * Word-level diff for the tailoring screen: what the AI (or the student) removed from and added to each CV line.
 * Pure and client-safe. Whitespace is normalised. List and sentence punctuation (",", ";", a final ".", brackets) is
 * its own token, so adding a skill to "Python, SQL" doesn't make "SQL" look removed; dotted names (Next.js, .NET,
 * 3.5) stay whole. Runs of the same op are merged; a replacement reads as delete then add.
 */
export type DiffOp = "same" | "del" | "add";
export type DiffPart = { op: DiffOp; text: string };

/** Above this many LCS cells (200 × 200 words) we show the whole line as replaced instead. */
const MAX_CELLS = 40_000;

const LEAD = /^[([]/;
const TRAIL = /[,;:.!?)\]]$/;

function tokens(s: string): string[] {
  const out: string[] = [];
  for (let w of s.split(/\s+/)) {
    const head: string[] = [];
    const tail: string[] = [];
    while (w.length > 1 && LEAD.test(w)) { head.push(w[0]); w = w.slice(1); }
    while (w.length > 1 && TRAIL.test(w)) { tail.unshift(w[w.length - 1]); w = w.slice(0, -1); }
    out.push(...head, ...(w ? [w] : []), ...tail);
  }
  return out;
}

/** A space goes between two tokens unless the next is a closing punctuation token or the previous opens a bracket. */
export const spaceBetween = (prev: string, next: string) => prev !== "" && !/[([]$/.test(prev) && !/^[,;:.!?)\]](\s|$)/.test(next);

const join = (ws: string[]) => ws.reduce((acc, w) => (spaceBetween(acc, w) ? `${acc} ${w}` : acc + w), "");

/** The text of consecutive parts, spaced as in the original line. */
export const joinParts = (parts: DiffPart[]) => join(parts.map((p) => p.text));

function push(out: DiffPart[], op: DiffOp, word: string) {
  const last = out[out.length - 1];
  if (last?.op === op) last.text = join([last.text, word]);
  else out.push({ op, text: word });
}

export function lineDiff(before: string, after: string): DiffPart[] {
  const a = tokens(before);
  const b = tokens(after);
  const out: DiffPart[] = [];
  if (!a.length || !b.length || a.length * b.length > MAX_CELLS) {
    if (a.length) out.push({ op: "del", text: join(a) });
    if (b.length) out.push({ op: "add", text: join(b) });
    return out;
  }
  // lcs[i][j] = longest common subsequence of a[i..] and b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  // Deletions before additions at each change point, so a replacement reads "old → new".
  const dels: string[] = [];
  const adds: string[] = [];
  const flush = () => {
    for (const w of dels) push(out, "del", w);
    for (const w of adds) push(out, "add", w);
    dels.length = 0;
    adds.length = 0;
  };
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { flush(); push(out, "same", a[i]); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) dels.push(a[i++]);
    else adds.push(b[j++]);
  }
  while (i < a.length) dels.push(a[i++]);
  while (j < b.length) adds.push(b[j++]);
  flush();
  return out;
}

/** Words removed and added (punctuation doesn't count), for the per-line "−2 / +3 words" hint. */
export function diffStats(parts: DiffPart[]): { removed: number; added: number } {
  let removed = 0;
  let added = 0;
  for (const p of parts) {
    const n = tokens(p.text).filter((t) => /[\p{L}\p{N}]/u.test(t)).length;
    if (p.op === "del") removed += n;
    else if (p.op === "add") added += n;
  }
  return { removed, added };
}
