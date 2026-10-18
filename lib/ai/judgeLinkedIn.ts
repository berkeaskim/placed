import { createHash } from "node:crypto";
import type { LiResolvedRule } from "@/lib/linkedin-rules/types";
import { checkableFromPdf, liEffectiveSeverity, liJudgeQuestion, liThreshold, type LiInputSource } from "@/lib/linkedin-rules";
import { ARCHETYPE_LABELS, type Archetype, type Year } from "@/lib/types";
import type { ScoredRuleResult } from "@/lib/cv-score/context";
import { cleanSpelling, mapVerdicts } from "./judgeCvRules";
import { currentModelId } from "./models";
import { AiError, generateStructured, runAi } from "./provider";
import { SYSTEM_LI_JUDGE } from "./prompts";
import { JudgeOutput, type JudgeOutputT } from "./schemas";

/** Cache-key part: bump on prompt/mapping changes; the prompt hash suffix invalidates automatically. */
export const LI_PROMPT_VERSION = `li-judge-2026-10-18.1-${createHash("sha256").update(SYSTEM_LI_JUDGE).digest("hex").slice(0, 8)}`;
const FN = "judgeLinkedIn";
const BATCH = 6;
/**
 * Fast tier by default: the student waits on this call (no background scoring like the CV). Measured 2026-10-14 on
 * the demo export: smart (Gemini 3.1 Pro) 122-197 s, fast (Gemini Flash) 6.6 s with identical verdicts and score.
 * LI_JUDGE_TIER=smart switches back.
 */
const LI_JUDGE_TIER: "fast" | "smart" = process.env.LI_JUDGE_TIER === "smart" ? "smart" : "fast";

/** Rules the model decides: llm and hybrid rules the PDF export can carry, minus advisory tips. */
export const isJudged = (r: Pick<LiResolvedRule, "check" | "advisory" | "input" | "altInputs">) =>
  (r.check === "llm" || r.check === "hybrid") && !r.advisory && checkableFromPdf(r);

export type LiJudgeInput = {
  /** Redacted export text: evidence lines must be substrings of it. */
  redactedText: string;
  /** Redacted section-by-section rendering of the parsed export. */
  structuredText: string;
  /** Redacted CV rendering (lib/cv-score/pii.ts), or null when no CV is on file. */
  cvText: string | null;
  rules: LiResolvedRule[];
  /** Year and target sector: the judge resolves year/sector thresholds and conditional rules with them (08 #3). */
  sector: Archetype;
  year: Year;
  /** Which input the profile came from, so the judge knows which sections it can't see. */
  source?: LiInputSource;
  fixtureKey?: string;
};
export type LiJudgeResult = { results: ScoredRuleResult[]; spellingErrors: string[] | null; modelId: string; cacheable: boolean; aiUnavailable?: boolean };

const escapeData = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");

const SOURCE_LABEL: Record<LiInputSource, string> = {
  pdf: "LinkedIn 'Save to PDF' export (shows only the ~3 top skills; may omit Projects and Featured)",
  archive: "LinkedIn 'Download your data' archive (full skills list; no Featured)",
  extension: "the student's own profile page, read in their browser",
  url: "the public profile page (no skills list)",
};

/** "(threshold for this student: 60)" for rules whose cut-off depends on year or sector; "" otherwise. */
function thresholdNote(r: LiResolvedRule, year: Year): string {
  const t = liThreshold(r, year);
  if (t === undefined) return "";
  const max = r.params?.majorThreshold;
  return ` (threshold for this student: ${t}${max !== undefined ? `; upper bound ${max}` : ""}. Use these numbers over any in the wording.)`;
}

export function buildLiJudgePrompt(i: Omit<LiJudgeInput, "fixtureKey">): string {
  const judged = i.rules.filter(isJudged);
  const rules = judged
    .map((r) => {
      const critical = liEffectiveSeverity(r, i.sector, i.year) === "critical";
      const tags = `${r.allowPartial ? " (PARTIAL ALLOWED)" : ""}${critical ? " (CRITICAL: a fail must quote the line)" : ""}`;
      return `- [${r.id}]${tags} ${liJudgeQuestion(r)}${thresholdNote(r, i.year)}\n  pass e.g.: ${r.passExample ?? "-"}\n  fail e.g.: ${r.failExample ?? "-"}`;
    })
    .join("\n");
  return (
    `STUDENT: year=${i.year}; target sector=${ARCHETYPE_LABELS[i.sector]}` +
    (i.source ? `; profile read from: ${SOURCE_LABEL[i.source]}` : "") +
    `\n\nRULES (${judged.length}):\n${rules}\n\n` +
    `<profile_structured>\n${escapeData(i.structuredText)}\n</profile_structured>\n\n` +
    `<profile_text>\n${escapeData(i.redactedText)}\n</profile_text>` +
    (i.cvText ? `\n\n<cv_structured>\n${escapeData(i.cvText)}\n</cv_structured>` : "\n\n(No CV on file: rules comparing the profile with the CV are not_applicable.)")
  );
}

/**
 * A critical LinkedIn fail with no quoted line is not trusted (08 #2): the model can't prove an absence-of-integrity
 * claim, and a critical fail moves the score a lot. It becomes could_not_assess and drops out of the denominator.
 */
export function requireQuoteForCritical(results: ScoredRuleResult[], rules: LiResolvedRule[], sector: Archetype, year: Year): ScoredRuleResult[] {
  const byId = new Map(rules.map((r) => [r.id, r]));
  return results.map((x) => {
    const r = byId.get(x.ruleId);
    if (!r || x.status !== "fail" || x.evidenceLine !== null || liEffectiveSeverity(r, sector, year) !== "critical") return x;
    return { ruleId: x.ruleId, status: "could_not_assess", evidenceLine: null, fix: null, detail: "critical fail without a quoted line" };
  });
}

/**
 * Judges every llm/hybrid rule for the sector in parallel batches, mirroring judgeCvRules: verdicts whose quote
 * isn't in the profile become could_not_assess; a live AI failure scores the code checks only (aiUnavailable).
 */
export async function judgeLinkedIn(i: LiJudgeInput): Promise<LiJudgeResult> {
  const judged = i.rules.filter(isJudged);
  const modelId = currentModelId(LI_JUDGE_TIER);
  const none = (): LiJudgeResult => ({
    results: judged.map((r) => ({ ruleId: r.id, status: "not_applicable", evidenceLine: null, fix: null })),
    spellingErrors: null, modelId, cacheable: false,
  });
  if (judged.length === 0) return { ...none(), cacheable: true };

  // Parallel batches of BATCH rules: wall-clock is the slowest batch, not the sum.
  const batches: LiResolvedRule[][] = [];
  for (let k = 0; k < judged.length; k += BATCH) batches.push(judged.slice(k, k + BATCH));
  let raw: JudgeOutputT | null;
  try {
    const parts = await Promise.all(batches.map((rules, b) =>
      runAi<JudgeOutputT | null, JudgeOutputT>({
        fn: FN,
        // Fixtures hold the whole verdict set: only the first batch reads it, the rest fall back to nothing.
        fixtureKey: b === 0 ? i.fixtureKey : `${i.fixtureKey ?? "none"}-batch${b}`,
        schema: JudgeOutput,
        fromFixture: (r) => r,
        live: () =>
          generateStructured({
            tier: LI_JUDGE_TIER,
            system: SYSTEM_LI_JUDGE,
            schema: JudgeOutput,
            // Gemini counts thinking tokens in maxOutputTokens: keep the 16k floor judgeCvRules uses, or batches truncate and retry.
            maxTokens: 16000,
            // The student waits on this call (no background scoring): ~20 yes/no rules don't need deep thinking.
            thinking: "low",
            parts: [{ type: "text", text: buildLiJudgePrompt({ ...i, rules }) }],
          }),
        fallback: () => null,
      })));
    const got = parts.filter((x): x is JudgeOutputT => x !== null);
    raw = got.length ? { verdicts: got.flatMap((x) => x.verdicts), spelling_errors: [...new Set(got.flatMap((x) => x.spelling_errors))] } : null;
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    console.error("judgeLinkedIn: AI failed, scoring the automatic checks only", err.message);
    return { ...none(), aiUnavailable: true };
  }
  if (!raw) return none();
  return {
    results: requireQuoteForCritical(mapVerdicts(raw, judged, i.redactedText, () => true), judged, i.sector, i.year),
    spellingErrors: cleanSpelling(raw.spelling_errors, i.redactedText),
    modelId, cacheable: true, aiUnavailable: false,
  };
}
