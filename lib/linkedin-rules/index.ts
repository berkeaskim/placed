import type { Archetype } from "@/lib/types";
import data from "./rules.json";
import type { LiDimension, LiResolvedRule, LiRule, LiSource } from "./types";

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
