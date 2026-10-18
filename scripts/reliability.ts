/**
 * Judge test–retest reliability (research 06 T17, audit 04#13). Scores each CV RUNS times against the LIVE model with
 * no cache (judgeCvRules never reads cv_scores) and reports run-to-run agreement:
 *   - per CV: totals, mean, SD, SEM, how often the run was provisional, and every rule whose verdict flipped;
 *   - per rule over all CVs: flip rate with a 95% Wilson interval and Fleiss' κ across runs;
 *   - totals: ICC(1,1) and SEM across CVs.
 * Gate: SD ≤ 2 per CV and no rule whose flip-rate interval lies wholly above 10%. Writes
 * tests/fairness/RELIABILITY-<model>-<date>.md. Scores are per model: run it once per provider you support.
 *
 * DRY RUN BY DEFAULT: without --live it only builds the cases and prints the plan (no AI calls, no cost).
 *   npm run reliability                              dry run
 *   npm run reliability -- --live                    10 runs per CV (RUNS=10 or --runs N to change; < 10 can't gate)
 *   npm run reliability -- --live --gold <file>      also score every CV in a gold file (docs/validation/GOLD_FORMAT.md)
 * --live costs real API calls (runs × CVs × ~4 smart-tier calls) and needs a live provider with AI_MODE unset.
 * It never touches ./data. Known limit: CVs are parsed with heuristicParseCv, not the production LLM parse.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { countUnevidencedFails, judgeCvRules } from "@/lib/ai/judgeCvRules";
import { heuristicParseCv } from "@/lib/ai/heuristics";
import { aiMode } from "@/lib/ai/config";
import { currentModelId } from "@/lib/ai/models";
import { rulesFor } from "@/lib/cv-rules";
import { assignIds } from "@/lib/cv/ids";
import { runCodeChecks } from "@/lib/cv-score/checkers";
import { aggregateCvScore } from "@/lib/cv-score/aggregate";
import { MAX_FLIP_RATE, MAX_SD, MIN_RUNS, retestSummary } from "@/lib/cv-score/reliability";
import { loadGold } from "@/lib/cv-score/gold";
import { goldParsed } from "@/lib/cv-score/validate";
import { prepareJudgeInput } from "@/lib/cv-score/pii";
import { EMAIL_RE, PHONE_RE } from "@/lib/text/regex";
import type { Archetype, ParsedCV, Year } from "@/lib/types";
import { DEMO_CV_PATH, DEMO_PERSONA_PATH, uploadedRawText } from "@/lib/fixtures/persona";
import { fill, loadBase } from "@/tests/fairness/helpers";

const argv = process.argv.slice(2);
const flag = (name: string) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : undefined; };
const RUNS = Number(flag("--runs") ?? process.env.RUNS ?? MIN_RUNS);
const LIVE = argv.includes("--live") && process.env.DRY_RUN !== "1";
const GOLD = flag("--gold");

type Case = { label: string; cv: ParsedCV; text: string; sector: Archetype; year: Year; pageCount: number };

/** Mirrors the scoring half of lib/cv-score/run.ts scoreCv (judge context, code checks, facts, aggregate), minus the DB. */
async function scoreOnce(c: Case): Promise<{ total: number; provisional: boolean; unevidencedFails: number; verdicts: Map<string, string> }> {
  const rules = rulesFor(c.sector);
  const YEAR = c.year;
  const j = prepareJudgeInput(c.cv, c.text);
  const llm = await judgeCvRules({
    redactedText: j.redactedText, structuredText: j.structuredText, rules,
    context: { year: YEAR, sector: c.sector, track: "standard", jdPresent: false },
  });
  const code = runCodeChecks(rules, {
    text: c.text, pageTexts: [c.text], pageCount: c.pageCount, fileSize: 120_000, cv: c.cv, year: YEAR, sector: c.sector, spellingErrors: llm.spellingErrors,
  });
  const score = aggregateCvScore({
    rules, results: [...code, ...llm.results], sector: c.sector, year: YEAR,
    facts: {
      imageOnly: false,
      hasPhone: Boolean(c.cv.phone?.trim()) || PHONE_RE.test(c.text), hasEmail: Boolean(c.cv.email?.trim()) || EMAIL_RE.test(c.text),
    },
  });
  return {
    total: score.exactTotal, provisional: score.provisional, unevidencedFails: countUnevidencedFails(llm.results),
    verdicts: new Map(llm.results.map((r) => [r.ruleId, r.status])),
  };
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

async function main() {
  const persona = JSON.parse(readFileSync(DEMO_PERSONA_PATH, "utf8")) as ParsedCV;
  const { text } = await uploadedRawText(new Uint8Array(readFileSync(DEMO_CV_PATH)));
  const base = (b: "swe" | "data" | "consulting" | "finance", sector: Archetype): Case => {
    const t = fill(loadBase(b));
    return { label: `fairness/${b}`, cv: assignIds(heuristicParseCv(t)), text: t, sector, year: "2nd", pageCount: 1 };
  };
  const cases: Case[] = [
    { label: "demo/ayse", cv: persona, text, sector: "data_analytics", year: "2nd", pageCount: 1 },
    base("swe", "software_eng"), base("data", "data_analytics"), base("consulting", "consulting"), base("finance", "finance_banking"),
  ];
  if (GOLD) {
    const gold = loadGold(GOLD);
    for (const g of gold.cvs) {
      if (g.track !== "standard") continue;
      cases.push({ label: `gold/${g.id}${gold.synthetic ? " (synthetic)" : ""}`, cv: goldParsed(g), text: g.text, sector: g.sector, year: g.year, pageCount: g.pageCount });
    }
  }
  if (!LIVE) {
    for (const c of cases) console.log(`${c.label} [${c.sector}, ${c.year}]: ${rulesFor(c.sector).filter((r) => r.check === "llm").length} llm rules`);
    console.log(`dry run: ${cases.length} CVs × ${RUNS} runs planned (about ${cases.length * RUNS * 4} smart-tier calls); no AI calls made. Add --live to run.`);
    return;
  }
  if (aiMode() !== "live") throw new Error("reliability --live needs a live model: set ANTHROPIC_API_KEY or GEMINI_API_KEY (or Ollama) and leave AI_MODE unset");
  if (RUNS < 2) throw new Error("--runs must be at least 2");
  if (RUNS < MIN_RUNS) console.warn(`RUNS=${RUNS} < ${MIN_RUNS}: results are reported but the gate is not meaningful`);
  const model = currentModelId("smart");
  const date = new Date().toISOString().slice(0, 10);
  const lines = [`# Judge reliability: ${model}`, "", `Date: ${date} · ${cases.length} CVs × ${RUNS} runs · cache bypassed`, ""];
  const log = (...ss: string[]) => { for (const s of ss) { console.log(s); lines.push(s); } };
  const results = [];
  log("## Per CV", "");
  for (const c of cases) {
    const runs = [];
    for (let i = 0; i < RUNS; i++) runs.push(await scoreOnce(c));
    results.push({ c, runs });
  }
  const summary = retestSummary(results.map(({ c, runs }) => ({ label: c.label, totals: runs.map((r) => r.total), verdicts: runs.map((r) => r.verdicts) })));
  for (const [i, st] of summary.cases.entries()) {
    const { c, runs } = results[i];
    const prov = runs.filter((r) => r.provisional).length;
    const unev = runs.reduce((s, r) => s + r.unevidencedFails, 0) / runs.length;
    log(`- ${c.label} [${c.sector}, ${c.year}] totals ${runs.map((r) => r.total.toFixed(1)).join(", ")} | mean ${st.mean.toFixed(1)} | SD ${st.sd.toFixed(2)}${st.sd > MAX_SD ? " (> 2)" : ""} | SEM ${st.sem.toFixed(2)} | provisional ${prov}/${RUNS} | unevidenced fails ${unev.toFixed(1)}/run`);
    for (const f of st.flips) {
      log(`  - flips ${pct(f.rate)} (95% CI ${pct(f.ci[0])}–${pct(f.ci[1])})${st.unstable.includes(f) ? " UNSTABLE" : ""}: ${f.ruleId} ${JSON.stringify(f.counts)}`);
    }
  }
  log("", "## Per rule (all CVs)", "", "| Rule | Flips / runs | Flip rate (95% CI) | Fleiss κ across runs | |", "|---|---|---|---|---|");
  for (const r of [...summary.rules].sort((a, b) => b.rate - a.rate)) {
    log(`| ${r.ruleId} | ${r.flips}/${r.runs} | ${pct(r.rate)} (${pct(r.ci[0])}–${pct(r.ci[1])}) | ${r.kappa === null ? "—" : r.kappa.toFixed(2)} | ${r.ci[0] > MAX_FLIP_RATE ? "UNSTABLE" : r.rate > MAX_FLIP_RATE ? "borderline (majority of 3 candidate)" : ""} |`);
  }
  log("", "## Totals", "", `ICC(1,1) ${summary.icc === null ? "—" : summary.icc.toFixed(3)} · SEM ${summary.sem.toFixed(2)} points · mean per-CV SD ${summary.meanSd.toFixed(2)}`);
  const failed = !summary.pass || RUNS < MIN_RUNS;
  log("", failed ? "RELIABILITY GATE: FAIL (rewrite unstable rules; see above)" : "RELIABILITY GATE: PASS");
  const out = path.join("tests", "fairness", `RELIABILITY-${model.replace(/[^\w.-]+/g, "_")}-${date}.md`);
  writeFileSync(out, lines.join("\n") + "\n");
  console.log(`report: ${out}`);
  if (failed) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
