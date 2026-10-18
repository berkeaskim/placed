import { z } from "zod";
import { YEARS } from "@/lib/types";

const Day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const Source = z.object({
  title: z.string().optional(),
  publisher: z.string().optional(),
  url: z.string().url().optional(),
  primary: z.boolean().optional(),
  quote: z.string().min(1),
  accessed: Day,
});

export const Signal = z.object({
  id: z.string(),
  text: z.string(),
  grade: z.enum(["A", "B", "C", "D"]),
  basis: z.string().optional(),
  note: z.string().optional(),
  ruleIds: z.array(z.string()),
  sources: z.array(Source).min(1),
});

/**
 * How much an action is worth as evidence (06#3). Ranking and XP use it; the UI shows it as a chip.
 * cv_high: a strong CV line (real users, client work, selective programme); cv_medium: a solid CV line;
 * cv_low: minor CV line or Courses section only; interview_prep / test_prep: practice that never goes on a CV.
 */
export const SIGNAL_VALUES = ["cv_high", "cv_medium", "cv_low", "interview_prep", "test_prep"] as const;
export type SignalValue = (typeof SIGNAL_VALUES)[number];

export const Action = z.object({
  id: z.string(),
  type: z.enum(["project", "course", "experience"]),
  title: z.string(),
  description: z.string(),
  skills: z.array(z.string()),
  signals: z.array(z.string()),
  effort: z.enum(["weekend", "2-4 weeks", "term"]),
  minYear: z.enum(YEARS),
  /** Last year of study the programme is open to (e.g. first-year-only insight weeks). */
  maxYear: z.enum(YEARS).optional(),
  /**
   * Programmes that key on graduation year (spring weeks: "students graduating in 2029"). When the student has
   * a graduation year, it decides eligibility instead of minYear/maxYear.
   */
  eligibleGradYears: z.array(z.number().int().min(2020).max(2040)).optional(),
  /**
   * build: something the student does (project, course, society) that can close a skill gap.
   * opportunity: a selective programme they apply to. It is an outcome, never a "way to get" a skill (06#4).
   */
  kind: z.enum(["build", "opportunity"]),
  signalValue: z.enum(SIGNAL_VALUES),
  /** The research doc's own honest label, e.g. "none on CV; test practice only". */
  signalNote: z.string().optional(),
  /** Job simulations (Forage): never CV experience, so completing one never becomes a tailoring fact. */
  simulation: z.boolean().optional(),
  cost: z.string().optional(),
  /** Opportunities: what applying and taking part involve, shown instead of the effort chip (06#28, 07#17). */
  commitment: z.string().optional(),
  /** Eligibility limits that rule people out, in plain words (right to work, nationality, membership, cohort). */
  eligibility: z.string().optional(),
  /** A linked programme that runs every year, so it needs no expiresOn/reviewBy. */
  evergreen: z.boolean().optional(),
  evidence: z.string(),
  url: z.string().url().optional(),
  howToFind: z.string().optional(),
  verified: z.boolean().nullable().optional(),
  expiresOn: Day.optional(),
  reviewBy: Day.optional(),
  sources: z.array(Source),
});

export const DatedGuidance = z.object({
  year: z.enum(YEARS),
  text: z.string(),
  expiresOn: Day.optional(),
  /** "Expected" dates: shown with a check-the-page note after this day, hidden 30 days later. */
  reviewBy: Day.optional(),
  /** Lines for one graduating class ("for 2029 graduates"): shown by graduation year when the student has one. */
  gradYears: z.array(z.number().int().min(2020).max(2040)).optional(),
  ref: z.string().optional(),
});

export const Playbook = z.object({
  signals: z.array(Signal),
  actions: z.array(Action),
  yearGuidance: z.partialRecord(z.enum(YEARS), z.string()),
  yearGuidanceDated: z.array(DatedGuidance).default([]),
  note: z.string().optional(),
});

export type Source = z.infer<typeof Source>;
export type Signal = z.infer<typeof Signal>;
export type Action = z.infer<typeof Action>;
export type Playbook = z.infer<typeof Playbook>;
