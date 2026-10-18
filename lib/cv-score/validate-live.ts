/**
 * The live half of the gold-set harness: runs the production AI judge on every gold CV (scripts/validate-cv.ts --live).
 * Costs real API calls. Never imported by tests except with judgeCvRules mocked.
 */
import { judgeCvRules } from "@/lib/ai/judgeCvRules";
import { aiMode } from "@/lib/ai/config";
import { rulesFor } from "@/lib/cv-rules";
import type { GoldFile } from "./gold";
import { prepareJudgeInput } from "./pii";
import { goldParsed, type Verdicts } from "./validate";

/** Judge verdicts per gold CV id, judged exactly as scoreCv does (same redaction, rules and target context), no cache. */
export async function judgeGold(gold: GoldFile, onProgress?: (done: number, total: number) => void): Promise<Map<string, Verdicts>> {
  if (aiMode() !== "live") throw new Error("--live needs a live AI provider: set one up in Settings (or ANTHROPIC_API_KEY / GEMINI_API_KEY / Ollama) and leave AI_MODE unset");
  const out = new Map<string, Verdicts>();
  let done = 0;
  for (const cv of gold.cvs) {
    const j = prepareJudgeInput(goldParsed(cv), cv.text);
    const res = await judgeCvRules({
      redactedText: j.redactedText, structuredText: j.structuredText, rules: rulesFor(cv.sector, cv.track),
      context: { year: cv.year, sector: cv.sector, track: cv.track, jdPresent: false },
    });
    out.set(cv.id, new Map(res.results.map((r) => [r.ruleId, r.status])));
    onProgress?.(++done, gold.cvs.length);
  }
  return out;
}
