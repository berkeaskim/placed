import { fleissKappa, icc1 } from "./stats";
/**
 * Test-retest statistics for the CV judge (research 06 T17, audit 04#13): population SD of the totals and, per rule,
 * the share of runs that disagree with the modal verdict with a 95% Wilson interval. Gate: SD ≤ 2 and no rule whose
 * flip-rate interval lies wholly above 10% (with few runs a single flip is not evidence of an unstable rule).
 * Pure; used by scripts/reliability.ts.
 */
export type RuleFlip = { ruleId: string; rate: number; ci: [number, number]; counts: Record<string, number> };
export type ReliabilityStats = { mean: number; sd: number; sem: number; flips: RuleFlip[]; unstable: RuleFlip[]; pass: boolean };

export const MAX_SD = 2;
export const MAX_FLIP_RATE = 0.1;
/** Fewer runs than this can't separate a 10% flip rate from noise (04#13); the script refuses to gate below it. */
export const MIN_RUNS = 10;

/** 95% Wilson score interval for k successes in n trials. */
export function wilson(k: number, n: number, z = 1.96): [number, number] {
  if (n === 0) return [0, 1];
  const p = k / n;
  const d = 1 + (z * z) / n;
  const c = p + (z * z) / (2 * n);
  const h = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [Math.max(0, (c - h) / d), Math.min(1, (c + h) / d)];
}

export function reliabilityStats(totals: number[], verdictRuns: Map<string, string>[]): ReliabilityStats {
  if (!totals.length) throw new Error("reliabilityStats: no runs");
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  const sd = Math.sqrt(totals.reduce((a, b) => a + (b - mean) ** 2, 0) / totals.length);
  const ids = [...new Set(verdictRuns.flatMap((m) => [...m.keys()]))];
  const n = verdictRuns.length;
  const flips = ids.flatMap((ruleId): RuleFlip[] => {
    const counts: Record<string, number> = {};
    for (const m of verdictRuns) {
      const v = m.get(ruleId) ?? "missing";
      counts[v] = (counts[v] ?? 0) + 1;
    }
    const k = n - Math.max(...Object.values(counts));
    return k > 0 ? [{ ruleId, rate: k / n, ci: wilson(k, n), counts }] : [];
  });
  const unstable = flips.filter((f) => f.ci[0] > MAX_FLIP_RATE);
  return { mean, sd, sem: sd / Math.sqrt(totals.length), flips, unstable, pass: sd <= MAX_SD && unstable.length === 0 };
}

export type RetestCase = { label: string; totals: number[]; verdicts: Map<string, string>[] };
export type RetestRule = {
  ruleId: string;
  /** Runs, over every CV, whose verdict differs from that CV's modal verdict for this rule. */
  flips: number;
  runs: number;
  rate: number;
  ci: [number, number];
  /** Fleiss' κ with CVs as items and runs as raters; null when undefined (e.g. every verdict identical). */
  kappa: number | null;
};
export type RetestSummary = {
  cases: (ReliabilityStats & { label: string })[];
  rules: RetestRule[];
  /** ICC(1,1) of totals across CVs: how much of the spread is real difference between CVs rather than run noise. */
  icc: number | null;
  /** Standard error of measurement of one total, √(within-CV mean square). */
  sem: number;
  /** Mean of the per-CV population SDs. */
  meanSd: number;
  pass: boolean;
};

/**
 * Test–retest over a CV set (audit 04#13): N samples per CV, per-rule flip rate pooled over CVs with a Wilson interval,
 * Fleiss' κ across runs per rule, and ICC(1,1) + SEM for the totals. A missing verdict counts as its own outcome.
 * Gate: every per-CV gate passes (SD ≤ 2, no rule whose flip interval lies wholly above 10%) and no pooled rule does.
 */
export function retestSummary(cases: RetestCase[]): RetestSummary {
  if (!cases.length) throw new Error("retestSummary: no CVs");
  const runs = cases[0].totals.length;
  if (cases.some((c) => c.totals.length !== runs || c.verdicts.length !== runs)) throw new Error("retestSummary: every CV needs the same number of runs");
  const perCase = cases.map((c) => ({ label: c.label, ...reliabilityStats(c.totals, c.verdicts) }));
  const ids = [...new Set(cases.flatMap((c) => c.verdicts.flatMap((m) => [...m.keys()])))].sort();
  const rules = ids.map((ruleId): RetestRule => {
    const items = cases.map((c) => c.verdicts.map((m) => m.get(ruleId) ?? "missing"));
    const flips = items.reduce((s, xs) => {
      const counts = new Map<string, number>();
      for (const x of xs) counts.set(x, (counts.get(x) ?? 0) + 1);
      return s + xs.length - Math.max(...counts.values());
    }, 0);
    const n = items.length * runs;
    const allSame = new Set(items.flat()).size === 1;
    return { ruleId, flips, runs: n, rate: flips / n, ci: wilson(flips, n), kappa: allSame ? (flips === 0 ? 1 : null) : fleissKappa(items).kappa };
  });
  const t = icc1(cases.map((c) => c.totals));
  const meanSd = perCase.reduce((s, c) => s + c.sd, 0) / perCase.length;
  const pass = perCase.every((c) => c.pass) && rules.every((r) => r.ci[0] <= MAX_FLIP_RATE);
  return { cases: perCase, rules, icc: t.icc, sem: t.sem, meanSd, pass };
}
