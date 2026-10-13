import { z } from "zod";
import { YEARS } from "@/lib/types";

export const FIELDS = ["Economics", "Computer Science", "Mathematics", "Engineering", "Physics", "Management", "Finance & Accounting", "Statistics & Data Science", "Law", "Psychology", "Politics & IR", "History", "Natural Sciences", "Other"] as const;

export const OnboardingInput = z.object({
  year: z.enum(YEARS),
  field: z.enum(FIELDS),
  locationPref: z.array(z.enum(["london", "uk", "europe", "remote"])).min(1).max(4),
  needsVisa: z.boolean(),
});
export type OnboardingInputT = z.infer<typeof OnboardingInput>;
