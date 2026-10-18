import { z } from "zod";
import { WORK_AUTH, YEARS } from "@/lib/types";

export const FIELDS = ["Economics", "Computer Science", "Mathematics", "Engineering", "Physics", "Management", "Finance & Accounting", "Statistics & Data Science", "Law", "Psychology", "Politics & IR", "History", "Natural Sciences", "Other"] as const;

/** Free text, tidied: a name needs at least one letter and fits a profile line. */
const Name = z.string().transform((s) => s.replace(/\s+/g, " ").trim()).pipe(z.string().min(2).max(120).regex(/\p{L}/u));

export const GradYear = z.number().int().min(2020).max(2040);

export const OnboardingInput = z.object({
  university: Name,
  course: Name,
  year: z.enum(YEARS),
  /** Expected graduation year; optional so older clients and tests still validate. */
  gradYear: GradYear.nullish(),
  locationPref: z.array(z.enum(["london", "uk", "europe", "remote"])).min(1).max(4),
  needsVisa: z.boolean(),
  /** Optional so older clients still validate; when present it decides needsVisa. */
  workAuth: z.enum(WORK_AUTH).nullish(),
});
export type OnboardingInputT = z.infer<typeof OnboardingInput>;
