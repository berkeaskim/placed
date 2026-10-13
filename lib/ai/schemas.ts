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

const Bullet = z.object({ id: z.string(), text: z.string() });
const Entry = z.object({ id: z.string(), org: z.string(), title: z.string(), dates: z.string(), location: z.string(), bullets: z.array(Bullet) });
export const ArchetypeScoreOut = z.object({ key: z.enum(ARCHETYPES), score: z.number(), why: z.array(z.string()) });

export const ParsedCvOutput = z.object({
  name: z.string(), email: z.string().nullable(), phone: z.string().nullable(), location: z.string().nullable(),
  links: z.array(z.string()), summary: z.string().nullable(),
  education: z.array(z.object({ id: z.string(), institution: z.string(), degree: z.string(), dates: z.string(), grade: z.string().nullable(), details: z.array(Bullet) })),
  experience: z.array(Entry), projects: z.array(Entry), leadership: z.array(Entry),
  skills: z.array(z.object({ group: z.string(), items: z.array(z.string()) })),
  interests: z.string().nullable(), sectionOrder: z.array(z.string()),
  yearGuess: z.enum(YEARS).nullable(), archetypes: z.array(ArchetypeScoreOut),
});
