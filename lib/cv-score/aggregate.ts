import type { Archetype, Year } from "@/lib/types";
import type { Citation, CvRule, Dimension, Evidence, Severity, Track } from "@/lib/cv-rules/types";
import { weightsFor } from "@/lib/cv-rules/profiles";
import { adjustFor } from "@/lib/cv-rules/adjust";
import type { ScoredRuleResult } from "./context";

export const SEV: Record<Severity, number> = { critical: 3, major: 2, minor: 1 };
export const EVID: Record<Evidence, number> = { A: 1, B: 0.85, C: 0.6, D: 0.4 };
export const CREDIT = { pass: 1, partial: 0.5, fail: 0 } as const;
export const DIMS: Dimension[] = ["ats", "impact", "clarity", "relevance", "uk"];

export type Fix = {
  ruleId: string; statement: string; dimension: Dimension; lostPoints: number; evidenceLine: string | null; fix: string | null;
  citation: Citation | null; evidence: Evidence; convention: boolean;
};
export type CvScore = {
  total: number;
  dimensions: Record<Dimension, number | null>;
  capsApplied: string[];
  fixes: Fix[];
  results: ScoredRuleResult[];
  /** Rules that counted towards the score (pass/partial/fail, not skipped by year). */
  assessed: number;
  /** Of `assessed`, fully passed. ("rules passed 23/31") */
  passed: number;
  /** LLM verdicts discarded because their evidence line was not in the CV (A1). */
  couldNotAssess: number;
};
/** Cap label for an image-only / unreadable PDF; the panel keys the quiz link off this exact value. */
export const IMAGE_ONLY_CAP = "Image-only PDF: capped at 50";

export type ScoreFacts = { imageOnly: boolean; spellingErrors: number; hasPhone: boolean; hasEmail: boolean };

/** Severity: base, then sectorAdjust, then the track's or year's adjustment (most specific to the application wins). */
export function effectiveSeverity(rule: CvRule, sector: Archetype, year: Year, track: Track = "standard"): Severity {
  return adjustFor(rule, year, track)?.severity ?? rule.sectorAdjust?.[sector]?.severity ?? rule.severity;
}

/** Spec §6.3: pure aggregation of rule results into the 0–100 CV Score. */
export function aggregateCvScore(i: { rules: CvRule[]; results: ScoredRuleResult[]; sector: Archetype; year: Year; track?: Track; facts: ScoreFacts }): CvScore {
  const byId = new Map(i.rules.map((r) => [r.id, r]));
  let couldNotAssess = 0;
  const scored: { x: ScoredRuleResult; rule: CvRule; w: number; credit: number }[] = [];
  for (const x of i.results) {
    const rule = byId.get(x.ruleId);
    if (!rule || adjustFor(rule, i.year, i.track)?.skip) continue;
    if (x.status === "could_not_assess") { couldNotAssess++; continue; }
    if (x.status === "not_applicable") continue;
    scored.push({ x, rule, w: SEV[effectiveSeverity(rule, i.sector, i.year, i.track)] * EVID[rule.evidence], credit: CREDIT[x.status] });
  }

  const weights = weightsFor(i.sector, i.track);
  const dimensions = {} as Record<Dimension, number | null>;
  const dimW = {} as Record<Dimension, number>;
  for (const d of DIMS) {
    const items = scored.filter((s) => s.rule.dimension === d);
    const den = items.reduce((n, s) => n + s.w, 0);
    dimensions[d] = den ? (100 * items.reduce((n, s) => n + s.w * s.credit, 0)) / den : null;
    dimW[d] = den;
  }
  const active = DIMS.filter((d) => dimensions[d] !== null);
  const totalWeight = active.reduce((n, d) => n + weights[d], 0);
  let total = totalWeight ? active.reduce((n, d) => n + weights[d] * dimensions[d]!, 0) / totalWeight : 0;

  const capsApplied: string[] = [];
  if (i.facts.imageOnly) { total = Math.min(total, 50); capsApplied.push(IMAGE_ONLY_CAP); }
  if (i.facts.spellingErrors >= 3) { total = Math.min(total, 50); capsApplied.push("3+ spelling errors: capped at 50"); }
  if (!i.facts.hasPhone && !i.facts.hasEmail) { total = Math.min(total, 40); capsApplied.push("No phone or email: capped at 40"); }

  const fixes: Fix[] = scored
    .filter((s) => s.credit < 1)
    .map((s) => ({
      ruleId: s.rule.id, statement: s.rule.statement, dimension: s.rule.dimension,
      lostPoints: Math.round(((weights[s.rule.dimension] / Math.max(1, totalWeight)) * 100 * s.w * (1 - s.credit)) / dimW[s.rule.dimension]),
      evidenceLine: s.x.evidenceLine, fix: s.x.fix, citation: s.rule.citations[0] ?? null, evidence: s.rule.evidence,
      convention: s.rule.evidence === "C" || s.rule.evidence === "D",
    }))
    .sort((a, b) => b.lostPoints - a.lostPoints || (a.ruleId < b.ruleId ? -1 : 1));

  for (const d of DIMS) if (dimensions[d] !== null) dimensions[d] = Math.round(dimensions[d]!);
  return {
    total: Math.round(total), dimensions, capsApplied, fixes, results: i.results,
    assessed: scored.length, passed: scored.filter((s) => s.credit === 1).length, couldNotAssess,
  };
}
