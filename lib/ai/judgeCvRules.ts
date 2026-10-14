import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import path from "node:path";
import type { CvRule } from "@/lib/cv-rules/types";
import type { ScoredRuleResult } from "@/lib/cv-score/context";
import { isSpellingVariant } from "@/lib/cv-score/checkers";
import { aiMode } from "@/lib/env";
import { escapeRegex } from "@/lib/text/regex";
import { currentModelId } from "./models";
import { AiError, generateStructured, runAi } from "./provider";
import { SYSTEM_JUDGE } from "./prompts";
import { JudgeOutput, type JudgeOutputT } from "./schemas";

/**
 * Part of the cache key (06 R2). Bump the manual part whenever buildJudgePrompt or mapVerdicts change
 * meaning; the SYSTEM_JUDGE hash suffix invalidates the cache automatically on any prompt edit.
 */
export const PROMPT_VERSION = `judge-2026-10-13.2-${createHash("sha256").update(SYSTEM_JUDGE).digest("hex").slice(0, 8)}`;
const FN = "judgeCvRules";

export type JudgeInput = {
  /** redactCv output for the raw CV text. evidence_line must be a substring of this. */
  redactedText: string;
  /** Redacted rendering of the structured CV (lib/cv-score/pii.ts). Never parsed_json. */
  structuredText: string;
  rules: CvRule[];
  /** Fixture mode only: an EXACT fixture under fixtures/ai/judgeCvRules/<key>.json (no default fallback). */
  fixtureKey?: string;
};
/**
 * `cacheable: false` when no verdicts were obtained (fixture mode without an exact fixture, or a live AI failure): never
 * cache those. `aiUnavailable`: the live judge failed, so the score is the automatic (code) checks only.
 */
export type JudgeResult = { results: ScoredRuleResult[]; spellingErrors: string[] | null; modelId: string; cacheable: boolean; aiUnavailable?: boolean };

const escapeData = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");
const unescapeData = (s: string) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const norm = (s: string) => s.replace(/\s+/g, " ").trim();

/** Placeholder numbers (amendment item 5 / 06 R9b): a line containing one is not a real result. Redaction placeholders ([NAME], [SOCIETY]…) are not matched. */
export const NUMBER_PLACEHOLDER_RE =
  /\[(?:add|insert|enter|your|number|metric|figure|amount|percent|percentage|x+|n|tbc|tbd)\b[^\]]*\]|\bNEEDS_NUMBER\b|(?<![A-Za-z])X{1,3}\s?%|(?<![A-Za-z])£\s?X{1,3}\b|\b(?:TBC|TBD)\b/i;

export function buildJudgePrompt(i: Pick<JudgeInput, "redactedText" | "structuredText" | "rules">): string {
  const llm = i.rules.filter((r) => r.check === "llm");
  const rules = llm
    .map((r) =>
      `- [${r.id}]${r.allowPartial ? " (PARTIAL ALLOWED)" : ""} ${r.llmGuidance}\n  pass e.g.: ${r.passExample}\n  fail e.g.: ${r.failExample}`,
    )
    .join("\n");
  return (
    `RULES (${llm.length}):\n${rules}\n\n` +
    `<cv_structured>\n${escapeData(i.structuredText)}\n</cv_structured>\n\n` +
    `<cv_text>\n${escapeData(i.redactedText)}\n</cv_text>`
  );
}

function mapStatus(s: string, rule: CvRule): "pass" | "fail" | "partial" | "not_applicable" {
  const t = s.trim().toLowerCase();
  if (t === "pass" || t === "fail") return t;
  if (t === "partial" && rule.allowPartial) return "partial";
  return "not_applicable";
}

/**
 * Model output → one result per llm rule, in rule order.
 * - status: pass | fail | not_applicable; partial only with allowPartial; anything else → not_applicable.
 * - A1 (06 R1): evidence_line must be an exact substring of the redacted text after whitespace
 *   normalisation, else the verdict becomes could_not_assess (dropped from the denominator).
 *   pass and partial REQUIRE a quote (a pass claims presence, and anything present can be quoted);
 *   only fail may have a null evidence_line ("absent from the CV"), counted by countUnevidencedFails.
 * - A passing line that contains a placeholder number scores as fail.
 */
export function mapVerdicts(raw: JudgeOutputT, rules: CvRule[], redactedText: string): ScoredRuleResult[] {
  const hay = norm(redactedText);
  const got = new Map<string, JudgeOutputT["verdicts"][number]>();
  for (const v of raw.verdicts) if (!got.has(v.rule_id)) got.set(v.rule_id, v);

  return rules
    .filter((r) => r.check === "llm")
    .map((rule): ScoredRuleResult => {
      const v = got.get(rule.id);
      if (!v) return { ruleId: rule.id, status: "not_applicable", evidenceLine: null, fix: null };
      const status = mapStatus(v.status, rule);
      if (status === "not_applicable") return { ruleId: rule.id, status, evidenceLine: null, fix: null };

      const quoted = v.evidence_line == null ? "" : norm(unescapeData(v.evidence_line).replace(/^["“'‘]+|["”'’]+$/g, ""));
      const evidenceLine = quoted || null;
      if (!evidenceLine && status !== "fail") {
        return { ruleId: rule.id, status: "could_not_assess", evidenceLine: null, fix: null, detail: `${status} verdict without an evidence line` };
      }
      if (evidenceLine && !hay.includes(evidenceLine)) {
        return { ruleId: rule.id, status: "could_not_assess", evidenceLine: null, fix: null, detail: `quoted line not found in CV: ${evidenceLine.slice(0, 200)}` };
      }
      if (evidenceLine && status !== "fail" && NUMBER_PLACEHOLDER_RE.test(evidenceLine)) {
        return { ruleId: rule.id, status: "fail", evidenceLine, fix: v.fix?.trim() || "Replace the placeholder with your real number — a placeholder isn't a result yet." };
      }
      return { ruleId: rule.id, status, evidenceLine, fix: status === "pass" ? null : v.fix?.trim() || null };
    });
}

/** LLM fails with no quoted line (allowed for "absent" verdicts); tracked for the Task 25 reliability run. */
export function countUnevidencedFails(llmResults: ScoredRuleResult[]): number {
  return llmResults.filter((r) => r.status === "fail" && r.evidenceLine == null).length;
}

/** Keep only misspellings that actually occur in the text and are not UK/US variants (06 R12). */
function cleanSpelling(words: string[], text: string): string[] {
  const out: string[] = [];
  for (const w of words.map((x) => x.trim()).filter(Boolean)) {
    if (isSpellingVariant(w) || out.includes(w)) continue;
    const re = new RegExp(`(?<![\\p{L}])${escapeRegex(w)}(?![\\p{L}])`, "iu");
    if (re.test(text)) out.push(w);
  }
  return out;
}

function hasExactFixture(key: string | undefined): key is string {
  if (!key) return false;
  return existsSync(path.join(process.cwd(), "fixtures", "ai", FN, `${key.replace(/[^a-zA-Z0-9_-]/g, "_")}.json`));
}

/**
 * One smart-tier call judges every llm rule for the sector. Input is already redacted (pii.ts).
 * Live AiError: every llm rule is not_applicable with `aiUnavailable: true` and `cacheable: false`, so the code-only
 * score is shown (and labelled) but never cached under the live model id. Other errors are bugs and propagate.
 * Fixture mode without an exact fixture: every llm rule is not_applicable (score = code rules only).
 */
export async function judgeCvRules(i: JudgeInput): Promise<JudgeResult> {
  const llmRules = i.rules.filter((r) => r.check === "llm");
  const modelId = currentModelId("smart");
  const none = (): JudgeResult => ({
    results: llmRules.map((r) => ({ ruleId: r.id, status: "not_applicable", evidenceLine: null, fix: null })),
    spellingErrors: null,
    modelId,
    cacheable: false,
  });
  if (llmRules.length === 0) return { ...none(), cacheable: true };
  if (aiMode() === "fixture" && !hasExactFixture(i.fixtureKey)) return none();

  let raw: JudgeOutputT | null;
  try {
    raw = await runAi<JudgeOutputT | null, JudgeOutputT>({
      fn: FN,
      fixtureKey: i.fixtureKey,
      schema: JudgeOutput,
      fromFixture: (r) => r,
      live: () =>
        generateStructured({
          tier: "smart",
          system: SYSTEM_JUDGE,
          schema: JudgeOutput,
          // Gemini counts thinking tokens in maxOutputTokens, so a per-rule budget (400 + 180/rule) truncated. Billing is per token used.
          maxTokens: Math.max(16000, 400 + 180 * llmRules.length),
          parts: [{ type: "text", text: buildJudgePrompt(i) }],
        }),
      fallback: () => null,
    });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    console.error("judgeCvRules: AI failed, scoring the automatic checks only", err.message);
    return { ...none(), aiUnavailable: true };
  }
  if (!raw) return none();
  return { results: mapVerdicts(raw, llmRules, i.redactedText), spellingErrors: cleanSpelling(raw.spelling_errors, i.redactedText), modelId, cacheable: true, aiUnavailable: false };
}
