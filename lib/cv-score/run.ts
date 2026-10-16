import "server-only";
import { and, eq } from "drizzle-orm";
import type { Archetype, ParsedCV, Year } from "@/lib/types";
import type { SafetyReport } from "@/lib/cv/safety";
import { isImageOnly } from "@/lib/cv/image-only";
import { rulesFor } from "@/lib/cv-rules";
import { countUnevidencedFails, judgeCvRules, PROMPT_VERSION } from "@/lib/ai/judgeCvRules";
import { currentModelId } from "@/lib/ai/models";
import { db } from "@/lib/db/client";
import { cvs, cvScores } from "@/lib/db/schema";
import { EMAIL_RE, PHONE_RE } from "@/lib/text/regex";
import { runCodeChecks } from "./checkers";
import { aggregateCvScore, type CvScore } from "./aggregate";
import { prepareJudgeInput } from "./pii";
import { RULES_VERSION, textHash } from "./cache";
import type { ScoredRuleResult } from "./context";

type StoredRuleResults = {
  code: ScoredRuleResult[]; llm: ScoredRuleResult[]; spellingErrors: string[] | null;
  couldNotAssess?: number;
  /** Rule counts for "Rules passed X/Y" (Task 18b); absent on rows scored before this was added. */
  assessed?: number;
  passed?: number;
  /** LLM fails without a quoted line (allowed only for "absent" verdicts): Task 25 reliability signal. */
  unevidencedFails?: number;
  /** The live AI judge failed: this score is the automatic (code) checks only, and the panel says so. */
  aiUnavailable?: boolean;
};
type CvRow = { raw_text: string; page_texts: string[] | null; page_count: number; file_size: number; parsed_json: ParsedCV & { safety?: SafetyReport } };

/** Foreign key violation: the CV row was deleted (re-upload, data reset) while it was being scored. */
const cvGone = (e: unknown) => (e as { code?: string } | null)?.code === "SQLITE_CONSTRAINT_FOREIGNKEY";

/**
 * Score one CV for one sector and upsert cv_scores (one row per cv × sector).
 * LLM verdicts are reused whenever a row with the same cache key exists for this user (06 R2):
 * sha256(normalised redacted text) + sector + rules_version + model_id + prompt_version.
 * Code checks and aggregation always re-run (pure and cheap). No XP is awarded here (amendment item 5).
 * The CV read is scoped to `userId`, and the score is never written unless it returns the row.
 */
export async function scoreCv(
  i: { userId: string; cvId: string; sector: Archetype; year: Year },
): Promise<CvScore & { aiUnavailable: boolean }> {
  const cv = db.select({ raw_text: cvs.raw_text, page_texts: cvs.page_texts, page_count: cvs.page_count, file_size: cvs.file_size, parsed_json: cvs.parsed_json })
    .from(cvs).where(and(eq(cvs.id, i.cvId), eq(cvs.user_id, i.userId))).get() as CvRow | undefined;
  if (!cv) throw new Error(`CV not found: ${i.cvId}`);

  const parsed = cv.parsed_json;
  const rawText = cv.raw_text ?? "";
  const pageTexts = cv.page_texts ?? [];
  const rules = rulesFor(i.sector);

  const judgeInput = prepareJudgeInput(parsed, rawText);
  const hash = textHash(judgeInput.redactedText);
  const modelId = currentModelId("smart");

  const cached = db.select({ rule_results: cvScores.rule_results }).from(cvScores).where(and(
    eq(cvScores.user_id, i.userId), eq(cvScores.sector, i.sector), eq(cvScores.text_hash, hash), eq(cvScores.model_id, modelId),
    eq(cvScores.prompt_version, PROMPT_VERSION), eq(cvScores.rules_version, RULES_VERSION),
  )).limit(1).get() as { rule_results: StoredRuleResults } | undefined;

  let llm: { results: ScoredRuleResult[]; spellingErrors: string[] | null; cacheable: boolean; aiUnavailable: boolean };
  if (cached?.rule_results && Array.isArray(cached.rule_results.llm)) {
    llm = { results: cached.rule_results.llm, spellingErrors: cached.rule_results.spellingErrors ?? null, cacheable: true, aiUnavailable: false };
  } else {
    const j = await judgeCvRules({
      redactedText: judgeInput.redactedText,
      structuredText: judgeInput.structuredText,
      rules,
      // Exact fixtures only (fixture mode): keyed by content + sector, never by identity.
      fixtureKey: `${hash.slice(0, 16)}-${i.sector}`,
    });
    llm = { results: j.results, spellingErrors: j.spellingErrors, cacheable: j.cacheable, aiUnavailable: j.aiUnavailable === true };
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

  const ruleResults: StoredRuleResults = {
    code, llm: llm.results, spellingErrors: llm.spellingErrors,
    couldNotAssess: score.couldNotAssess, assessed: score.assessed, passed: score.passed, unevidencedFails: countUnevidencedFails(llm.results),
    ...(llm.aiUnavailable ? { aiUnavailable: true } : {}),
  };
  const row = {
    cv_id: i.cvId, user_id: i.userId, sector: i.sector, total: score.total, dimensions: score.dimensions,
    caps_applied: score.capsApplied, rule_results: ruleResults, fixes: score.fixes,
  };
  // No verdicts obtained (fixture mode without an exact fixture): store the hash but no key parts, so it never serves as a cache hit.
  const cacheCols = llm.cacheable
    ? { text_hash: hash, model_id: modelId, prompt_version: PROMPT_VERSION, rules_version: RULES_VERSION }
    : { text_hash: hash, model_id: null, prompt_version: null, rules_version: null };
  const values = { ...row, ...cacheCols };
  try {
    db.insert(cvScores).values(values).onConflictDoUpdate({ target: [cvScores.cv_id, cvScores.sector], set: values }).run();
  } catch (e) {
    if (cvGone(e)) throw new Error(`Couldn't save CV score: CV ${i.cvId} was deleted while it was being scored`);
    throw new Error(`Couldn't save CV score: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { ...score, aiUnavailable: llm.aiUnavailable };
}
