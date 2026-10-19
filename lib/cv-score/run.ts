import "server-only";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import type { Archetype, ParsedCV, Year } from "@/lib/types";
import type { SafetyReport } from "@/lib/cv/safety";
import type { Track } from "@/lib/cv-rules/types";
import { isImageOnly } from "@/lib/cv/image-only";
import { rulesFor } from "@/lib/cv-rules";
import { countUnevidencedFails, judgeCvRules, PROMPT_VERSION } from "@/lib/ai/judgeCvRules";
import { currentModelId } from "@/lib/ai/models";
import { db } from "@/lib/db/client";
import { cvs, cvScores } from "@/lib/db/schema";
import { EMAIL_RE, PHONE_RE } from "@/lib/text/regex";
import { getFile } from "@/lib/files";
import { runCodeChecks } from "./checkers";
import { aggregateCvScore, type CvScore } from "./aggregate";
import { prepareJudgeInput } from "./pii";
import { RULES_VERSION, textHash } from "./cache";
import type { ScoredRuleResult } from "./context";
import { planDelta, type DeltaPlan } from "./delta";
import { madeByPlacedTailor } from "./provenance";

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
  /** Which model judged the llm rules ("fixture", "off" or "<provider>:<model>"): history never mixes models (04#10). */
  scoredBy?: string;
  /** Year of study the judge was told (the cache is reused only for the same year: it is in the prompt). */
  judgeYear?: Year;
  /** Too little was assessed for a confident number (04#1): the panel shows a range, and history skips it. */
  provisional?: boolean;
  coverage?: number;
  range?: { low: number; high: number };
  /** Delta re-judging (04#9): verdicts kept from an earlier score of an edited CV, and how many went back to the AI. */
  delta?: { fromCvId: string; reused: number; rejudged: number; cosmetic: boolean };
  /** The uploaded PDF was rendered by Placed's tailor (04#28): judged by the same AI family that rewrote it. */
  madeByPlaced?: boolean;
};
type CvRow = { storage_path: string; raw_text: string; page_texts: string[] | null; page_count: number; file_size: number; parsed_json: ParsedCV & { safety?: SafetyReport } };

/** Foreign key violation: the CV row was deleted (re-upload, data reset) while it was being scored. */
const cvGone = (e: unknown) => (e as { code?: string } | null)?.code === "SQLITE_CONSTRAINT_FOREIGNKEY";

/** How many earlier scores to consider as a delta base (newest first). */
const DELTA_CANDIDATES = 5;

/**
 * The best earlier score to re-judge from (04#9): same user, sector, track, model, prompt and rules version, and the
 * same year of study (the full-cache invalidation rules still apply). Its judge input is rebuilt from that CV row and
 * only trusted when it hashes to the stored text_hash, so a redaction change can never smuggle in stale verdicts.
 */
function findDeltaBase(i: {
  userId: string; sector: Archetype; track: Track; year: Year; modelId: string; hash: string; ruleIds: string[];
  next: { redactedText: string; structuredText: string };
}): { fromCvId: string; plan: DeltaPlan; spelling: string[] | null } | null {
  const rows = db.select({ cv_id: cvScores.cv_id, text_hash: cvScores.text_hash, rule_results: cvScores.rule_results, raw_text: cvs.raw_text, parsed_json: cvs.parsed_json })
    .from(cvScores).innerJoin(cvs, eq(cvs.id, cvScores.cv_id))
    .where(and(
      eq(cvScores.user_id, i.userId), eq(cvs.user_id, i.userId), eq(cvScores.sector, i.sector), eq(cvScores.track, i.track), isNotNull(cvScores.text_hash),
      eq(cvScores.model_id, i.modelId), eq(cvScores.prompt_version, PROMPT_VERSION), eq(cvScores.rules_version, RULES_VERSION),
    )).orderBy(desc(cvScores.created_at)).limit(DELTA_CANDIDATES).all() as
    { cv_id: string; text_hash: string; rule_results: StoredRuleResults | null; raw_text: string; parsed_json: ParsedCV }[];
  let best: { fromCvId: string; plan: DeltaPlan; spelling: string[] | null } | null = null;
  for (const r of rows) {
    const rr = r.rule_results;
    if (!rr || !Array.isArray(rr.llm) || rr.judgeYear !== i.year || rr.aiUnavailable || r.text_hash === i.hash) continue;
    let prev;
    try { prev = prepareJudgeInput(r.parsed_json, r.raw_text ?? ""); } catch { continue; }
    if (textHash(prev.redactedText) !== r.text_hash) continue;
    const plan = planDelta({ ruleIds: i.ruleIds, prev, prevResults: rr.llm, next: i.next });
    if (!best || plan.reuse.length > best.plan.reuse.length) best = { fromCvId: r.cv_id, plan, spelling: rr.spellingErrors ?? null };
  }
  return best && best.plan.reuse.length ? best : null;
}

/**
 * Score one CV for one sector on one track and upsert cv_scores (one row per cv × sector × track).
 * LLM verdicts are reused whenever a row with the same cache key exists for this user (06 R2):
 * sha256(normalised redacted text) + sector + rules_version + model_id + prompt_version, and the same year of study
 * (the judge is told the year; it's stored in rule_results.judgeYear).
 * Code checks and aggregation always re-run (pure and cheap). No XP is awarded here (amendment item 5).
 * The CV read is scoped to `userId`, and the score is never written unless it returns the row.
 */
export async function scoreCv(
  i: { userId: string; cvId: string; sector: Archetype; year: Year; track?: Track; gradYear?: number | null },
): Promise<CvScore & { aiUnavailable: boolean; scoredBy: string; madeByPlaced: boolean; delta: StoredRuleResults["delta"] | null }> {
  const track: Track = i.track ?? "standard";
  const cv = db.select({ storage_path: cvs.storage_path, raw_text: cvs.raw_text, page_texts: cvs.page_texts, page_count: cvs.page_count, file_size: cvs.file_size, parsed_json: cvs.parsed_json })
    .from(cvs).where(and(eq(cvs.id, i.cvId), eq(cvs.user_id, i.userId))).get() as CvRow | undefined;
  if (!cv) throw new Error(`CV not found: ${i.cvId}`);

  const parsed = cv.parsed_json;
  // Best effort: a missing or unreadable file just means no "made by Placed" label.
  const madeByPlaced = madeByPlacedTailor((await getFile("cvs", cv.storage_path).catch(() => null))?.bytes);
  const rawText = cv.raw_text ?? "";
  const pageTexts = cv.page_texts ?? [];
  const rules = rulesFor(i.sector, track);

  const judgeInput = prepareJudgeInput(parsed, rawText);
  const hash = textHash(judgeInput.redactedText);
  const modelId = currentModelId("smart");

  const cached = db.select({ rule_results: cvScores.rule_results }).from(cvScores).where(and(
    eq(cvScores.user_id, i.userId), eq(cvScores.sector, i.sector), eq(cvScores.track, track), eq(cvScores.text_hash, hash), eq(cvScores.model_id, modelId),
    eq(cvScores.prompt_version, PROMPT_VERSION), eq(cvScores.rules_version, RULES_VERSION),
  )).limit(1).get() as { rule_results: StoredRuleResults } | undefined;

  let llm: { results: ScoredRuleResult[]; spellingErrors: string[] | null; cacheable: boolean; aiUnavailable: boolean; delta?: StoredRuleResults["delta"] };
  if (cached?.rule_results && Array.isArray(cached.rule_results.llm) && cached.rule_results.judgeYear === i.year) {
    llm = { results: cached.rule_results.llm, spellingErrors: cached.rule_results.spellingErrors ?? null, cacheable: true, aiUnavailable: false };
  } else {
    // Edited CV: keep verdicts whose evidence didn't change and re-judge the rest (04#9, #30).
    const base = findDeltaBase({
      userId: i.userId, sector: i.sector, track, year: i.year, modelId, hash,
      ruleIds: rules.filter((r) => r.check === "llm").map((r) => r.id), next: judgeInput,
    });
    const j = await judgeCvRules({
      redactedText: judgeInput.redactedText,
      structuredText: judgeInput.structuredText,
      rules,
      // No job advert in this flow yet: rules that need one are not applicable (03#5).
      context: { year: i.year, sector: i.sector, track, jdPresent: false },
      // Exact fixtures only (fixture mode): keyed by content + sector, never by identity.
      fixtureKey: track === "standard" ? `${hash.slice(0, 16)}-${i.sector}` : `${hash.slice(0, 16)}-${i.sector}-${track}`,
      ...(base ? { reuse: base.plan.reuse, reuseSpelling: base.spelling } : {}),
    });
    const presets = j.results.filter((r) => r.status === "not_applicable" && /^(skipped for|needs:)/.test(r.detail ?? "")).length;
    llm = {
      results: j.results, spellingErrors: j.spellingErrors, cacheable: j.cacheable, aiUnavailable: j.aiUnavailable === true,
      ...(base && j.reused ? { delta: { fromCvId: base.fromCvId, reused: j.reused, rejudged: j.results.length - presets - j.reused, cosmetic: base.plan.cosmetic } } : {}),
    };
  }

  const code = runCodeChecks(rules, {
    text: rawText, pageTexts, pageCount: cv.page_count, fileSize: cv.file_size, cv: parsed, year: i.year, track, gradYear: i.gradYear ?? null, sector: i.sector,
    spellingErrors: llm.spellingErrors, safety: parsed.safety,
  });
  const textLayerFailed = code.some((r) => r.status === "fail" && rules.find((x) => x.id === r.ruleId)?.checker === "text_layer");
  const score = aggregateCvScore({
    rules, results: [...code, ...llm.results], sector: i.sector, year: i.year, track,
    facts: {
      imageOnly: textLayerFailed || isImageOnly(pageTexts),
      hasPhone: Boolean(parsed.phone?.trim()) || PHONE_RE.test(rawText),
      hasEmail: Boolean(parsed.email?.trim()) || EMAIL_RE.test(rawText),
    },
  });

  const ruleResults: StoredRuleResults = {
    code, llm: llm.results, spellingErrors: llm.spellingErrors,
    couldNotAssess: score.couldNotAssess, assessed: score.assessed, passed: score.passed, unevidencedFails: countUnevidencedFails(llm.results),
    ...(llm.aiUnavailable ? { aiUnavailable: true } : {}),
    ...(llm.delta ? { delta: llm.delta } : {}),
    ...(madeByPlaced ? { madeByPlaced: true } : {}),
    scoredBy: modelId, judgeYear: i.year, provisional: score.provisional, coverage: score.coverage, range: score.range,
  };
  const row = {
    cv_id: i.cvId, user_id: i.userId, sector: i.sector, track, total: score.total, dimensions: score.dimensions,
    caps_applied: score.capsApplied, rule_results: ruleResults, fixes: score.fixes,
  };
  // No verdicts obtained (fixture mode without an exact fixture): store the hash but no key parts, so it never serves as a cache hit.
  const cacheCols = llm.cacheable
    ? { text_hash: hash, model_id: modelId, prompt_version: PROMPT_VERSION, rules_version: RULES_VERSION }
    : { text_hash: hash, model_id: null, prompt_version: null, rules_version: null };
  const values = { ...row, ...cacheCols };
  try {
    db.insert(cvScores).values(values).onConflictDoUpdate({ target: [cvScores.cv_id, cvScores.sector, cvScores.track], set: values }).run();
  } catch (e) {
    if (cvGone(e)) throw new Error(`Couldn't save CV score: CV ${i.cvId} was deleted while it was being scored`);
    throw new Error(`Couldn't save CV score: ${e instanceof Error ? e.message : String(e)}`);
  }
  return { ...score, aiUnavailable: llm.aiUnavailable, scoredBy: modelId, madeByPlaced, delta: llm.delta ?? null };
}
