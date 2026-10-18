import type { Archetype, Year } from "@/lib/types";
import data from "./rules.json";
import type { LiDimension, LiResolvedRule, LiRule, LiSource, Severity } from "./types";

export * from "./types";

export const LI_RULES = data.rules as unknown as LiRule[];
export const LI_SOURCES = data.sources as unknown as LiSource[];
export const LI_RULES_VERSION = (data._meta as { version: string }).version;

/** Sector dimension weights (playbook §3). Each row sums to 100; presence is always 0. */
export const LI_DIMENSION_WEIGHTS = data.sectorWeights as unknown as Record<Archetype, Record<LiDimension, number>>;

const SOURCE_BY_ID = new Map(LI_SOURCES.map((s) => [s.id, s]));

/** True when the rule can be decided from the "Save to PDF" export alone. */
export function checkableFromPdf(rule: Pick<LiRule, "input" | "altInputs">): boolean {
  return rule.input === "pdf_export" || (rule.altInputs ?? []).includes("pdf_export");
}

/**
 * Rules that apply to one sector: sector-scoped rules plus generic ones, minus any generic rule the sector
 * replaces with a sharper version (replacedBy). sectorParams are folded into params and sources become citations.
 */
export function liRulesFor(sector: Archetype): LiResolvedRule[] {
  return LI_RULES.filter((r) => (r.sectors === "all" || r.sectors.includes(sector)) && !r.replacedBy?.[sector]).map((r) => {
    const rest: LiRule = { ...r };
    delete rest.sectorParams;
    delete rest.replacedBy;
    const { sectorParams } = r;
    const params = sectorParams?.[sector] ? { ...r.params, ...sectorParams[sector] } : r.params;
    const citations = r.sourceIds.flatMap((id) => {
      const s = SOURCE_BY_ID.get(id);
      return s ? [{ title: s.title, publisher: s.publisher, year: s.year, url: s.url }] : [];
    });
    return { ...rest, ...(params ? { params } : {}), citations };
  });
}

/** How much LinkedIn matters per sector: playbook §1 table, banner copy as the researchers wrote it (shortened). */
export const LI_SECTOR_IMPORTANCE: Record<Archetype, { level: "low" | "medium-low" | "medium" | "high"; note: string }> = {
  software_eng: { level: "medium", note: "CV, coding test and GitHub decide most outcomes; make projects easy to find." },
  data_analytics: { level: "medium", note: "Big schemes test skills directly; LinkedIn routes a reader to your portfolio in one click." },
  quant_trading: { level: "low", note: "Firms hire through their own applications, tests and competitions. Fix criticals, then go compete." },
  consulting: { level: "medium", note: "Firms hire through online applications and tests; LinkedIn matters when you message people." },
  product: { level: "medium", note: "Screens run on CV and transcript; LinkedIn shows what you built." },
  finance_banking: { level: "medium", note: "LinkedIn will not get you a spring week. Your application will." },
  marketing_growth: { level: "high", note: "Your profile is a sample of how you market yourself." },
  research: { level: "medium-low", note: "Your application, research statement and references carry far more weight." },
};

/** The student-facing line for an advisory rule. Falls back to the scorer statement minus its "Advisory (weight 0):" prefix. */
export function presenceTip(rule: Pick<LiRule, "statement" | "tip">): string {
  return rule.tip ?? rule.statement.replace(/^Advisory( risk check)? \([^)]*\):\s*/i, "");
}

const RULE_BY_ID = new Map(LI_RULES.map((r) => [r.id, r]));
/** Re-words a tip saved with an older score, so stored results pick up the current wording. */
export function presenceTipFor(ruleId: string, saved: string): string {
  const r = RULE_BY_ID.get(ruleId);
  return r ? presenceTip(r) : saved;
}

/** Effective severity for one student: yearAdjust > sectorAdjust > base (playbook engineFit.severityPrecedence). */
export function liEffectiveSeverity(rule: Pick<LiResolvedRule, "severity" | "yearAdjust" | "sectorAdjust">, sector: Archetype, year: Year): Severity {
  return rule.yearAdjust?.[year]?.severity ?? rule.sectorAdjust?.[sector]?.severity ?? rule.severity;
}

/** The pass/fail cut-off for one student: yearAdjust threshold, else the (sector-resolved) param, else undefined. */
export function liThreshold(rule: Pick<LiResolvedRule, "yearAdjust" | "params">, year: Year): number | undefined {
  return rule.yearAdjust?.[year]?.threshold ?? rule.params?.threshold;
}

/** Markers that introduce the model's actual question after a description of a (possibly unimplemented) pre-filter. */
const QUESTION_MARKER = /(?:^|[.;]\s+|\s)(?:Then ask(?: per entry)?:|Then:|LLM for paraphrase:|LLM checks|LLM:|Cliché regex \+ LLM:|If ambiguous:|Tie-break:|then:)\s*/;
/** Sentences describing code, regexes or lexicons the judge never sees (08 #15), and severity notes meant for editors. */
const IMPLEMENTATION_SENTENCE = /^(Code\b|Code:|Regex\b|Lexicon\b|Grade regex|Role-keyword regex|Leadership lexicon|Digit density|Spell-check|URL regex|Cross-reference|Researcher:)/i;

/**
 * The question the LLM judge is asked for a rule: llmGuidance minus any sentence that claims code already ran
 * (no LinkedIn hybrid pre-filter is implemented), falling back to the statement.
 */
export function liJudgeQuestion(rule: Pick<LiRule, "llmGuidance" | "statement">): string {
  let g = (rule.llmGuidance ?? "").trim();
  const m = g.match(QUESTION_MARKER);
  if (m && m.index !== undefined) g = g.slice(m.index + m[0].length);
  const kept = g.split(/(?<=[.?)])\s+(?=[A-Z0-9'])/).filter((s) => s.trim() && !IMPLEMENTATION_SENTENCE.test(s.trim()));
  const q = kept.join(" ").trim();
  if (!q) return rule.statement;
  return q.charAt(0).toUpperCase() + q.slice(1);
}
