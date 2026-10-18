/**
 * Judge reliability (amendments Task 25 item 3, research 06 T17, audit 04#13): runs judgeCvRules RUNS times per CV
 * against the LIVE model with no cache (judgeCvRules itself never reads cv_scores), on the demo persona plus the 4
 * fairness bases. Reports, per CV and sector: total mean/SD/SEM and every rule whose verdict flips, with a 95% Wilson
 * interval. Gate: SD ≤ 2 and no rule whose flip-rate interval lies wholly above 10%. Writes a report to
 * tests/fairness/RELIABILITY-<model>-<date>.md. Scores are per model: run it once per provider you support.
 *
 * Costs real API calls (RUNS × cases × ~4 smart-tier calls). Needs ANTHROPIC_API_KEY or GEMINI_API_KEY (or Ollama)
 * and AI_MODE unset/live. Never point it at ./data: it doesn't touch the database.
 * Run: npm run reliability              (RUNS=10 by default; fewer runs can't gate)
 *      DRY_RUN=1 npm run reliability    (builds the cases and prints the plan; no AI calls)
 * Known limit: parses the fairness bases with heuristicParseCv, not the production LLM parse.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { judgeCvRules } from "@/lib/ai/judgeCvRules";
import { heuristicParseCv } from "@/lib/ai/heuristics";
import { aiMode } from "@/lib/ai/config";
import { currentModelId } from "@/lib/ai/models";
import { rulesFor } from "@/lib/cv-rules";
import { assignIds } from "@/lib/cv/ids";
import { runCodeChecks } from "@/lib/cv-score/checkers";
import { aggregateCvScore } from "@/lib/cv-score/aggregate";
import { MAX_SD, MIN_RUNS, reliabilityStats } from "@/lib/cv-score/reliability";
import { prepareJudgeInput } from "@/lib/cv-score/pii";
import { EMAIL_RE, PHONE_RE } from "@/lib/text/regex";
import type { Archetype, ParsedCV, Year } from "@/lib/types";
import { DEMO_CV_PATH, DEMO_PERSONA_PATH, uploadedRawText } from "@/lib/fixtures/persona";
import { fill, loadBase } from "@/tests/fairness/helpers";

const RUNS = Number(process.env.RUNS ?? MIN_RUNS);
const DRY = process.env.DRY_RUN === "1";
const YEAR: Year = "2nd";

type Case = { label: string; cv: ParsedCV; text: string; sector: Archetype };

/** Mirrors the scoring half of lib/cv-score/run.ts scoreCv (judge context, code checks, facts, aggregate), minus the DB. */
async function scoreOnce(c: Case): Promise<{ total: number; provisional: boolean; verdicts: Map<string, string> }> {
  const rules = rulesFor(c.sector);
  const j = prepareJudgeInput(c.cv, c.text);
  const llm = await judgeCvRules({
    redactedText: j.redactedText, structuredText: j.structuredText, rules,
    context: { year: YEAR, sector: c.sector, track: "standard", jdPresent: false },
  });
  const code = runCodeChecks(rules, {
    text: c.text, pageTexts: [c.text], pageCount: 1, fileSize: 120_000, cv: c.cv, year: YEAR, sector: c.sector, spellingErrors: llm.spellingErrors,
  });
  const score = aggregateCvScore({
    rules, results: [...code, ...llm.results], sector: c.sector, year: YEAR,
    facts: {
      imageOnly: false,
      hasPhone: Boolean(c.cv.phone?.trim()) || PHONE_RE.test(c.text), hasEmail: Boolean(c.cv.email?.trim()) || EMAIL_RE.test(c.text),
    },
  });
  return { total: score.exactTotal, provisional: score.provisional, verdicts: new Map(llm.results.map((r) => [r.ruleId, r.status])) };
}

async function main() {
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
  if (DRY) {
    for (const c of cases) console.log(`${c.label} [${c.sector}]: ${rulesFor(c.sector).filter((r) => r.check === "llm").length} llm rules`);
    console.log(`dry run: ${cases.length} cases × ${RUNS} runs planned; no AI calls made`);
    return;
  }
  if (aiMode() !== "live") throw new Error("reliability needs a live model: set ANTHROPIC_API_KEY or GEMINI_API_KEY (or Ollama) and leave AI_MODE unset");
  if (RUNS < MIN_RUNS) console.warn(`RUNS=${RUNS} < ${MIN_RUNS}: results are reported but the gate is not meaningful`);
  const model = currentModelId("smart");
  const lines = [`# Judge reliability: ${model}`, "", `Date: ${new Date().toISOString().slice(0, 10)} · ${RUNS} runs per CV · cache bypassed · year ${YEAR}`, ""];
  const log = (s: string) => { console.log(s); lines.push(s); };
  let failed = RUNS < MIN_RUNS;
  for (const c of cases) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await scoreOnce(c));
    const st = reliabilityStats(runs.map((r) => r.total), runs.map((r) => r.verdicts));
    if (!st.pass) failed = true;
    const prov = runs.filter((r) => r.provisional).length;
    log(`- ${c.label} [${c.sector}] totals ${runs.map((r) => r.total.toFixed(1)).join(", ")} | mean ${st.mean.toFixed(1)} | SD ${st.sd.toFixed(2)}${st.sd > MAX_SD ? " (> 2)" : ""} | SEM ${st.sem.toFixed(2)} | provisional ${prov}/${RUNS}`);
    for (const f of st.flips) {
      log(`  - flips ${(f.rate * 100).toFixed(0)}% (95% CI ${(f.ci[0] * 100).toFixed(0)}–${(f.ci[1] * 100).toFixed(0)}%)${st.unstable.includes(f) ? " UNSTABLE" : ""}: ${f.ruleId} ${JSON.stringify(f.counts)}`);
    }
  }
  log("");
  log(failed ? "RELIABILITY GATE: FAIL (rewrite unstable rules; see above)" : "RELIABILITY GATE: PASS");
  const out = path.join("tests", "fairness", `RELIABILITY-${model.replace(/[^\w.-]+/g, "_")}-${new Date().toISOString().slice(0, 10)}.md`);
  writeFileSync(out, lines.join("\n") + "\n");
  console.log(`report: ${out}`);
  if (failed) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
