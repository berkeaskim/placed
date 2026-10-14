/**
 * Word-level diff for the tailoring screen: what the AI (or the student) removed from and added to each CV line.
 * Pure and client-safe. Whitespace is normalised; punctuation stays attached to its word, so "SQL" → "SQL," is a
 * changed word. Runs of the same op are merged; a replacement reads as delete then add.
 */
export type DiffOp = "same" | "del" | "add";
export type DiffPart = { op: DiffOp; text: string };

/** Above this many LCS cells (≈ 150 × 150 words) we show the whole line as replaced instead. */
const MAX_CELLS = 40_000;

const tokens = (s: string) => s.split(/\s+/).filter(Boolean);

function push(out: DiffPart[], op: DiffOp, word: string) {
  const last = out[out.length - 1];
  if (last?.op === op) last.text += ` ${word}`;
  else out.push({ op, text: word });
}

export function lineDiff(before: string, after: string): DiffPart[] {
  const a = tokens(before);
  const b = tokens(after);
  const out: DiffPart[] = [];
  if (!a.length || !b.length || a.length * b.length > MAX_CELLS) {
    if (a.length) out.push({ op: "del", text: a.join(" ") });
    if (b.length) out.push({ op: "add", text: b.join(" ") });
    return out;
  }
  // lcs[i][j] = longest common subsequence of a[i..] and b[j..]
  const lcs = Array.from({ length: a.length + 1 }, () => new Uint16Array(b.length + 1));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  let i = 0;
  let j = 0;
  // Deletions before additions at each change point, so a replacement reads "old → new".
  const flush = (dels: string[], adds: string[]) => {
    for (const w of dels) push(out, "del", w);
    for (const w of adds) push(out, "add", w);
    dels.length = 0;
    adds.length = 0;
  };
  const dels: string[] = [];
  const adds: string[] = [];
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { flush(dels, adds); push(out, "same", a[i]); i++; j++; }
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) dels.push(a[i++]);
    else adds.push(b[j++]);
  }
  while (i < a.length) dels.push(a[i++]);
  while (j < b.length) adds.push(b[j++]);
  flush(dels, adds);
  return out;
}

/** Words removed and added, for the per-line "−2 / +3 words" hint. */
export function diffStats(parts: DiffPart[]): { removed: number; added: number } {
  let removed = 0;
  let added = 0;
  for (const p of parts) {
    const n = tokens(p.text).length;
    if (p.op === "del") removed += n;
    else if (p.op === "add") added += n;
  }
  return { removed, added };
}
