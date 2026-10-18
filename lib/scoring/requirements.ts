import type { Importance, Requirement } from "@/lib/types";
import { escapeRegex } from "@/lib/text/regex";

/**
 * Requirement table (spec §7.2) and the job-detail headline (amendment B10). Pure and client-safe:
 * the "use client" explain panel imports its types and helpers from here, never from lib/ai.
 */

export type RequirementMatch = "strong" | "partial" | "missing";

export type RequirementRow = {
  text: string;
  skill: string | null;
  importance: Importance;
  evidenceTier: Requirement["evidenceTier"];
  match: RequirementMatch;
  /** Strong rows quote the CV line verbatim. */
  cvEvidence: string | null;
};

export type ExplanationGap = { requirement: string; blocking: boolean; adjacentExperience: string | null; howToClose: string };

/**
 * C5: the Explanation type lives here (client-safe); lib/ai/explainMatch re-exports it. `checks`: requirements a CV
 * can't show (right to work, degree, language, years of experience); the student checks them, they are not gaps (10#13).
 */
export type Explanation = { rows: RequirementRow[]; whyFit: string[]; gaps: ExplanationGap[]; checks?: string[] };

// ---------- requirement kinds (10#13) ----------

export type RequirementKind = "skill" | "eligibility" | "degree" | "experience" | "language" | "behaviour";
const SOFT = new Set(["communication", "teamwork", "leadership", "problem solving", "stakeholder management"]);
const KIND_RULES: [RequirementKind, RegExp][] = [
  ["eligibility", /\b(right to work|work permit|visa|sponsorship|eligible to work|security clearance|nationality|citizen(ship)?|driving licen[cs]e)\b/i],
  ["experience", /\b\d+\s*\+?\s*(?:-\s*\d+\s*)?(years?|yrs?)['’]?\s+(of\s+)?(\w+\s+)?experience\b/i],
  ["language", /\b(fluent|fluency|native|business[- ]level)\b[^.]{0,30}\b(english|french|german|spanish|italian|mandarin|chinese|japanese|arabic|portuguese|dutch|russian|cantonese|korean)\b|\b(french|german|spanish|italian|mandarin|japanese|arabic|portuguese|dutch|russian|cantonese|korean)\b[^.]{0,20}\b(fluent|fluency|native|speaker|level)\b/i],
  ["degree", /\b(degree|2[:.]1|2[:.]2|first[- ]class|upper second|lower second|graduat\w*|penultimate|final[- ]year|undergraduate|bachelor'?s?|master'?s|phd|ucas|a[- ]levels?|predicted grades?|grade requirements?)\b/i],
  ["behaviour", /\b(team ?work|team player|communicat\w*|leadership|problem[- ]solving|stakeholder|interpersonal|attention to detail|motivat\w*|curio\w*|resilien\w*|organi[sz](ed|ational)|proactive|self[- ]starter|enthusias\w*|passion\w*|work ethic|initiative)\b/i],
];

/** What kind of requirement this is. A named, non-soft skill is always "skill"; otherwise the wording decides. */
export function requirementKind(r: { text: string; skill: string | null }): RequirementKind {
  if (r.skill && !SOFT.has(r.skill.toLowerCase())) return "skill";
  for (const [kind, re] of KIND_RULES) if (re.test(r.text)) return kind;
  return r.skill ? "behaviour" : "skill";
}

/** Kinds a CV can't evidence: listed for the student to check, never scored as a gap. */
export const CHECK_KINDS: ReadonlySet<RequirementKind> = new Set(["eligibility", "degree", "experience", "language"]);

export const IMPORTANCE_RANK: Record<Importance, number> = { critical: 0, high: 1, meaningful: 2, preferred: 3, low_signal: 4 };
const MATCH_RANK: Record<RequirementMatch, number> = { missing: 0, partial: 1, strong: 2 };
export const MAX_REQUIREMENT_ROWS = 12;

export const isMustHave = (i: Importance) => IMPORTANCE_RANK[i] <= IMPORTANCE_RANK.high;

/** Two-pass rule: an `inferred` requirement can never be critical or high. */
export function capImportance(importance: Importance, evidenceTier: Requirement["evidenceTier"]): Importance {
  return evidenceTier === "inferred" && IMPORTANCE_RANK[importance] < IMPORTANCE_RANK.meaningful ? "meaningful" : importance;
}

/** Inferred cap, then importance order (unmet before met within a band); ≤12 rows, but every critical/high row is kept. */
export function orderRequirementRows(rows: RequirementRow[]): RequirementRow[] {
  const capped = rows.map((r) => {
    const importance = capImportance(r.importance, r.evidenceTier);
    return importance === r.importance ? r : { ...r, importance };
  });
  const sorted = capped
    .map((r, i) => ({ r, i }))
    .sort((a, b) => IMPORTANCE_RANK[a.r.importance] - IMPORTANCE_RANK[b.r.importance] || MATCH_RANK[a.r.match] - MATCH_RANK[b.r.match] || a.i - b.i)
    .map((x) => x.r);
  const keep = sorted.filter((r) => isMustHave(r.importance));
  const rest = sorted.filter((r) => !isMustHave(r.importance));
  return [...keep, ...rest.slice(0, Math.max(0, MAX_REQUIREMENT_ROWS - keep.length))];
}

// ---------- B10 headline: "Must-haves met: X/Y" ----------

export type MustHaves = { met: number; partial: number; total: number };

/** Critical/high rows (after the inferred cap). Only Strong counts as met; Partial is reported separately and is NOT met. */
export function mustHavesMet(rows: RequirementRow[]): MustHaves {
  const must = rows.filter((r) => isMustHave(capImportance(r.importance, r.evidenceTier)));
  return {
    met: must.filter((r) => r.match === "strong").length,
    partial: must.filter((r) => r.match === "partial").length,
    total: must.length,
  };
}

export function mustHavesLabel(m: MustHaves): string {
  return m.total === 0 ? "No must-haves stated" : `Must-haves met: ${m.met}/${m.total}`;
}

// ---------- Findability (keyword coverage, shown second; never a "pass mark" percentage) ----------

export type FindabilityBand = "Strong" | "Good" | "Partial" | "Limited";

/** Lower bounds on weighted keyword coverage (0-1). Hand-set defaults: Strong ≥ 0.75, Good ≥ 0.5, Partial ≥ 0.25, else Limited. */
export const FINDABILITY_THRESHOLDS = { strong: 0.75, good: 0.5, partial: 0.25 } as const;

export function findabilityBand(c: { readable: boolean; weighted: number | null }): FindabilityBand | null {
  if (!c.readable || c.weighted === null) return null;
  if (c.weighted >= FINDABILITY_THRESHOLDS.strong) return "Strong";
  if (c.weighted >= FINDABILITY_THRESHOLDS.good) return "Good";
  if (c.weighted >= FINDABILITY_THRESHOLDS.partial) return "Partial";
  return "Limited";
}

/** Shown with every band (10#27): the bands are hand-set, and no ATS vendor publishes a threshold. */
export const FINDABILITY_NOTE = "No ATS publishes a pass mark, so treat this as a rough guide.";

export const FINDABILITY_HINT: Record<FindabilityBand, string> = {
  Strong: "Your CV already uses most of the words this posting uses.",
  Good: "Your CV uses many of this posting's words.",
  Partial: "Some of this posting's key words are missing from your CV.",
  Limited: "Few of this posting's key words appear in your CV.",
};

// ---------- Stuffing warning ----------

/** A stock-phrase-heavy CV only gets the warning when coverage is above this (it reads as keyword-chasing). */
export const STUFFING_COVERAGE_MIN = 0.85;
/**
 * A single JD skill written this many times or more (whole word) in the CV text counts as stuffing. 8 was extreme for a
 * one-page student CV; real stuffing shows at 4–5 (competitor teardown, about 5×) (10#27). Hand-set default.
 */
export const STUFFING_REPEAT_MIN = 5;

export function keywordStuffing(cvText: string, skills: string[]): boolean {
  if (!cvText) return false;
  for (const s of new Set(skills.map((x) => x.trim()).filter(Boolean))) {
    const re = new RegExp(`(?<![\\w+#])${escapeRegex(s)}(?![\\w+#])`, "gi");
    if ((cvText.match(re) ?? []).length >= STUFFING_REPEAT_MIN) return true;
  }
  return false;
}

/** Repetition is stuffing at any coverage; heavy stock phrasing only matters when the CV also chases every keyword. */
export function shouldWarnStuffing(i: { weighted: number | null; clicheSeverity: "ok" | "minor" | "major"; stuffed: boolean }): boolean {
  return i.stuffed || (i.weighted !== null && i.weighted > STUFFING_COVERAGE_MIN && i.clicheSeverity === "major");
}
