import type { Archetype } from "@/lib/types";
import type { Dimension } from "./types";

/** Cross-industry rubric: CV amendments 2026-10-13 (market-2026 report 02 §5.1), replacing cv-rules-general.md §4 (20/30/20/20/10). */
export const BASE_WEIGHTS: Record<Dimension, number> = { ats: 15, impact: 25, clarity: 25, relevance: 25, uk: 10 };

/**
 * Per-sector weights: the consolidated rows of the sector research docs
 * (cv-rules-tech-product.md §8; cv-rules-finance-consulting.md weighting table).
 * The docs grade these weights D (synthesis); tune against outcome data.
 * The 2026-10-13 amendments change only BASE_WEIGHTS ("sector profiles still shift these as before"),
 * so these absolute rows are kept as they were.
 */
export const DIMENSION_WEIGHTS: Record<Archetype, Record<Dimension, number>> = {
  software_eng: { ats: 20, impact: 25, clarity: 15, relevance: 30, uk: 10 },
  data_analytics: { ats: 20, impact: 25, clarity: 15, relevance: 30, uk: 10 },
  quant_trading: { ats: 10, impact: 20, clarity: 20, relevance: 40, uk: 10 },
  consulting: { ats: 15, impact: 35, clarity: 20, relevance: 15, uk: 15 },
  product: { ats: 15, impact: 30, clarity: 25, relevance: 20, uk: 10 },
  finance_banking: { ats: 15, impact: 25, clarity: 20, relevance: 20, uk: 20 },
  marketing_growth: { ats: 15, impact: 30, clarity: 25, relevance: 20, uk: 10 },
  research: { ats: 15, impact: 20, clarity: 20, relevance: 35, uk: 10 },
};
