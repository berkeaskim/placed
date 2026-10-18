/**
 * "I disagree" feedback (audit 2026-10-18, 04#25; DSIT Responsible AI in Recruitment, 2024: contestability needs a
 * route to redress). Each disagreement is stored per rule (cv_feedback). Here it is (1) shown back on that verdict as
 * "disputed" (never hidden, never auto-flipped: the score is unchanged) and (2) rolled up into a rule-review report
 * (`npm run validate:feedback`) that ranks rules by how often students dispute them when they're shown.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cvFeedback, cvScores } from "@/lib/db/schema";
import type { Fix } from "./aggregate";
import { wilson } from "./reliability";
import { splitFixes } from "./present";

/** Audit 04#25: a rule disputed on more than 15% of showings, over at least 20 showings, goes to rule review. */
export const DISPUTE_RATE_FLAG = 0.15;
export const DISPUTE_MIN_SHOWN = 20;

/** The fixes the panel actually shows for a stored score (next best fix + up to 4 more), so the only ones a student could dispute. */
export function shownRuleIds(fixes: Fix[]): string[] {
  const { next, rest } = splitFixes(fixes, 4);
  return [...(next ? [next] : []), ...rest].map((f) => f.ruleId);
}

export type DisputeRow = { ruleId: string; shown: number; disputed: number; rate: number; ci: [number, number]; flagged: boolean };

/**
 * Dispute rate per rule. A showing is one (CV, sector) where the rule was on screen as a fix; repeated clicks on the
 * same showing count once. A dispute without a matching showing (the score was re-run since) still counts as shown.
 */
export function disputeReport(i: {
  shown: { cvId: string; sector: string; ruleIds: string[] }[];
  feedback: { cvId: string | null; sector: string; ruleId: string }[];
}): DisputeRow[] {
  const shown = new Map<string, Set<string>>();
  const disputed = new Map<string, Set<string>>();
  const add = (m: Map<string, Set<string>>, ruleId: string, key: string) => { if (!m.has(ruleId)) m.set(ruleId, new Set()); m.get(ruleId)!.add(key); };
  for (const s of i.shown) for (const r of s.ruleIds) add(shown, r, `${s.cvId}|${s.sector}`);
  for (const f of i.feedback) {
    const key = `${f.cvId ?? "deleted"}|${f.sector}`;
    add(disputed, f.ruleId, key);
    add(shown, f.ruleId, key);
  }
  return [...shown.entries()].map(([ruleId, s]): DisputeRow => {
    const n = s.size, k = disputed.get(ruleId)?.size ?? 0, rate = n ? k / n : 0;
    return { ruleId, shown: n, disputed: k, rate, ci: wilson(k, n), flagged: n >= DISPUTE_MIN_SHOWN && rate > DISPUTE_RATE_FLAG };
  }).sort((a, b) => b.rate - a.rate || b.disputed - a.disputed || a.ruleId.localeCompare(b.ruleId));
}

/** Everything the report needs, read from the local database. */
export function loadDisputeData(): Parameters<typeof disputeReport>[0] {
  const scores = db.select({ cv_id: cvScores.cv_id, sector: cvScores.sector, fixes: cvScores.fixes }).from(cvScores).all() as { cv_id: string; sector: string; fixes: Fix[] | null }[];
  const fb = db.select({ cv_id: cvFeedback.cv_id, sector: cvFeedback.sector, rule_id: cvFeedback.rule_id }).from(cvFeedback).all();
  return {
    shown: scores.map((s) => ({ cvId: s.cv_id, sector: s.sector, ruleIds: shownRuleIds(s.fixes ?? []) })),
    feedback: fb.map((f) => ({ cvId: f.cv_id, sector: f.sector, ruleId: f.rule_id })),
  };
}

/** Rule ids this user has disputed for this CV and sector (shown as "Disputed" on those verdicts). */
export function disputedRuleIds(userId: string, cvId: string, sector: string): string[] {
  const rows = db.select({ rule_id: cvFeedback.rule_id }).from(cvFeedback)
    .where(and(eq(cvFeedback.user_id, userId), eq(cvFeedback.cv_id, cvId), eq(cvFeedback.sector, sector))).all();
  return [...new Set(rows.map((r) => r.rule_id))].sort();
}

/** Has this user already disputed this verdict? (One row per verdict, so repeated clicks don't inflate the report.) */
export function alreadyDisputed(userId: string, cvId: string, sector: string, ruleId: string): boolean {
  return Boolean(db.select({ id: cvFeedback.id }).from(cvFeedback)
    .where(and(eq(cvFeedback.user_id, userId), eq(cvFeedback.cv_id, cvId), eq(cvFeedback.sector, sector), eq(cvFeedback.rule_id, ruleId))).get());
}

export function renderDisputeReport(rows: DisputeRow[], date: string): string {
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const lines = [
    "# CV score: rule disputes", "",
    `Generated ${date}. A showing is one CV and sector where the rule was on screen as a fix. Rules disputed on more than ${pct(DISPUTE_RATE_FLAG)} of at least ${DISPUTE_MIN_SHOWN} showings are flagged for review.`, "",
  ];
  if (!rows.length) return [...lines, "No fixes shown yet, so nothing to report."].join("\n") + "\n";
  lines.push("| Rule | Shown | Disputed | Rate (95% CI) | Review |", "|---|---|---|---|---|");
  for (const r of rows) lines.push(`| ${r.ruleId} | ${r.shown} | ${r.disputed} | ${pct(r.rate)} (${pct(r.ci[0])}–${pct(r.ci[1])}) | ${r.flagged ? "REVIEW" : r.shown < DISPUTE_MIN_SHOWN && r.disputed ? "too few showings" : ""} |`);
  const flagged = rows.filter((r) => r.flagged).map((r) => r.ruleId);
  lines.push("", flagged.length ? `Flagged for review: ${flagged.join(", ")}` : "No rule is flagged yet.");
  return lines.join("\n") + "\n";
}
