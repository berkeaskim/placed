import type { Archetype } from "@/lib/types";
import type { Dimension } from "./types";

/** Cross-industry rubric: CV amendments 2026-10-13 (market-2026 report 02 §5.1), replacing cv-rules-general.md §4 (20/30/20/20/10). */
export const BASE_WEIGHTS: Record<Dimension, number> = { ats: 15, impact: 25, clarity: 25, relevance: 25, uk: 10 };

/**
 * Per-sector weights: each research doc's consolidated sector row (cv-rules-tech-product.md §8;
 * cv-rules-finance-consulting.md weighting table) shifted by the approved base change (cv-amendments
 * 2026-10-13: ats −5, impact −5, clarity +5, relevance +5, uk 0 — "sector profiles still shift these as before").
 * The docs grade the sector offsets D (synthesis); tune against outcome data.
 */
export const DIMENSION_WEIGHTS: Record<Archetype, Record<Dimension, number>> = {
  software_eng: { ats: 15, impact: 20, clarity: 20, relevance: 35, uk: 10 },
  data_analytics: { ats: 15, impact: 20, clarity: 20, relevance: 35, uk: 10 },
  quant_trading: { ats: 5, impact: 15, clarity: 25, relevance: 45, uk: 10 },
  consulting: { ats: 10, impact: 30, clarity: 25, relevance: 20, uk: 15 },
  product: { ats: 10, impact: 25, clarity: 30, relevance: 25, uk: 10 },
  finance_banking: { ats: 10, impact: 20, clarity: 25, relevance: 25, uk: 20 },
  marketing_growth: { ats: 10, impact: 25, clarity: 30, relevance: 25, uk: 10 },
  research: { ats: 10, impact: 15, clarity: 25, relevance: 40, uk: 10 },
};

/**
 * Sector caveats shown under the CV Score ring (spec §6.4, C19). Only where the research says the CV
 * carries less weight at first screen: cv-rules-finance-consulting.md §2 ("Big 4 often doesn't use a CV
 * at first screen"; PwC form + online assessment [S30]) and its application-format note (insight schemes
 * use forms and tests [S31][S33]); market-2026/00-synthesis §1 ("Banks, MBB, quant and tech still screen on
 * the CV") and market-2026/01 §"who gates on the CV" (D). Tech, quant, product,
 * marketing and research remain CV-central in those docs, so they get no caveat.
 */
export const SECTOR_CAVEATS: Partial<Record<Archetype, string>> = {
  consulting:
    "Big 4 firms screen mainly via application forms and online tests — your CV matters less at that stage. MBB firms still screen on the CV.",
  finance_banking:
    "Big 4 and many insight or spring-week schemes screen mainly via application forms and online tests — your CV matters less at that stage. Banks still screen on the CV.",
};
