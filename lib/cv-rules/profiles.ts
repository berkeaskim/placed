import type { Archetype } from "@/lib/types";
import type { Dimension } from "./types";

/** Cross-industry rubric, docs/research/cv-rules-general.md §4. */
export const BASE_WEIGHTS: Record<Dimension, number> = { ats: 20, impact: 30, clarity: 20, relevance: 20, uk: 10 };

/**
 * Per-sector weights: the consolidated rows of the sector research docs
 * (cv-rules-tech-product.md §8; cv-rules-finance-consulting.md weighting table).
 * The docs grade these weights D (synthesis); tune against outcome data.
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
