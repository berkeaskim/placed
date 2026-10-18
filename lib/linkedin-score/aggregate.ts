import type { Archetype, Year } from "@/lib/types";
import { CREDIT, EVID, SEV } from "@/lib/cv-score/aggregate";
import { LI_DIMENSION_WEIGHTS, LI_DIMS, liEffectiveSeverity, type Citation, type Evidence, type LiDimension, type LiResolvedRule, type Severity } from "@/lib/linkedin-rules";
import type { ScoredRuleResult } from "./context";

/** Scored dimensions: presence is advisory (weight 0) and never enters the total. */
export const LI_SCORED_DIMS = LI_DIMS.filter((d) => d !== "presence");

export const CRITICAL_CAP = 59;
export const EMPTY_PROFILE_CAP = 40;
export const CRITICAL_CAP_LABEL = `A critical issue was found: capped at ${CRITICAL_CAP}`;
export const EMPTY_PROFILE_CAP_LABEL = `Profile is nearly empty: capped at ${EMPTY_PROFILE_CAP}`;

export type LiLabel = "Ready" | "Nearly there" | "Needs work" | "Starter";
/** Bands chosen so the 59 critical cap always lands below "Nearly there" (playbook §3.4). */
export function liLabel(total: number): LiLabel {
  return total >= 80 ? "Ready" : total >= 60 ? "Nearly there" : total >= 40 ? "Needs work" : "Starter";
}

export type LiFix = {
  ruleId: string; statement: string; dimension: LiDimension; severity: Severity; lostPoints: number;
  evidenceLine: string | null; fix: string | null; citation: Citation | null; evidence: Evidence;
  /** Integrity risk (confidential info, misrepresentation): rendered on the Risk card. */
  risk: boolean;
};

export type LiScore = {
  total: number;
  label: LiLabel;
  dimensions: Record<LiDimension, number | null>;
  capsApplied: string[];
  fixes: LiFix[];
  results: ScoredRuleResult[];
  assessed: number;
  passed: number;
  couldNotAssess: number;
  /** Rules that apply to the sector but need input we don't have (screenshot, self-report, contested sections). */
  notCovered: number;
};

export { liEffectiveSeverity };

/**
 * Facts the caps need that rule results alone don't carry. `severityOverrides` sets one result's severity: a
 * single CV date mismatch scores as major (08 #1); a code-detected investment promotion as critical (08 #14).
 */
export type LiFacts = { nearlyEmpty: boolean; severityOverrides?: Partial<Record<string, Severity>> };

/** Deterministic results the scorer adds on top of the judge mark themselves with this detail prefix. */
export const CODE_DETAIL = "code:";

/**
 * Only a failure we can stand behind caps the score at 59 (08 #2): a code check, a deterministic override, or an LLM
 * fail that quotes a line it was verified against AND rests on evidence graded C or better.
 */
export function capEligible(rule: LiResolvedRule, x: ScoredRuleResult): boolean {
  if (rule.check === "code" || x.detail?.startsWith(CODE_DETAIL)) return true;
  return x.evidenceLine !== null && rule.evidence !== "D";
}

/** Same maths as aggregateCvScore (severity × evidence weights, renormalised over assessed dimensions), LinkedIn dimensions and caps. */
export function aggregateLiScore(i: { rules: LiResolvedRule[]; results: ScoredRuleResult[]; sector: Archetype; year: Year; facts: LiFacts }): LiScore {
  const byId = new Map(i.rules.map((r) => [r.id, r]));
  let couldNotAssess = 0;
  let notCovered = 0;
  const scored: { x: ScoredRuleResult; rule: LiResolvedRule; sev: Severity; w: number; credit: number }[] = [];
  for (const x of i.results) {
    const rule = byId.get(x.ruleId);
    if (!rule || rule.advisory || rule.dimension === "presence" || rule.yearAdjust?.[i.year]?.skip) continue;
    if (x.status === "could_not_assess") { couldNotAssess++; continue; }
    if (x.status === "not_applicable") { if (x.detail?.startsWith("input:")) notCovered++; continue; }
    const sev = i.facts.severityOverrides?.[rule.id] ?? liEffectiveSeverity(rule, i.sector, i.year);
    scored.push({ x, rule, sev, w: SEV[sev] * EVID[rule.evidence], credit: CREDIT[x.status] });
  }

  const weights = LI_DIMENSION_WEIGHTS[i.sector];
  const dimensions = { presence: null } as Record<LiDimension, number | null>;
  const dimW = {} as Record<LiDimension, number>;
  for (const d of LI_SCORED_DIMS) {
    const items = scored.filter((s) => s.rule.dimension === d);
    const den = items.reduce((n, s) => n + s.w, 0);
    dimensions[d] = den ? (100 * items.reduce((n, s) => n + s.w * s.credit, 0)) / den : null;
    dimW[d] = den;
  }
  const active = LI_SCORED_DIMS.filter((d) => dimensions[d] !== null);
  const totalWeight = active.reduce((n, d) => n + weights[d], 0);
  let total = totalWeight ? active.reduce((n, d) => n + weights[d] * dimensions[d]!, 0) / totalWeight : 0;

  const capsApplied: string[] = [];
  if (scored.some((s) => s.sev === "critical" && s.credit === 0 && capEligible(s.rule, s.x))) { total = Math.min(total, CRITICAL_CAP); capsApplied.push(CRITICAL_CAP_LABEL); }
  if (i.facts.nearlyEmpty && (i.year === "penultimate" || i.year === "final" || i.year === "masters")) {
    total = Math.min(total, EMPTY_PROFILE_CAP);
    capsApplied.push(EMPTY_PROFILE_CAP_LABEL);
  }

  const fixes: LiFix[] = scored
    .filter((s) => s.credit < 1)
    .map((s) => ({
      ruleId: s.rule.id, statement: s.rule.statement, dimension: s.rule.dimension, severity: s.sev,
      lostPoints: Math.round(((weights[s.rule.dimension] / Math.max(1, totalWeight)) * 100 * s.w * (1 - s.credit)) / dimW[s.rule.dimension]),
      evidenceLine: s.x.evidenceLine, fix: s.x.fix, citation: s.rule.citations[0] ?? null, evidence: s.rule.evidence,
      risk: s.rule.dimension === "integrity" && (s.sev === "critical" || s.rule.riskFlag === true),
    }))
    .sort((a, b) => Number(b.risk) - Number(a.risk) || b.lostPoints - a.lostPoints || (a.ruleId < b.ruleId ? -1 : 1));

  for (const d of LI_SCORED_DIMS) if (dimensions[d] !== null) dimensions[d] = Math.round(dimensions[d]!);
  const rounded = Math.round(total);
  return {
    total: rounded, label: liLabel(rounded), dimensions, capsApplied, fixes, results: i.results,
    assessed: scored.length, passed: scored.filter((s) => s.credit === 1).length, couldNotAssess, notCovered,
  };
}
