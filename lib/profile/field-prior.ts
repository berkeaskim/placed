import type { Archetype, ArchetypeScore } from "@/lib/types";

/**
 * Field prior for the default target sector (research/placement-year/07 §4.3). When the CV or quiz signal is weak
 * (top score under 30) or tied, the student's degree field nudges the ranking: an engineering student with a thin CV
 * starts on engineering, not software. Never used to override a target the student picked.
 */
const PRIOR: Partial<Record<string, Partial<Record<Archetype, number>>>> = {
  Engineering: { engineering: 20 },
  "Natural Sciences": { science_pharma: 20, research: 10 },
};
const WEAK = 30;

export function withFieldPrior(scores: ArchetypeScore[], field: string | null | undefined): ArchetypeScore[] {
  const prior = field ? PRIOR[field] : undefined;
  if (!prior) return scores;
  const [a, b] = [...scores].sort((x, y) => y.score - x.score);
  const weak = !a || a.score < WEAK || (b !== undefined && b.score === a.score);
  if (!weak) return scores;
  const raw = new Map(scores.map((s) => [s.key, { ...s }]));
  for (const [key, add] of Object.entries(prior) as [Archetype, number][]) {
    const cur = raw.get(key);
    const why = `Fits your field: ${field}`;
    raw.set(key, cur ? { ...cur, score: cur.score + add, why: [...cur.why, why].slice(0, 3) } : { key, score: add, why: [why] });
  }
  // Sort on the unclamped score, the field's own sector first on a tie; then clamp for display.
  const bonus = (k: Archetype) => prior[k] ?? 0;
  return [...raw.values()].sort((x, y) => y.score - x.score || bonus(y.key) - bonus(x.key)).map((s) => ({ ...s, score: Math.min(100, s.score) }));
}
