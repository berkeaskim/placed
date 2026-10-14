import { createHash } from "node:crypto";
import type { LiResolvedRule } from "@/lib/linkedin-rules/types";
import { checkableFromPdf } from "@/lib/linkedin-rules";
import type { ScoredRuleResult } from "@/lib/cv-score/context";
import { cleanSpelling, mapVerdicts } from "./judgeCvRules";
import { currentModelId } from "./models";
import { AiError, generateStructured, runAi } from "./provider";
import { SYSTEM_LI_JUDGE } from "./prompts";
import { JudgeOutput, type JudgeOutputT } from "./schemas";

/** Cache-key part: bump on prompt/mapping changes; the prompt hash suffix invalidates automatically. */
export const LI_PROMPT_VERSION = `li-judge-2026-10-14.1-${createHash("sha256").update(SYSTEM_LI_JUDGE).digest("hex").slice(0, 8)}`;
const FN = "judgeLinkedIn";

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
  fixtureKey?: string;
};
export type LiJudgeResult = { results: ScoredRuleResult[]; spellingErrors: string[] | null; modelId: string; cacheable: boolean; aiUnavailable?: boolean };

const escapeData = (s: string) => s.replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function buildLiJudgePrompt(i: Omit<LiJudgeInput, "fixtureKey">): string {
  const judged = i.rules.filter(isJudged);
  const rules = judged
    .map((r) => `- [${r.id}]${r.allowPartial ? " (PARTIAL ALLOWED)" : ""} ${r.llmGuidance ?? r.statement}\n  pass e.g.: ${r.passExample ?? "-"}\n  fail e.g.: ${r.failExample ?? "-"}`)
    .join("\n");
  return (
    `RULES (${judged.length}):\n${rules}\n\n` +
    `<profile_structured>\n${escapeData(i.structuredText)}\n</profile_structured>\n\n` +
    `<profile_text>\n${escapeData(i.redactedText)}\n</profile_text>` +
    (i.cvText ? `\n\n<cv_structured>\n${escapeData(i.cvText)}\n</cv_structured>` : "\n\n(No CV on file: rules comparing the profile with the CV are not_applicable.)")
  );
}

/**
 * One smart-tier call judges every llm/hybrid rule for the sector, mirroring judgeCvRules: verdicts whose quote
 * isn't in the profile become could_not_assess; a live AI failure scores the code checks only (aiUnavailable).
 */
export async function judgeLinkedIn(i: LiJudgeInput): Promise<LiJudgeResult> {
  const judged = i.rules.filter(isJudged);
  const modelId = currentModelId("smart");
  const none = (): LiJudgeResult => ({
    results: judged.map((r) => ({ ruleId: r.id, status: "not_applicable", evidenceLine: null, fix: null })),
    spellingErrors: null, modelId, cacheable: false,
  });
  if (judged.length === 0) return { ...none(), cacheable: true };

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
          system: SYSTEM_LI_JUDGE,
          schema: JudgeOutput,
          maxTokens: Math.max(16000, 400 + 180 * judged.length),
          parts: [{ type: "text", text: buildLiJudgePrompt(i) }],
        }),
      fallback: () => null,
    });
  } catch (err) {
    if (!(err instanceof AiError)) throw err;
    console.error("judgeLinkedIn: AI failed, scoring the automatic checks only", err.message);
    return { ...none(), aiUnavailable: true };
  }
  if (!raw) return none();
  return {
    results: mapVerdicts(raw, judged, i.redactedText, () => true),
    spellingErrors: cleanSpelling(raw.spelling_errors, i.redactedText),
    modelId, cacheable: true, aiUnavailable: false,
  };
}
