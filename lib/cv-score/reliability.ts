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
