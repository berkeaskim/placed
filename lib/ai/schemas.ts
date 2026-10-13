import { z } from "zod";
import { ARCHETYPES, YEARS } from "@/lib/types";

export const RequirementOut = z.object({
  text: z.string(),
  skill: z.string().nullable(),
  importance: z.enum(["critical", "high", "meaningful", "preferred", "low_signal"]),
  section: z.enum(["must", "nice"]),
  evidence_tier: z.enum(["stated", "structural", "inferred"]),
});

export const TagJobOutput = z.object({
  archetype: z.enum(ARCHETYPES),
  field_tags: z.array(z.string()),
  year_eligibility: z.array(z.enum(YEARS)),
  sponsors_visa: z.enum(["yes", "no", "unknown"]),
  employment_type: z.enum(["internship", "placement", "spring_week", "insight", "graduate", "permanent", "other"]),
  first_year_friendly: z.boolean(),
  deadline: z.string().nullable(),
  summary: z.string(),
  requirements: z.array(RequirementOut),
});
export type TagJobOutputT = z.infer<typeof TagJobOutput>;
