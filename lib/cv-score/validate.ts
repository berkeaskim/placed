/**
 * Gold-set validation of the CV score (audit 2026-10-18, 04 "Validation plan"; docs/validation/README.md).
 * (a) inter-rater agreement per rule, (b) code checkers vs the human majority (offline), (c) the AI judge vs the human
 * majority (only when a caller passes judged verdicts: scripts/validate-cv.ts --live). Pure apart from the checkers.
 */
import type { ParsedCV } from "@/lib/types";
import { heuristicParseCv } from "@/lib/ai/heuristics";
import { RULES_BY_ID, rulesFor } from "@/lib/cv-rules";
import { assignIds } from "@/lib/cv/ids";
import { runCodeChecks } from "./checkers";
import type { CvContext } from "./context";
import { binaryLabel, consensus, labelsByRule, type GoldCv, type GoldFile } from "./gold";
import { binaryMetrics, cohenKappa, fleissKappa, gwetAc1, type BinaryMetrics } from "./stats";

/** Audit 04 validation plan: a rule whose AI–human agreement is below this is rewritten, moved to code or demoted. */
export const KAPPA_GATE = 0.6;

export type InterRaterRow = {
  ruleId: string;
  method: "cohen" | "fleiss";
  raters: number;
  items: number;
  kappa: number | null;
  /** Gwet's AC1, two-rater case only (robust to skewed prevalence). */
  ac1: number | null;
  /** Raw share of items where every rater agreed. */
  agreement: number;
};

/**
 * Agreement between human raters per rule, on binary labels (partial counts as fail). Cohen's κ when the same two
 * raters labelled every item, Fleiss' κ otherwise (items with fewer than the rule's full rater count are left out).
 */
export function interRater(gold: GoldFile): InterRaterRow[] {
  const byRule = new Map<string, Map<string, string>[]>();
  for (const cv of gold.cvs) {
    for (const [ruleId, raters] of labelsByRule(cv)) {
      if (!byRule.has(ruleId)) byRule.set(ruleId, []);
      byRule.get(ruleId)!.push(new Map([...raters].map(([r, l]) => [r, binaryLabel(l)])));
    }
  }
  return [...byRule.entries()].sort(([a], [b]) => a.localeCompare(b)).flatMap(([ruleId, items]): InterRaterRow[] => {
    const m = Math.max(...items.map((x) => x.size));
    if (m < 2) return [];
    const full = items.filter((x) => x.size === m);
    const raterSets = new Set(full.map((x) => [...x.keys()].sort().join(",")));
    const agreement = full.filter((x) => new Set(x.values()).size === 1).length / full.length;
    if (m === 2 && raterSets.size === 1) {
      const [a, b] = [...raterSets][0].split(",");
      const pairs = full.map((x) => [x.get(a)!, x.get(b)!] as [string, string]);
      return [{ ruleId, method: "cohen", raters: 2, items: full.length, kappa: cohenKappa(pairs).kappa, ac1: gwetAc1(pairs).ac1, agreement }];
    }
    return [{ ruleId, method: "fleiss", raters: m, items: full.length, kappa: fleissKappa(full.map((x) => [...x.values()])).kappa, ac1: null, agreement }];
  });
}

export type VsHumanRow = {
  ruleId: string;
  check: "code" | "llm";
  /** CVs with a human majority label for this rule. */
  n: number;
  /** κ over pass / fail / na against the human majority (unassessed verdicts left out). */
  kappa: number | null;
  ac1: number | null;
  /** Fail detection on CVs where both sides say the rule applies. */
  detection: BinaryMetrics;
  /** One side said not applicable and the other didn't. */
  naMismatch: number;
  /** AI judge only: verdicts that came back could_not_assess (misquote, no verdict, failed batch). */
  unassessed: number;
  /** κ below KAPPA_GATE or undefined with disagreements: the rule needs rewriting, moving to code or demoting. */
  flagged: boolean;
};

/** Verdicts for one CV: ruleId → status (pass / fail / partial / not_applicable / could_not_assess). */
export type Verdicts = Map<string, string>;

/** Compare machine verdicts with the human majority, per rule, over the whole gold set. */
export function compareWithHumans(gold: GoldFile, verdictsFor: (cv: GoldCv) => Verdicts, check: "code" | "llm"): VsHumanRow[] {
  const rows = new Map<string, { pairs: [string, string][]; unassessed: number }>();
  for (const cv of gold.cvs) {
    const machine = verdictsFor(cv);
    for (const [ruleId, human] of consensus(cv)) {
      const rule = RULES_BY_ID.get(ruleId);
      if (!rule || rule.check !== check || human === null) continue;
      const got = machine.get(ruleId);
      if (got === undefined) continue;
      if (!rows.has(ruleId)) rows.set(ruleId, { pairs: [], unassessed: 0 });
      const r = rows.get(ruleId)!;
      if (got === "could_not_assess") { r.unassessed++; continue; }
      r.pairs.push([binaryLabel(got), human]);
    }
  }
  return [...rows.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([ruleId, { pairs, unassessed }]) => {
    const kappa = cohenKappa(pairs).kappa;
    const disagreements = pairs.some(([a, b]) => a !== b);
    return {
      ruleId, check, n: pairs.length + unassessed, kappa, ac1: gwetAc1(pairs).ac1,
      detection: binaryMetrics(pairs.filter(([a, b]) => a !== "na" && b !== "na").map(([predicted, truth]) => ({ predicted, truth }))),
      naMismatch: pairs.filter(([a, b]) => (a === "na") !== (b === "na")).length,
      unassessed,
      flagged: kappa === null ? disagreements || unassessed > 0 : kappa < KAPPA_GATE,
    };
  });
}

/** The ParsedCV a gold CV is checked against: the offline heuristic parse (the gold format stores text only). */
export function goldParsed(cv: GoldCv): ParsedCV {
  return assignIds(heuristicParseCv(cv.text));
}

/** Deterministic code checker verdicts for a gold CV. Spelling has no AI input offline, so G-25 is not applicable. */
export function codeVerdicts(cv: GoldCv): Verdicts {
  const rules = rulesFor(cv.sector, cv.track);
  const ctx: CvContext = {
    text: cv.text, pageTexts: [cv.text], pageCount: cv.pageCount, fileSize: 100_000, cv: goldParsed(cv),
    year: cv.year, track: cv.track, sector: cv.sector, spellingErrors: null,
  };
  return new Map(runCodeChecks(rules, ctx).map((r) => [r.ruleId, r.status]));
}

const pct = (x: number | null) => (x === null ? "—" : `${Math.round(x * 100)}%`);
const k2 = (x: number | null) => (x === null ? "—" : x.toFixed(2));

export type ValidationReport = { interRater: InterRaterRow[]; code: VsHumanRow[]; llm: VsHumanRow[] | null };

export function validateGold(gold: GoldFile, judged?: (cv: GoldCv) => Verdicts): ValidationReport {
  return { interRater: interRater(gold), code: compareWithHumans(gold, codeVerdicts, "code"), llm: judged ? compareWithHumans(gold, judged, "llm") : null };
}

function vsTable(rows: VsHumanRow[], who: string): string[] {
  if (!rows.length) return [`No ${who} rules are labelled in this gold set.`];
  return [
    "| Rule | n | κ | AC1 | Precision (fail) | Recall (fail) | Specificity | N/A mismatch | Not assessed | Flag |",
    "|---|---|---|---|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.ruleId} | ${r.n} | ${k2(r.kappa)} | ${k2(r.ac1)} | ${pct(r.detection.precision)} | ${pct(r.detection.recall)} | ${pct(r.detection.specificity)} | ${r.naMismatch} | ${r.unassessed} | ${r.flagged ? `below ${KAPPA_GATE}: rewrite` : ""} |`),
  ];
}

/** Markdown report. `meta` lines go under the title (model, date, gold file). */
export function renderValidationReport(gold: GoldFile, report: ValidationReport, meta: string[] = []): string {
  const lines = [`# CV score validation: ${gold.name}`, "", ...meta];
  if (gold.synthetic) lines.push("", "> **Synthetic data.** These CVs and labels were made up to test the harness. The numbers below say nothing about how valid the score is.");
  lines.push("", `${gold.cvs.length} CVs · ${gold.raters.length} raters · format ${gold.format}`, "");
  lines.push("## 1. Inter-rater agreement (human vs human)", "", "Binary labels (partial counts as fail). This is the ceiling for any machine agreement.", "");
  lines.push("| Rule | Method | Raters | Items | κ | AC1 | Raw agreement |", "|---|---|---|---|---|---|---|");
  for (const r of report.interRater) lines.push(`| ${r.ruleId} | ${r.method === "cohen" ? "Cohen" : "Fleiss"} | ${r.raters} | ${r.items} | ${k2(r.kappa)} | ${k2(r.ac1)} | ${pct(r.agreement)} |`);
  lines.push("", "## 2. Code checkers vs human majority (offline)", "", ...vsTable(report.code, "code"));
  lines.push("", "## 3. AI judge vs human majority", "");
  if (report.llm) {
    lines.push(...vsTable(report.llm, "AI-judged"));
    const flagged = report.llm.filter((r) => r.flagged).map((r) => r.ruleId);
    lines.push("", flagged.length ? `Rules below κ ${KAPPA_GATE} (rewrite, move to code or demote): ${flagged.join(", ")}` : `No AI-judged rule fell below κ ${KAPPA_GATE}.`);
  } else {
    lines.push("Not run. Use `npm run validate:cv -- --live` with an AI provider set up (costs API calls).");
  }
  return lines.join("\n") + "\n";
}
