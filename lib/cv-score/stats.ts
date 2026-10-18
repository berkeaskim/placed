/**
 * Agreement and reliability statistics for validating the CV score (audit 2026-10-18, 04 "Validation plan" and #13).
 * Pure and dependency-free; used by scripts/validate-cv.ts, scripts/reliability.ts and their tests.
 *
 * - Cohen's κ: two raters, nominal categories (Cohen 1960).
 * - Gwet's AC1: two raters; reported next to κ because most CV rules have skewed prevalence, where κ collapses even
 *   at high raw agreement (Feinstein & Cicchetti 1990; Wongpakaran et al. 2013).
 * - Fleiss' κ: three or more raters, every item rated by the same number of raters (Fleiss 1971).
 * - ICC(1,1): one-way random effects, single measure (Shrout & Fleiss 1979), for repeated scores of the same CV.
 *
 * Every statistic returns null when it is undefined (e.g. one category only), never a misleading 0 or 1.
 */

export type KappaResult = { kappa: number | null; po: number; pe: number; n: number };

function categories<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}

/** Cohen's κ for paired labels [raterA, raterB]. */
export function cohenKappa<T extends string>(pairs: [T, T][]): KappaResult {
  const n = pairs.length;
  if (n === 0) return { kappa: null, po: 0, pe: 0, n };
  const cats = categories(pairs.flat());
  const po = pairs.filter(([a, b]) => a === b).length / n;
  const pe = cats.reduce((s, c) => s + (pairs.filter(([a]) => a === c).length / n) * (pairs.filter(([, b]) => b === c).length / n), 0);
  return { kappa: pe >= 1 ? null : (po - pe) / (1 - pe), po, pe, n };
}

/** Gwet's AC1 for paired labels. With one category in play it is null (nothing to tell apart). */
export function gwetAc1<T extends string>(pairs: [T, T][]): { ac1: number | null; po: number; pe: number; n: number } {
  const n = pairs.length;
  const cats = categories(pairs.flat());
  if (n === 0 || cats.length < 2) return { ac1: null, po: n ? 1 : 0, pe: 0, n };
  const po = pairs.filter(([a, b]) => a === b).length / n;
  const pi = (c: T) => pairs.reduce((s, [a, b]) => s + (a === c ? 1 : 0) + (b === c ? 1 : 0), 0) / (2 * n);
  const pe = cats.reduce((s, c) => s + pi(c) * (1 - pi(c)), 0) / (cats.length - 1);
  return { ac1: pe >= 1 ? null : (po - pe) / (1 - pe), po, pe, n };
}

export type FleissResult = { kappa: number | null; items: number; raters: number; pBar: number; peBar: number };

/** Fleiss' κ from a count matrix: counts[item][category], every row summing to the same number of raters. */
export function fleissKappaCounts(counts: number[][]): FleissResult {
  const items = counts.length;
  const raters = items ? counts[0].reduce((a, b) => a + b, 0) : 0;
  if (counts.some((row) => row.reduce((a, b) => a + b, 0) !== raters)) throw new Error("fleissKappa: every item needs the same number of ratings");
  if (items === 0 || raters < 2) return { kappa: null, items, raters, pBar: 0, peBar: 0 };
  const k = counts[0].length;
  const pj = Array.from({ length: k }, (_, j) => counts.reduce((s, row) => s + row[j], 0) / (items * raters));
  const pBar = counts.reduce((s, row) => s + (row.reduce((a, x) => a + x * x, 0) - raters) / (raters * (raters - 1)), 0) / items;
  const peBar = pj.reduce((s, p) => s + p * p, 0);
  return { kappa: peBar >= 1 ? null : (pBar - peBar) / (1 - peBar), items, raters, pBar, peBar };
}

/** Fleiss' κ from raw labels: items[i] is the list of labels item i received (same length for every item). */
export function fleissKappa<T extends string>(items: T[][]): FleissResult {
  if (items.some((xs) => xs.length !== (items[0]?.length ?? 0))) throw new Error("fleissKappa: every item needs the same number of ratings");
  const cats = categories(items.flat());
  return fleissKappaCounts(items.map((xs) => cats.map((c) => xs.filter((x) => x === c).length)));
}

/**
 * ICC(1,1) for data[target][measurement] (e.g. one CV's total across repeated runs). Also returns the SEM, √MSW: the
 * typical distance of one measurement from that target's true score.
 */
export function icc1(data: number[][]): { icc: number | null; sem: number; msb: number; msw: number; targets: number; k: number } {
  const targets = data.length;
  const k = data[0]?.length ?? 0;
  if (data.some((row) => row.length !== k)) throw new Error("icc1: every target needs the same number of measurements");
  if (targets === 0 || k < 2) return { icc: null, sem: 0, msb: 0, msw: 0, targets, k };
  const grand = data.flat().reduce((a, b) => a + b, 0) / (targets * k);
  const means = data.map((row) => row.reduce((a, b) => a + b, 0) / k);
  const ssw = data.reduce((s, row, i) => s + row.reduce((a, x) => a + (x - means[i]) ** 2, 0), 0);
  const msw = ssw / (targets * (k - 1));
  if (targets < 2) return { icc: null, sem: Math.sqrt(msw), msb: 0, msw, targets, k };
  const msb = (k * means.reduce((s, m) => s + (m - grand) ** 2, 0)) / (targets - 1);
  const denom = msb + (k - 1) * msw;
  return { icc: denom === 0 ? null : (msb - msw) / denom, sem: Math.sqrt(msw), msb, msw, targets, k };
}

export type BinaryMetrics = {
  n: number; tp: number; fp: number; fn: number; tn: number;
  precision: number | null; recall: number | null; specificity: number | null;
};

/** Detection metrics with "fail" as the positive class: does a checker catch what humans call a fail? */
export function binaryMetrics(rows: { predicted: string; truth: string }[], positive = "fail"): BinaryMetrics {
  let tp = 0, fp = 0, fn = 0, tn = 0;
  for (const r of rows) {
    const p = r.predicted === positive, t = r.truth === positive;
    if (p && t) tp++; else if (p) fp++; else if (t) fn++; else tn++;
  }
  const ratio = (a: number, b: number) => (b === 0 ? null : a / b);
  return { n: rows.length, tp, fp, fn, tn, precision: ratio(tp, tp + fp), recall: ratio(tp, tp + fn), specificity: ratio(tn, tn + fp) };
}

/** The label more than half the raters gave, or null (tie or no majority): ambiguous items aren't ground truth. */
export function majority<T extends string>(labels: T[]): T | null {
  for (const c of categories(labels)) if (labels.filter((x) => x === c).length * 2 > labels.length) return c;
  return null;
}
