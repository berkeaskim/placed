/**
 * Test-retest statistics for the CV judge (research 06 T17): population SD of the totals and, per rule, the share
 * of runs that disagree with the modal verdict. Gate: SD ≤ 2 and no rule flipping in more than 10% of runs.
 * Pure; used by scripts/reliability.ts.
 */
export type ReliabilityStats = { mean: number; sd: number; flips: { ruleId: string; rate: number; counts: Record<string, number> }[]; pass: boolean };

export const MAX_SD = 2;
export const MAX_FLIP_RATE = 0.1;

export function reliabilityStats(totals: number[], verdictRuns: Map<string, string>[]): ReliabilityStats {
  if (!totals.length) throw new Error("reliabilityStats: no runs");
  const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
  const sd = Math.sqrt(totals.reduce((a, b) => a + (b - mean) ** 2, 0) / totals.length);
  const ids = [...new Set(verdictRuns.flatMap((m) => [...m.keys()]))];
  const flips = ids.flatMap((ruleId) => {
    const counts: Record<string, number> = {};
    for (const m of verdictRuns) {
      const v = m.get(ruleId) ?? "missing";
      counts[v] = (counts[v] ?? 0) + 1;
    }
    const rate = 1 - Math.max(...Object.values(counts)) / verdictRuns.length;
    return rate > MAX_FLIP_RATE ? [{ ruleId, rate, counts }] : [];
  });
  return { mean, sd, flips, pass: sd <= MAX_SD && flips.length === 0 };
}
