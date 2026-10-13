import type { Archetype, Year } from "@/lib/types";

export type Dimension = "ats" | "impact" | "clarity" | "relevance" | "uk";
export type Severity = "critical" | "major" | "minor";
export type Evidence = "A" | "B" | "C" | "D";

export const CHECKER_IDS = [
  "text_layer", "file_size", "page_count", "section_headings", "education_first", "contact_present",
  "uk_personal_details", "quantified_bullets", "we_vs_i", "skill_rating_glyphs", "uk_grades", "github_link",
  "outdated_tools", "skills_count", "bullet_length", "summary_length", "interests_present", "generic_interests",
  "leadership_lexicon", "projects_count", "project_stack", "spelling",
] as const;
export type CheckerId = (typeof CHECKER_IDS)[number];

export type Citation = { title: string; publisher: string; year: string; url: string };

export type CvRule = {
  id: string;
  sectors: Archetype[] | "all";
  dimension: Dimension;
  statement: string;
  check: "code" | "llm";
  checker?: CheckerId;
  params?: { maxPages?: number; threshold?: number };
  severity: Severity;
  evidence: Evidence;
  citations: Citation[];
  yearAdjust?: Partial<Record<Year, { severity?: Severity; threshold?: number; skip?: boolean }>>;
  /** Per-sector severity override for rules shared across sectors (e.g. FCQ rules milder for quant). */
  sectorAdjust?: Partial<Record<Archetype, { severity?: Severity }>>;
  llmGuidance?: string;
};
