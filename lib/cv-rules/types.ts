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
  // Placement track (research/placement-year/05-application-content.md §4a).
  "first_year_marks", "placement_grad_date",
  // Audit 2026-10-18: photo detection from the upload scan; a "Curriculum Vitae" title line.
  "photo_present", "cv_title",
  // Engineering and science (research/placement-year/07 §4.3): CEng, MIMechE, MRSC used without holding them.
  "protected_titles",
] as const;
export type CheckerId = (typeof CHECKER_IDS)[number];

export type Citation = { title: string; publisher: string; year: string; url: string };

/**
 * What the CV is being scored for. "spring": spring weeks and insight programmes (first-years), where academics and
 * activities carry the CV and no internship is expected. "standard": everything else.
 */
export const TRACKS = ["standard", "spring", "placement"] as const;
export type Track = (typeof TRACKS)[number];

export type RuleAdjust = { severity?: Severity; threshold?: number; skip?: boolean; maxPages?: number };

/**
 * Per-sector override for a rule shared across sectors (audit 2026-10-18, 04#2): one detector is one rule,
 * and sectors change its severity, thresholds or wording here instead of adding a duplicate rule id.
 * `yearAdjust` here replaces the rule's own yearAdjust for that sector.
 */
export type SectorAdjust = {
  severity?: Severity;
  maxPages?: number;
  threshold?: number;
  statement?: string;
  /** Sources for this sector's version (shown first on the fix card); the rule's own citations still apply. */
  citations?: Citation[];
  yearAdjust?: Partial<Record<Year, RuleAdjust>>;
};

/**
 * Context an llm rule needs that the CV alone doesn't give. Without it the rule is not_applicable and is never
 * sent to the judge (audit 03#5: the judge must not guess). "jd": a job advert. "variant": the target division
 * (IBD / S&T / AM, quant research vs trading), which Placed doesn't collect yet.
 */
export type RuleNeed = "jd" | "variant";

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
  /** Per-sector overrides for rules shared across sectors (e.g. one page and critical for finance). */
  sectorAdjust?: Partial<Record<Archetype, SectorAdjust>>;
  /**
   * llm rules only: the judge may answer not_applicable (the guidance says when). Any other not_applicable from
   * the judge is treated as could_not_assess, so a judge that dodges a rule can't raise the score (04#1).
   */
  naAllowed?: true;
  /** llm rules only: context the rule can't be judged without (see RuleNeed). */
  needs?: RuleNeed[];
  /** For llm rules: one yes/no question. For code rules: optional notes for the checker or UI. */
  llmGuidance?: string;
  passExample?: string;
  failExample?: string;
  /** Only for llm rules whose partial verdict is defined numerically in llmGuidance. */
  allowPartial?: true;
  /**
   * The statement's AI-policy sentence depends on the target firm (FCQ-12, audit 02#1): with a target company the
   * generic sentence after the first is replaced by lib/employer-policy's aiPolicyLine() for that firm.
   */
  firmPolicy?: true;
  /** Findings block PDF export until fixed (hidden text, prompt injection). */
  blocksExport?: true;
};

export type CvRule = CvRuleBase &
  (
    | { check: "code"; checker: CheckerId }
    | { check: "llm"; checker?: undefined; llmGuidance: string; passExample: string; failExample: string }
  );
