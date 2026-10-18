/**
 * Gold-set validation of the CV score (audit 2026-10-18, 04 "Validation plan"; docs/validation/README.md).
 *
 *   npm run validate:cv                         offline: inter-rater κ + code checkers vs the human majority
 *   npm run validate:cv -- --gold <file.json>   another gold file (format: docs/validation/GOLD_FORMAT.md)
 *   npm run validate:cv -- --live               also runs the AI judge on every gold CV (costs API calls) and writes
 *                                               docs/validation/reports/<date>-<model>.md
 *   npm run validate:cv -- --out <file.md>      write the report to a file as well as printing it
 *
 * Offline mode makes no AI calls and never touches ./data. Exit code 2 when a rule is flagged below κ 0.6 (real gold files only; synthetic data never fails).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadGold } from "@/lib/cv-score/gold";
import { renderValidationReport, validateGold } from "@/lib/cv-score/validate";

const DEFAULT_GOLD = "docs/validation/gold/synthetic-example.json";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const goldPath = arg("--gold") ?? DEFAULT_GOLD;
  const live = process.argv.includes("--live");
  const gold = loadGold(goldPath);
  const date = new Date().toISOString().slice(0, 10);
  const meta = [`Gold file: \`${goldPath}\` · run ${date}`];
  let judged: Map<string, Map<string, string>> | undefined;
  let model = "offline";
  if (live) {
    const { judgeGold } = await import("@/lib/cv-score/validate-live");
    const { currentModelId } = await import("@/lib/ai/models");
    const { PROMPT_VERSION } = await import("@/lib/ai/judgeCvRules");
    model = currentModelId("smart");
    console.error(`judging ${gold.cvs.length} CVs with ${model}…`);
    judged = await judgeGold(gold, (d, n) => console.error(`  ${d}/${n}`));
    meta.push(`Judge: ${model} · prompt ${PROMPT_VERSION}`);
  }
  const report = validateGold(gold, judged ? (cv) => judged.get(cv.id) ?? new Map() : undefined);
  const md = renderValidationReport(gold, report, meta);
  console.log(md);
  const out = arg("--out") ?? (live ? path.join("docs", "validation", "reports", `${date}-${model.replace(/[^\w.-]+/g, "_")}${gold.synthetic ? "-synthetic" : ""}.md`) : undefined);
  if (out) {
    mkdirSync(path.dirname(out), { recursive: true });
    writeFileSync(out, md);
    console.error(`report: ${out}`);
  }
  // Synthetic data proves nothing, so it never fails the run.
  if (!gold.synthetic && [...report.code, ...(report.llm ?? [])].some((r) => r.flagged)) process.exitCode = 2;
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
