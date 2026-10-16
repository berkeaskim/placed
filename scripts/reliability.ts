/**
 * Judge reliability (amendments Task 25 item 3, research 06 T17): runs judgeCvRules RUNS times per CV against the
 * LIVE model with no cache (judgeCvRules itself never reads cv_scores), on the demo persona plus the 4 fairness
 * bases. Reports, per CV and sector: total-score mean/SD and every rule whose verdict flips in more than 10% of runs.
 * Gate: SD ≤ 2 and no rule flipping > 10%. Rewrite any flipping rule's llmGuidance; put the SD in the pitch.
 *
 * Costs real API calls (RUNS × 5 smart-tier calls). Needs ANTHROPIC_API_KEY or GEMINI_API_KEY and AI_MODE unset/live.
 * Run: npm run reliability            (RUNS=3 npm run reliability for a cheaper pass)
 */
import { readFileSync } from "node:fs";
import { judgeCvRules } from "@/lib/ai/judgeCvRules";
import { heuristicParseCv } from "@/lib/ai/heuristics";
import { aiMode } from "@/lib/env";
import { currentModelId } from "@/lib/ai/models";
import { rulesFor } from "@/lib/cv-rules";
import { assignIds } from "@/lib/cv/ids";
import { runCodeChecks } from "@/lib/cv-score/checkers";
import { aggregateCvScore } from "@/lib/cv-score/aggregate";
import { MAX_SD, reliabilityStats } from "@/lib/cv-score/reliability";
import { prepareJudgeInput } from "@/lib/cv-score/pii";
import { EMAIL_RE, PHONE_RE } from "@/lib/text/regex";
import type { Archetype, ParsedCV, Year } from "@/lib/types";
import { DEMO_CV_PATH, DEMO_PERSONA_PATH, uploadedRawText } from "@/lib/fixtures/persona";
import { fill, loadBase } from "@/tests/fairness/helpers";

const RUNS = Number(process.env.RUNS ?? 5);
const YEAR: Year = "2nd";

type Case = { label: string; cv: ParsedCV; text: string; sector: Archetype };

/** Mirrors the scoring half of lib/cv-score/run.ts scoreCv (code checks + facts + aggregate), minus the DB. */
async function scoreOnce(c: Case): Promise<{ total: number; verdicts: Map<string, string> }> {
  const rules = rulesFor(c.sector);
  const j = prepareJudgeInput(c.cv, c.text);
  const llm = await judgeCvRules({ redactedText: j.redactedText, structuredText: j.structuredText, rules });
  const code = runCodeChecks(rules, {
    text: c.text, pageTexts: [c.text], pageCount: 1, fileSize: 120_000, cv: c.cv, year: YEAR, spellingErrors: llm.spellingErrors,
  });
  const score = aggregateCvScore({
    rules, results: [...code, ...llm.results], sector: c.sector, year: YEAR,
    facts: {
      imageOnly: false, spellingErrors: llm.spellingErrors?.length ?? 0,
      hasPhone: Boolean(c.cv.phone?.trim()) || PHONE_RE.test(c.text), hasEmail: Boolean(c.cv.email?.trim()) || EMAIL_RE.test(c.text),
    },
  });
  return { total: score.total, verdicts: new Map(llm.results.map((r) => [r.ruleId, r.status])) };
}

async function main() {
  if (aiMode() !== "live") throw new Error("reliability needs a live model: set ANTHROPIC_API_KEY or GEMINI_API_KEY and leave AI_MODE unset");
  const persona = JSON.parse(readFileSync(DEMO_PERSONA_PATH, "utf8")) as ParsedCV;
  const { text } = await uploadedRawText(new Uint8Array(readFileSync(DEMO_CV_PATH)));
  const base = (b: "swe" | "data" | "consulting" | "finance", sector: Archetype): Case => {
    const t = fill(loadBase(b));
    return { label: `fairness/${b}`, cv: assignIds(heuristicParseCv(t)), text: t, sector };
  };
  const cases: Case[] = [
    { label: "demo/ayse", cv: persona, text, sector: "data_analytics" },
    base("swe", "software_eng"), base("data", "data_analytics"), base("consulting", "consulting"), base("finance", "finance_banking"),
  ];
  console.log(`model ${currentModelId("smart")}, ${RUNS} runs per CV, cache bypassed`);
  let failed = false;
  for (const c of cases) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await scoreOnce(c));
    const st = reliabilityStats(runs.map((r) => r.total), runs.map((r) => r.verdicts));
    if (!st.pass) failed = true;
    console.log(`${c.label} [${c.sector}] totals ${runs.map((r) => r.total).join(", ")} | mean ${st.mean.toFixed(1)} | SD ${st.sd.toFixed(2)}${st.sd > MAX_SD ? " (> 2)" : ""}`);
    for (const f of st.flips) console.log(`  flips ${(f.rate * 100).toFixed(0)}% > 10%: ${f.ruleId} ${JSON.stringify(f.counts)}`);
  }
  console.log(failed ? "RELIABILITY GATE: FAIL (rewrite flipping rules; see above)" : "RELIABILITY GATE: PASS");
  if (failed) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
