import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Archetype, ParsedCV, Year } from "@/lib/types";
import type { SafetyReport } from "@/lib/cv/safety";
import { isImageOnly } from "@/lib/cv/image-only";
import { rulesFor } from "@/lib/cv-rules";
import { judgeCvRules, PROMPT_VERSION } from "@/lib/ai/judgeCvRules";
import { currentModelId } from "@/lib/ai/models";
import { EMAIL_RE, PHONE_RE } from "@/lib/text/regex";
import { runCodeChecks } from "./checkers";
import { aggregateCvScore, type CvScore } from "./aggregate";
import { prepareJudgeInput } from "./pii";
import { RULES_VERSION, textHash } from "./cache";
import type { ScoredRuleResult } from "./context";

type StoredRuleResults = { code: ScoredRuleResult[]; llm: ScoredRuleResult[]; spellingErrors: string[] | null; couldNotAssess?: number };
type CvRow = { raw_text: string; page_texts: string[] | null; page_count: number; file_size: number; parsed_json: ParsedCV & { safety?: SafetyReport } };

/** True when the error is "column does not exist" (migration 0007 not run yet). */
const missingColumn = (e: { message?: string; code?: string } | null) =>
  !!e && (e.code === "42703" || e.code === "PGRST204" || /column/i.test(e.message ?? ""));

/**
 * Score one CV for one sector and upsert cv_scores (one row per cv × sector).
 * LLM verdicts are reused whenever a row with the same cache key exists for this user (06 R2):
 * sha256(normalised redacted text) + sector + rules_version + model_id + prompt_version.
 * Code checks and aggregation always re-run (pure and cheap). No XP is awarded here (amendment item 5).
 */
export async function scoreCv(supabase: SupabaseClient, i: { userId: string; cvId: string; sector: Archetype; year: Year }): Promise<CvScore> {
  const { data: cv, error } = await supabase
    .from("cvs")
    .select("raw_text, page_texts, page_count, file_size, parsed_json")
    .eq("id", i.cvId)
    .eq("user_id", i.userId)
    .single<CvRow>();
  if (error || !cv) throw new Error(`CV not found: ${error?.message ?? i.cvId}`);

  const parsed = cv.parsed_json;
  const rawText = cv.raw_text ?? "";
  const pageTexts = cv.page_texts ?? [];
  const rules = rulesFor(i.sector);

  const judgeInput = prepareJudgeInput(parsed, rawText);
  const hash = textHash(judgeInput.redactedText);
  const modelId = currentModelId("smart");

  const { data: cached, error: cacheErr } = await supabase
    .from("cv_scores")
    .select("rule_results")
    .eq("user_id", i.userId)
    .eq("sector", i.sector)
    .eq("text_hash", hash)
    .eq("model_id", modelId)
    .eq("prompt_version", PROMPT_VERSION)
    .eq("rules_version", RULES_VERSION)
    .limit(1)
    .maybeSingle<{ rule_results: StoredRuleResults }>();
  if (cacheErr && !missingColumn(cacheErr)) console.error("cv_scores cache lookup failed", cacheErr);

  let llm: { results: ScoredRuleResult[]; spellingErrors: string[] | null };
  if (cached?.rule_results && Array.isArray(cached.rule_results.llm)) {
    llm = { results: cached.rule_results.llm, spellingErrors: cached.rule_results.spellingErrors ?? null };
  } else {
    const j = await judgeCvRules({
      redactedText: judgeInput.redactedText,
      structuredText: judgeInput.structuredText,
      rules,
      // Exact fixtures only (fixture mode): keyed by content + sector, never by identity.
      fixtureKey: `${hash.slice(0, 16)}-${i.sector}`,
    });
    llm = { results: j.results, spellingErrors: j.spellingErrors };
  }

  const code = runCodeChecks(rules, {
    text: rawText, pageTexts, pageCount: cv.page_count, fileSize: cv.file_size, cv: parsed, year: i.year,
    spellingErrors: llm.spellingErrors, safety: parsed.safety,
  });
  const textLayerFailed = code.some((r) => r.status === "fail" && rules.find((x) => x.id === r.ruleId)?.checker === "text_layer");
  const score = aggregateCvScore({
    rules, results: [...code, ...llm.results], sector: i.sector, year: i.year,
    facts: {
      imageOnly: textLayerFailed || isImageOnly(pageTexts),
      spellingErrors: llm.spellingErrors?.length ?? 0,
      hasPhone: Boolean(parsed.phone?.trim()) || PHONE_RE.test(rawText),
      hasEmail: Boolean(parsed.email?.trim()) || EMAIL_RE.test(rawText),
    },
  });

  const ruleResults: StoredRuleResults = { code, llm: llm.results, spellingErrors: llm.spellingErrors, couldNotAssess: score.couldNotAssess };
  const row = {
    cv_id: i.cvId, user_id: i.userId, sector: i.sector, total: score.total, dimensions: score.dimensions,
    caps_applied: score.capsApplied, rule_results: ruleResults, fixes: score.fixes,
  };
  const cacheCols = { text_hash: hash, model_id: modelId, prompt_version: PROMPT_VERSION, rules_version: RULES_VERSION };
  let up = await supabase.from("cv_scores").upsert({ ...row, ...cacheCols }, { onConflict: "cv_id,sector" });
  if (up.error && missingColumn(up.error)) {
    console.warn("cv_scores cache columns missing: run supabase/migrations/0007_cv_score_cache.sql");
    up = await supabase.from("cv_scores").upsert(row, { onConflict: "cv_id,sector" });
  }
  if (up.error) throw new Error(`Couldn't save CV score: ${up.error.message}`);
  return score;
}
