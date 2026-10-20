import type { Archetype } from "@/lib/types";
import type { Dimension, Track } from "./types";

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
  // research/placement-year/07 §2.1, §3.1 (Grade D, synthesis): HR screens first on Workday/Oracle portals; tools, modules
  // and design or lab projects are the evidence; science weights clarity for GSK's "few acronyms, simple layout".
  engineering: { ats: 15, impact: 20, clarity: 20, relevance: 35, uk: 10 },
  science_pharma: { ats: 15, impact: 15, clarity: 25, relevance: 35, uk: 10 },
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
  // research/placement-year/07 §2.1: Mott MacDonald UK placements take no CV; BAE/nuclear vetting is eligibility, not score.
  engineering:
    "Some engineering employers don't read a CV at first: Mott MacDonald's UK placements use an application form and a strengths test instead. Defence and nuclear roles also need security vetting, which is an eligibility check, not part of this score.",
};

/**
 * Spring weeks / insight programmes (research/spring-weeks/05 §6a, 07 §2.2): academics (uk) and activities (impact)
 * carry a first-year CV; no internship is expected. Grade D (synthesis); tune against outcome data.
 */
export const SPRING_DEFAULT: Record<Dimension, number> = { ats: 10, impact: 30, clarity: 15, relevance: 20, uk: 25 };
export const SPRING_WEIGHTS: Partial<Record<Archetype, Record<Dimension, number>>> = {
  // Competitions and olympiads sit in relevance (QNT-02 is judged on the spring track).
  quant_trading: { ats: 5, impact: 25, clarity: 15, relevance: 30, uk: 25 },
};

export const SPRING_CAVEAT =
  "Spring weeks and insight programmes screen mainly on the application form, online tests and your motivation answers. Most portals ask for your A-levels separately. Your CV is one input, so keep it clean and one page.";

/** Placement years (research/placement-year/05 §4a): first-year marks and modules up, outcome-heavy bullets down. Grade D. */
function placementWeights(sector: Archetype): Record<Dimension, number> {
  const w = DIMENSION_WEIGHTS[sector];
  return { ...w, impact: w.impact - 5, uk: w.uk + 5 };
}

export const PLACEMENT_CAVEAT =
  "Many placement schemes (Big 4, some engineering consultancies) screen on the application form, a strengths or situational test and a video interview, and some don't ask for a CV at all. Where a CV is read, recruiters look for your first-year marks, relevant modules and one project you can talk about.";

export function weightsFor(sector: Archetype, track: Track = "standard"): Record<Dimension, number> {
  if (track === "placement") return placementWeights(sector);
  return track === "spring" ? SPRING_WEIGHTS[sector] ?? SPRING_DEFAULT : DIMENSION_WEIGHTS[sector];
}

export function caveatFor(sector: Archetype, track: Track = "standard"): string | undefined {
  if (track === "placement") return PLACEMENT_CAVEAT;
  return track === "spring" ? SPRING_CAVEAT : SECTOR_CAVEATS[sector];
}
