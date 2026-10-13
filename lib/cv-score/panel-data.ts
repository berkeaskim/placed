import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Archetype, ParsedCV, Year } from "@/lib/types";
import type { CvRule, Dimension } from "@/lib/cv-rules/types";
import { rulesFor } from "@/lib/cv-rules";
import { aggregateCvScore, type CvScore, type Fix } from "./aggregate";
import type { ScoredRuleResult } from "./context";
import { prepareJudgeInput } from "./pii";
import { historyTotals, type HistoryRow } from "./present";

/** Everything the CV Score panel renders. Plain, serialisable data: no raw CV text ever reaches it. */
export type CvScorePanelData = {
  cvId: string;
  sector: Archetype;
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
};

type ScoreRow = {
  total: number; dimensions: Record<Dimension, number | null>; caps_applied: string[] | null; fixes: Fix[] | null;
  rule_results: StoredResults | null;
};
type StoredResults = { code?: ScoredRuleResult[]; llm?: ScoredRuleResult[]; couldNotAssess?: number; assessed?: number; passed?: number };

/**
 * "Rules passed X/Y" counts for a stored cv_scores row. Rows scored since Task 18b persist them (run.ts);
 * older rows fall back to re-aggregating the stored verdicts. The fallback passes neutral cap facts: caps only
 * clamp the total, so assessed/passed/couldNotAssess never depend on them (tests/cv-score/panel-data.test.ts).
 */
export function storedCounts(rr: StoredResults | null, rules: CvRule[], sector: Archetype, year: Year): { assessed: number; passed: number; couldNotAssess: number } {
  if (rr && typeof rr.assessed === "number" && typeof rr.passed === "number") {
    return { assessed: rr.assessed, passed: rr.passed, couldNotAssess: rr.couldNotAssess ?? 0 };
  }
  const results = [...(rr?.code ?? []), ...(rr?.llm ?? [])];
  const c = aggregateCvScore({ rules, results, sector, year, facts: NEUTRAL_FACTS });
  return { assessed: c.assessed, passed: c.passed, couldNotAssess: rr?.couldNotAssess ?? c.couldNotAssess };
}
const NEUTRAL_FACTS = { imageOnly: false, spellingErrors: 0, hasPhone: true, hasEmail: true };

/**
 * Server-only loader for the profile page (Task 19). Pass `score` straight from scoreCv() to skip the
 * cv_scores read; otherwise the stored row for (cvId, sector) is used. Returns null when nothing is scored yet.
 * Uses the caller's user-scoped client, so RLS applies to every read.
 */
export async function loadCvScorePanel(
  supabase: SupabaseClient,
  i: { userId: string; cvId: string; sector: Archetype; year: Year; score?: CvScore },
): Promise<CvScorePanelData | null> {
  const [scoreRes, cvRes, histRes] = await Promise.all([
    i.score
      ? Promise.resolve({ data: null, error: null })
      : supabase.from("cv_scores").select("total, dimensions, caps_applied, fixes, rule_results")
          .eq("user_id", i.userId).eq("cv_id", i.cvId).eq("sector", i.sector).maybeSingle<ScoreRow>(),
    supabase.from("cvs").select("raw_text, parsed_json").eq("id", i.cvId).eq("user_id", i.userId)
      .maybeSingle<{ raw_text: string | null; parsed_json: ParsedCV }>(),
    supabase.from("cv_scores").select("total, created_at, cvs!inner(uploaded_at)")
      .eq("user_id", i.userId).eq("sector", i.sector).order("created_at", { ascending: false }).limit(20),
  ]);
  if (scoreRes.error) console.error("cv score panel: score read failed", scoreRes.error);
  if (histRes.error) console.error("cv score panel: history read failed", histRes.error);

  let core: Pick<CvScorePanelData, "total" | "dimensions" | "capsApplied" | "fixes" | "assessed" | "passed" | "couldNotAssess">;
  if (i.score) {
    const s = i.score;
    core = { total: s.total, dimensions: s.dimensions, capsApplied: s.capsApplied, fixes: s.fixes, assessed: s.assessed, passed: s.passed, couldNotAssess: s.couldNotAssess };
  } else {
    const row = scoreRes.data as ScoreRow | null;
    if (!row) return null;
    // Total, dimensions, caps and fixes stay exactly as stored.
    core = {
      total: row.total, dimensions: row.dimensions, capsApplied: row.caps_applied ?? [], fixes: row.fixes ?? [],
      ...storedCounts(row.rule_results, rulesFor(i.sector), i.sector, i.year),
    };
  }

  let aiSaw: string | null = null;
  if (cvRes.data?.parsed_json) {
    try { aiSaw = prepareJudgeInput(cvRes.data.parsed_json, cvRes.data.raw_text ?? "").redactedText; }
    catch (e) { console.error("cv score panel: redaction failed", e); }
  }

  const rows = ((histRes.data ?? []) as unknown as (Omit<HistoryRow, "cvs"> & { cvs: HistoryRow["cvs"] | HistoryRow["cvs"][] })[])
    .map((r) => ({ ...r, cvs: Array.isArray(r.cvs) ? (r.cvs[0] ?? null) : r.cvs }));
  return { cvId: i.cvId, sector: i.sector, ...core, history: historyTotals(rows), aiSaw };
}
