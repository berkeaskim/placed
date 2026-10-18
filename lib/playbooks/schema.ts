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
