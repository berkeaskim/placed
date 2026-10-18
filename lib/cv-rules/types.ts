import type { Archetype, Year } from "@/lib/types";

export type Dimension = "ats" | "impact" | "clarity" | "relevance" | "uk";
export type Severity = "critical" | "major" | "minor";
export type Evidence = "A" | "B" | "C" | "D";
/** Verdicts for a rule. `partial` is only valid for rules with `allowPartial: true`. */
export type RuleStatus = "pass" | "fail" | "not_applicable" | "partial";

export const CHECKER_IDS = [
  "text_layer", "file_size", "page_count", "section_headings", "education_first", "contact_present",
  "uk_personal_details", "quantified_bullets", "we_vs_i", "skill_rating_glyphs", "uk_grades", "github_link",
  "outdated_tools", "skills_count", "bullet_length", "summary_length", "interests_present", "generic_interests",
  "leadership_lexicon", "projects_count", "project_stack", "spelling",
  // CV amendments (2026-10-13): implemented later (Task 17 / feat/cv-modules).
  "experience_present", "skills_evidenced", "cliche_density", "read_time", "hidden_text", "prompt_injection",
  // Spring-week track (research/spring-weeks/07-cv-rules-design.md).
  "pre_uni_grades", "gcse_summarised",
] as const;
export type CheckerId = (typeof CHECKER_IDS)[number];

export type Citation = { title: string; publisher: string; year: string; url: string };

/**
 * What the CV is being scored for. "spring": spring weeks and insight programmes (first-years), where academics and
 * activities carry the CV and no internship is expected. "standard": everything else.
 */
export const TRACKS = ["standard", "spring"] as const;
export type Track = (typeof TRACKS)[number];

export type RuleAdjust = { severity?: Severity; threshold?: number; skip?: boolean; maxPages?: number };

type CvRuleBase = {
  id: string;
  sectors: Archetype[] | "all";
  dimension: Dimension;
  statement: string;
  /** threshold: pass/fail cut-off; majorThreshold: level at which the finding escalates to major. */
  params?: { maxPages?: number; threshold?: number; majorThreshold?: number };
  severity: Severity;
  evidence: Evidence;
  citations: Citation[];
  yearAdjust?: Partial<Record<Year, RuleAdjust>>;
  /** Track override. Wins over yearAdjust: the track describes the application, the year only the student. */
  trackAdjust?: Partial<Record<Track, RuleAdjust>>;
  /** The rule only exists on these tracks (absent = every track). */
  tracks?: Track[];
  /** Per-sector severity override for rules shared across sectors (e.g. FCQ rules milder for quant). */
  sectorAdjust?: Partial<Record<Archetype, { severity?: Severity }>>;
  /** For llm rules: one yes/no question. For code rules: optional notes for the checker or UI. */
  llmGuidance?: string;
  passExample?: string;
  failExample?: string;
  /** Only for llm rules whose partial verdict is defined numerically in llmGuidance. */
  allowPartial?: true;
  /** Findings block PDF export until fixed (hidden text, prompt injection). */
  blocksExport?: true;
};

export type CvRule = CvRuleBase &
  (
    | { check: "code"; checker: CheckerId }
    | { check: "llm"; checker?: undefined; llmGuidance: string; passExample: string; failExample: string }
  );
