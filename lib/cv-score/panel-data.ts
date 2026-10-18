import "server-only";
import { and, desc, eq } from "drizzle-orm";
import type { Archetype, Year } from "@/lib/types";
import { db } from "@/lib/db/client";
import { cvs, cvScores } from "@/lib/db/schema";
import type { CvRule, Dimension, Track } from "@/lib/cv-rules/types";
import { rulesFor } from "@/lib/cv-rules";
import { aggregateCvScore, type CvScore, type Fix } from "./aggregate";
import type { ScoredRuleResult } from "./context";
import { prepareJudgeInput } from "./pii";
import { historyTotals, type HistoryRow } from "./present";
import { disputedRuleIds } from "./feedback";

/** Everything the CV Score panel renders. Plain, serialisable data: no raw CV text ever reaches it. */
export type CvScorePanelData = {
  cvId: string;
  sector: Archetype;
  track: Track;
  total: number;
  dimensions: Record<Dimension, number | null>;
  capsApplied: string[];
  fixes: Fix[];
  assessed: number;
  passed: number;
  couldNotAssess: number;
  /** This user's past totals for this sector, oldest first (personal sparkline; no leaderboards). */
  history: number[];
  /** "What our AI saw": the redacted text the judge received (prepareJudgeInput), never the raw CV. */
  aiSaw: string | null;
  /** The AI review failed when this was scored: the score is the automatic checks only. */
  aiUnavailable: boolean;
  /** Too little was assessed for a confident number: show `range`, no band (audit 04#1). */
  provisional: boolean;
  range: { low: number; high: number } | null;
  /** Share of the applicable rule weight assessed (0–1); null on rows scored before it was recorded. */
  coverage: number | null;
  /** The model that judged this score (e.g. "anthropic:claude-sonnet-5-5"); null on older rows. */
  scoredBy: string | null;
  /** The CV was rendered by Placed's tailor, so the judge is the same AI family that rewrote it (04#28). */
  madeByPlaced: boolean;
  /** Rules this user said "I disagree" on for this CV and sector: shown as disputed, still counted (04#25). */
  disputed: string[];
  /** After an edit, how many verdicts were kept from the earlier CV and how many the AI re-checked (04#9, #30). */
  delta: { reused: number; rejudged: number } | null;
};

type ScoreRow = {
  total: number; dimensions: Record<Dimension, number | null>; caps_applied: string[] | null; fixes: Fix[] | null;
  rule_results: StoredResults | null;
};
type StoredResults = {
  code?: ScoredRuleResult[]; llm?: ScoredRuleResult[]; couldNotAssess?: number; assessed?: number; passed?: number; aiUnavailable?: boolean;
  scoredBy?: string; provisional?: boolean; coverage?: number; range?: { low: number; high: number };
  madeByPlaced?: boolean; delta?: { reused: number; rejudged: number };
};

/**
 * History points comparable with the current score (04#10, #11, #28): same judge model, never a provisional or
 * AI-unavailable run, and never mixing CVs made by Placed's tailor with the student's own (the judge may favour its
 * own family's writing, so a tailored-vs-original rise isn't evidence). Rows without a recorded model are left out.
 */
export function comparableHistory<T extends { rule_results: StoredResults | null }>(rows: T[], scoredBy: string | null, madeByPlaced = false): T[] {
  if (!scoredBy) return [];
  return rows.filter((r) => r.rule_results?.scoredBy === scoredBy && !r.rule_results.provisional && !r.rule_results.aiUnavailable
    && (r.rule_results.madeByPlaced === true) === madeByPlaced);
}

/**
 * "Rules passed X/Y" counts for a stored cv_scores row. Rows scored since Task 18b persist them (run.ts);
 * older rows fall back to re-aggregating the stored verdicts. The fallback passes neutral cap facts: caps only
 * clamp the total, so assessed/passed/couldNotAssess never depend on them (tests/cv-score/panel-data.test.ts).
 */
export function storedCounts(rr: StoredResults | null, rules: CvRule[], sector: Archetype, year: Year, track: Track = "standard"): { assessed: number; passed: number; couldNotAssess: number } {
  if (rr && typeof rr.assessed === "number" && typeof rr.passed === "number") {
    return { assessed: rr.assessed, passed: rr.passed, couldNotAssess: rr.couldNotAssess ?? 0 };
  }
  const results = [...(rr?.code ?? []), ...(rr?.llm ?? [])];
  const c = aggregateCvScore({ rules, results, sector, year, track, facts: NEUTRAL_FACTS });
  return { assessed: c.assessed, passed: c.passed, couldNotAssess: rr?.couldNotAssess ?? c.couldNotAssess };
}
const NEUTRAL_FACTS = { imageOnly: false, spellingErrors: 0, hasPhone: true, hasEmail: true };

/**
 * Server-only loader for the profile page (Task 19). Pass `score` straight from scoreCv() to skip the
 * cv_scores read; otherwise the stored row for (cvId, sector) is used. Returns null when nothing is scored yet.
 * Every read is scoped to `userId`.
 */
export async function loadCvScorePanel(
  i: {
    userId: string; cvId: string; sector: Archetype; year: Year; track?: Track;
    score?: CvScore & { aiUnavailable?: boolean; scoredBy?: string; madeByPlaced?: boolean; delta?: { reused: number; rejudged: number } | null };
  },
): Promise<CvScorePanelData | null> {
  const track: Track = i.track ?? "standard";
  const scoreRow = i.score ? undefined : db.select({
    total: cvScores.total, dimensions: cvScores.dimensions, caps_applied: cvScores.caps_applied, fixes: cvScores.fixes, rule_results: cvScores.rule_results,
  }).from(cvScores).where(and(eq(cvScores.user_id, i.userId), eq(cvScores.cv_id, i.cvId), eq(cvScores.sector, i.sector), eq(cvScores.track, track))).get() as ScoreRow | undefined;
  const cv = db.select({ raw_text: cvs.raw_text, parsed_json: cvs.parsed_json }).from(cvs)
    .where(and(eq(cvs.id, i.cvId), eq(cvs.user_id, i.userId))).get();
  const histRows = db.select({ total: cvScores.total, created_at: cvScores.created_at, uploaded_at: cvs.uploaded_at, rule_results: cvScores.rule_results })
    .from(cvScores).innerJoin(cvs, eq(cvs.id, cvScores.cv_id))
    .where(and(eq(cvScores.user_id, i.userId), eq(cvScores.sector, i.sector), eq(cvScores.track, track))).orderBy(desc(cvScores.created_at)).limit(20).all() as
    { total: number; created_at: string; uploaded_at: string; rule_results: StoredResults | null }[];

  let core: Pick<CvScorePanelData, "total" | "dimensions" | "capsApplied" | "fixes" | "assessed" | "passed" | "couldNotAssess" | "aiUnavailable" | "provisional" | "range" | "coverage" | "scoredBy" | "madeByPlaced" | "delta">;
  if (i.score) {
    const s = i.score;
    core = {
      total: s.total, dimensions: s.dimensions, capsApplied: s.capsApplied, fixes: s.fixes, assessed: s.assessed, passed: s.passed,
      couldNotAssess: s.couldNotAssess, aiUnavailable: s.aiUnavailable === true,
      provisional: s.provisional || s.aiUnavailable === true, range: s.range, coverage: s.coverage, scoredBy: s.scoredBy ?? null,
      madeByPlaced: s.madeByPlaced === true, delta: s.delta ? { reused: s.delta.reused, rejudged: s.delta.rejudged } : null,
    };
  } else {
    const row = scoreRow;
    if (!row) return null;
    const rr = row.rule_results;
    // Total, dimensions, caps and fixes stay exactly as stored.
    core = {
      total: row.total, dimensions: row.dimensions, capsApplied: row.caps_applied ?? [], fixes: row.fixes ?? [],
      ...storedCounts(rr, rulesFor(i.sector, track), i.sector, i.year, track),
      aiUnavailable: rr?.aiUnavailable === true,
      provisional: rr?.provisional === true || rr?.aiUnavailable === true,
      range: rr?.range ?? null, coverage: rr?.coverage ?? null, scoredBy: rr?.scoredBy ?? null,
      madeByPlaced: rr?.madeByPlaced === true, delta: rr?.delta ? { reused: rr.delta.reused, rejudged: rr.delta.rejudged } : null,
    };
  }
  const hist: HistoryRow[] = comparableHistory(histRows, core.scoredBy, core.madeByPlaced)
    .map((r) => ({ total: r.total, created_at: r.created_at, cvs: { uploaded_at: r.uploaded_at } }));

  let aiSaw: string | null = null;
  if (cv?.parsed_json) {
    try { aiSaw = prepareJudgeInput(cv.parsed_json, cv.raw_text ?? "").redactedText; }
    catch (e) { console.error("cv score panel: redaction failed", e); }
  }

  let disputed: string[] = [];
  try { disputed = disputedRuleIds(i.userId, i.cvId, i.sector); } catch (e) { console.error("cv score panel: feedback read failed", e); }

  return { cvId: i.cvId, sector: i.sector, track, ...core, history: historyTotals(hist), aiSaw, disputed };
}
