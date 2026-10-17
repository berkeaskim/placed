import type { Span } from "./types";

const hasText = (t: string) => /[\p{L}\p{N}]/u.test(t);

/**
 * The letter as the paper renders it (`white-space: pre-line`): non-breaking spaces as spaces, space runs collapsed,
 * every line trimmed, at most one blank line between paragraphs.
 */
export function tidySpaces(s: string): string {
  return s.replace(/ /g, " ").replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/ ?\n ?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

/** True when two versions of a letter differ only in whitespace the paper does not show (a focus and blur with no edit). */
export const sameLetter = (a: string, b: string) => tidySpaces(a) === tidySpaces(b);

type Tok = { s: number; e: number; ws: boolean; t: string };
/** A changed region: before[b0, b1) became after[a0, a1). */
type Hunk = { b0: number; b1: number; a0: number; a1: number };

const tokens = (text: string): Tok[] => [...text.matchAll(/\s+|\S+/g)].map((m) => ({ s: m.index, e: m.index + m[0].length, ws: /^\s/.test(m[0]), t: m[0] }));
// Any whitespace matches any whitespace: a changed space run or paragraph break is not a change of words.
const same = (a: Tok, b: Tok) => (a.ws && b.ws) || a.t === b.t;
/** Above this many token pairs in the changed middle, the middle is treated as one change (the diff table stays small). */
const MAX_CELLS = 4_000_000;

/** Matched token index pairs (word-level longest common subsequence after trimming the common prefix and suffix). */
function align(b: Tok[], a: Tok[]): [number, number][] {
  const pairs: [number, number][] = [];
  let p = 0;
  while (p < b.length && p < a.length && same(b[p], a[p])) { pairs.push([p, p]); p++; }
  let s = 0;
  while (s < b.length - p && s < a.length - p && same(b[b.length - 1 - s], a[a.length - 1 - s])) s++;
  const n = b.length - p - s;
  const m = a.length - p - s;
  if (n > 0 && m > 0 && n * m <= MAX_CELLS) {
    const w = m + 1;
    const L = new Uint32Array((n + 1) * w);
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        L[i * w + j] = same(b[p + i], a[p + j]) ? L[(i + 1) * w + j + 1] + 1 : Math.max(L[(i + 1) * w + j], L[i * w + j + 1]);
      }
    }
    let i = 0;
    let j = 0;
    while (i < n && j < m) {
      if (same(b[p + i], a[p + j]) && L[i * w + j] === L[(i + 1) * w + j + 1] + 1) { pairs.push([p + i, p + j]); i++; j++; }
      else if (L[(i + 1) * w + j] >= L[i * w + j + 1]) i++;
      else j++;
    }
  }
  for (let k = s; k > 0; k--) pairs.push([b.length - k, a.length - k]);
  return pairs;
}

/**
 * The spans of `after`, a hand edit of `before`, from a word-level diff. Each changed region (hunk) makes the spans
 * whose own words it changes the student's ("theirs": editing a sentence makes it theirs); a region that spans two
 * sentences makes them one span. A span whose words are unchanged keeps its owner, refs and flag, only moved. Text
 * typed outside every span becomes a new span of theirs. Whitespace changes alone change no owner.
 */
export function diffSpans(before: string, spans: Span[], after: string): Span[] {
  if (before === after) return spans;
  const bt = tokens(before);
  const at = tokens(after);
  const pairs = align(bt, at);

  // Before-offset → after-offset for every kept character; -1 for a character the edit removed or replaced.
  const map = new Int32Array(before.length).fill(-1);
  const hunks: Hunk[] = [];
  let pb = 0;
  let pa = 0;
  const gap = (bi: number, ai: number) => {
    const b0 = pb < bt.length ? bt[pb].s : before.length;
    const b1 = bi < bt.length ? bt[bi].s : before.length;
    const a0 = pa < at.length ? at[pa].s : after.length;
    const a1 = ai < at.length ? at[ai].s : after.length;
    const changed = bt.slice(pb, bi).some((t) => !t.ws) || at.slice(pa, ai).some((t) => !t.ws);
    if (changed) hunks.push({ b0, b1, a0, a1 });
  };
  for (const [bi, ai] of pairs) {
    gap(bi, ai);
    const b = bt[bi];
    const a = at[ai];
    for (let k = b.s; k < b.e; k++) map[k] = a.s + Math.min(k - b.s, a.e - a.s - 1);
    pb = bi + 1;
    pa = ai + 1;
  }
  gap(bt.length, at.length);

  // A hunk touches a span when it removes or replaces any of its characters, or inserts strictly inside it.
  const touches = (h: Hunk, sp: Span) => (h.b0 === h.b1 ? sp.start < h.b0 && h.b0 < sp.end : h.b0 < sp.end && h.b1 > sp.start);
  const lost = (sp: Span) => { for (let k = sp.start; k < sp.end; k++) if (map[k] < 0) return true; return false; };

  // Spans joined by a shared hunk become one span of theirs (union-find over span indexes).
  const parent = spans.map((_, k) => k);
  const root = (k: number): number => (parent[k] === k ? k : (parent[k] = root(parent[k])));
  const touched = new Set<number>();
  const free: Hunk[] = [];
  for (const h of hunks) {
    const hit = spans.flatMap((sp, k) => (touches(h, sp) ? [k] : []));
    if (!hit.length) { free.push(h); continue; }
    for (const k of hit) { touched.add(k); parent[root(k)] = root(hit[0]); }
  }
  spans.forEach((sp, k) => { if (lost(sp)) touched.add(k); });

  const out: Span[] = [];
  const push = (start: number, end: number, refs: string[]) => {
    while (start < end && /\s/.test(after[start])) start++;
    while (end > start && /\s/.test(after[end - 1])) end--;
    if (end > start && hasText(after.slice(start, end))) out.push({ start, end, kind: "theirs", refs });
  };

  const groups = new Map<number, number[]>();
  spans.forEach((sp, k) => {
    if (!touched.has(k)) {
      out.push({ ...sp, start: map[sp.start], end: map[sp.end - 1] + 1 });
      return;
    }
    groups.set(root(k), [...(groups.get(root(k)) ?? []), k]);
  });
  for (const members of groups.values()) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const k of members) {
      for (let c = spans[k].start; c < spans[k].end; c++) if (map[c] >= 0) { lo = Math.min(lo, map[c]); hi = Math.max(hi, map[c] + 1); }
    }
    for (const h of hunks) {
      if (h.a1 > h.a0 && members.some((k) => touches(h, spans[k]))) { lo = Math.min(lo, h.a0); hi = Math.max(hi, h.a1); }
    }
    const only = members.length === 1 ? spans[members[0]] : null;
    if (hi > lo) push(lo, hi, only?.kind === "theirs" ? only.refs : []);
  }
  for (const h of free) push(h.a0, h.a1, []);
  return out.sort((a, b) => a.start - b.start);
}
