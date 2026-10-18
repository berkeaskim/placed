import type { Archetype, Year } from "@/lib/types";
import type { Citation, CvRule, Dimension, Evidence, Severity, Track } from "@/lib/cv-rules/types";
import { weightsFor } from "@/lib/cv-rules/profiles";
import { adjustFor, resolvedCitations, resolvedSeverity, resolvedStatement } from "@/lib/cv-rules/adjust";
import type { ScoredRuleResult } from "./context";

export const SEV: Record<Severity, number> = { critical: 3, major: 2, minor: 1 };
/** Evidence grades are shown as tags and cap severity (resolvedSeverity); they no longer multiply the weight (audit 04#8). */
export const EVID: Record<Evidence, number> = { A: 1, B: 0.85, C: 0.6, D: 0.4 };
export const CREDIT = { pass: 1, partial: 0.5, fail: 0 } as const;
/** A rule the judge couldn't assess counts at half credit: the midpoint of "it fails" and "it passes" (04#1). */
export const UNASSESSED_CREDIT = 0.5;
export const DIMS: Dimension[] = ["ats", "impact", "clarity", "relevance", "uk"];

/** Below this share of the applicable rule weight assessed, the score is provisional: a range, no band (04#1). */
export const PROVISIONAL_COVERAGE = 0.8;
/** A dimension with less than this share of its weight assessed is shown as "—" and makes the score provisional (04#6). */
export const DIMENSION_MIN_COVERAGE = 0.5;

export type Fix = {
  ruleId: string; statement: string; dimension: Dimension;
  /** Rounded `gain` (kept for rows stored before the audit fixes). */
  lostPoints: number;
  /** Real points gained if this rule passed, from re-running the aggregation with caps re-applied (04#5). */
  gain: number;
  evidenceLine: string | null; fix: string | null;
  citation: Citation | null; evidence: Evidence; convention: boolean;
};
export type CvScore = {
  /** Rounded point score. When `provisional`, show `range` instead. */
  total: number;
  /** Unrounded total (tests and gain maths). */
  exactTotal: number;
  dimensions: Record<Dimension, number | null>;
  capsApplied: string[];
  fixes: Fix[];
  results: ScoredRuleResult[];
  /** Rules with a verdict (pass/partial/fail, not skipped by year or not applicable). */
  assessed: number;
  /** Of `assessed`, fully passed. ("rules passed 23/31") */
  passed: number;
  /** Rules the judge couldn't assess: misquoted evidence, a missing verdict, a dodged not_applicable, or an AI failure. */
  couldNotAssess: number;
  /** Share of the applicable rule weight that has a verdict (0–1). */
  coverage: number;
  /** Coverage per dimension (null: no applicable rules). */
  dimensionCoverage: Record<Dimension, number | null>;
  /** Too little was assessed to show a confident number: show `range` and no band. */
  provisional: boolean;
  /** Total if every unassessed rule failed (low) or passed (high). Equal to `total` when coverage is 1. */
  range: { low: number; high: number };
};
/** Cap label for an image-only / unreadable PDF; the panel keys the quiz link off this exact value. */
export const IMAGE_ONLY_CAP = "Image-only PDF: capped at 50";
export const CONTACT_CAP = "No phone or email: capped at 40";

/** `spellingErrors` is kept for callers but no longer caps the score (04#3): the spelling rule carries a graded penalty. */
export type ScoreFacts = { imageOnly: boolean; spellingErrors?: number; hasPhone: boolean; hasEmail: boolean };

/** Severity: base, then sectorAdjust, then the track's or year's adjustment, capped by evidence (only A/B can be critical). */
export function effectiveSeverity(rule: CvRule, sector: Archetype, year: Year, track: Track = "standard"): Severity {
  return resolvedSeverity(rule, sector, year, track);
}

/**
 * A rule's weight in the total: severity × the sector's emphasis on its dimension (04#7). The emphasis is
 * sqrt(dimension weight / 20), so the sector profile can tilt a rule at most about 3× (5% vs 45% in quant),
 * and adding a rule to a dimension no longer silently devalues the others in it. A critical rule is never worth
 * less than a minor one in the same sector (tests/cv-score/aggregate-integrity.test.ts).
 */
export function ruleWeight(rule: CvRule, sector: Archetype, year: Year, track: Track = "standard"): number {
  return SEV[resolvedSeverity(rule, sector, year, track)] * Math.sqrt(weightsFor(sector, track)[rule.dimension] / 20);
}

type Item = { x: ScoredRuleResult; rule: CvRule; w: number; credit: number | null };

/** A judged rule may only be not_applicable if it says when, or if it lacked context it needs (resolved before judging). */
function legitimatelyNa(rule: CvRule, x: ScoredRuleResult): boolean {
  if (rule.check === "code") return true;
  return rule.naAllowed === true || (!!rule.needs?.length && (x.detail ?? "").startsWith("needs:"));
}

type Totals = { exact: number; capsApplied: string[]; low: number; high: number };

function totals(items: Item[], facts: ScoreFacts): Totals {
  let den = 0, num = 0, lowNum = 0, highNum = 0;
  for (const s of items) {
    den += s.w;
    num += s.w * (s.credit ?? UNASSESSED_CREDIT);
    lowNum += s.w * (s.credit ?? 0);
    highNum += s.w * (s.credit ?? 1);
  }
  const caps: string[] = [];
  let cap = Infinity;
  if (facts.imageOnly) { cap = Math.min(cap, 50); caps.push(IMAGE_ONLY_CAP); }
  if (!facts.hasPhone && !facts.hasEmail) { cap = Math.min(cap, 40); caps.push(CONTACT_CAP); }
  const pct = (n: number) => Math.min(cap, den ? (100 * n) / den : 0);
  return { exact: pct(num), capsApplied: caps, low: pct(lowNum), high: pct(highNum) };
}

/** Facts as they'd be if this rule passed: the text-layer and contact rules are what lift their caps. */
function factsIfPassed(rule: CvRule, f: ScoreFacts): ScoreFacts {
  if (rule.checker === "text_layer") return { ...f, imageOnly: false };
  if (rule.checker === "contact_present") return { ...f, hasPhone: true, hasEmail: true };
  return f;
}

/** Spec §6.3 (as amended by the 2026-10-18 audit): pure aggregation of rule results into the 0–100 CV Score. */
export function aggregateCvScore(i: { rules: CvRule[]; results: ScoredRuleResult[]; sector: Archetype; year: Year; track?: Track; facts: ScoreFacts }): CvScore {
  const byId = new Map(i.rules.map((r) => [r.id, r]));
  const items: Item[] = [];
  const seen = new Set<string>();
  for (const x of i.results) {
    const rule = byId.get(x.ruleId);
    if (!rule || seen.has(rule.id) || adjustFor(rule, i.year, i.track, i.sector)?.skip) continue;
    seen.add(rule.id);
    const w = ruleWeight(rule, i.sector, i.year, i.track);
    if (x.status === "could_not_assess") items.push({ x, rule, w, credit: null });
    else if (x.status === "not_applicable") { if (!legitimatelyNa(rule, x)) items.push({ x, rule, w, credit: null }); }
    else items.push({ x, rule, w, credit: CREDIT[x.status] });
  }

  const now = totals(items, i.facts);
  const dimensions = {} as Record<Dimension, number | null>;
  const dimensionCoverage = {} as Record<Dimension, number | null>;
  let thinDimension = false;
  for (const d of DIMS) {
    const inDim = items.filter((s) => s.rule.dimension === d);
    const all = inDim.reduce((n, s) => n + s.w, 0);
    const assessed = inDim.filter((s) => s.credit !== null);
    const aw = assessed.reduce((n, s) => n + s.w, 0);
    dimensionCoverage[d] = all ? aw / all : null;
    const cov = dimensionCoverage[d];
    if (cov !== null && cov < DIMENSION_MIN_COVERAGE) thinDimension = true;
    dimensions[d] = aw && cov !== null && cov >= DIMENSION_MIN_COVERAGE ? Math.round((100 * assessed.reduce((n, s) => n + s.w * s.credit!, 0)) / aw) : null;
  }
  const allW = items.reduce((n, s) => n + s.w, 0);
  const coverage = allW ? items.filter((s) => s.credit !== null).reduce((n, s) => n + s.w, 0) / allW : 0;

  const fixes: Fix[] = items
    .filter((s) => s.credit !== null && s.credit < 1)
    .map((s) => {
      const after = totals(items.map((t) => (t === s ? { ...t, credit: 1 } : t)), factsIfPassed(s.rule, i.facts));
      const gain = Math.max(0, after.exact - now.exact);
      return {
        ruleId: s.rule.id, statement: resolvedStatement(s.rule, i.sector), dimension: s.rule.dimension,
        lostPoints: Math.round(gain), gain,
        evidenceLine: s.x.evidenceLine, fix: s.x.fix, citation: resolvedCitations(s.rule, i.sector)[0] ?? null, evidence: s.rule.evidence,
        convention: s.rule.evidence === "C" || s.rule.evidence === "D",
      };
    })
    .sort((a, b) => b.gain - a.gain || (a.ruleId < b.ruleId ? -1 : 1));

  const assessed = items.filter((s) => s.credit !== null);
  return {
    total: Math.round(now.exact), exactTotal: now.exact, dimensions, capsApplied: now.capsApplied, fixes, results: i.results,
    assessed: assessed.length, passed: assessed.filter((s) => s.credit === 1).length,
    couldNotAssess: items.length - assessed.length,
    coverage, dimensionCoverage,
    provisional: allW > 0 && (coverage < PROVISIONAL_COVERAGE || thinDimension),
    range: { low: Math.round(now.low), high: Math.round(now.high) },
  };
}
