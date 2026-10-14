import { z } from "zod";
import { ARCHETYPES, YEARS } from "@/lib/types";

export const RequirementOut = z.object({
  text: z.string(),
  skills: z.array(z.string()),
  skill_logic: z.enum(["all", "any"]),
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

/**
 * judgeCvRules raw output. `status` is a free string on purpose: anything outside
 * pass | fail | not_applicable (| partial for allowPartial rules) is mapped to not_applicable in code,
 * so one odd verdict never fails the whole call.
 */
export const JudgeOutput = z.object({
  verdicts: z.array(z.object({
    rule_id: z.string(),
    status: z.string(),
    evidence_line: z.string().nullable(),
    fix: z.string().nullable(),
  })),
  spelling_errors: z.array(z.string()),
});
export type JudgeOutputT = z.infer<typeof JudgeOutput>;

/** quizToArchetypes raw output. Only `why` lines and `skills` are used: the ranking stays deterministic (Task 19). */
export const QuizOutput = z.object({ archetypes: z.array(ArchetypeScoreOut), skills: z.array(z.string()) });
export type QuizOutputT = z.infer<typeof QuizOutput>;

/**
 * explainMatch raw output. The model only judges each FIXED requirement index (importance comes from tagJob
 * and is never re-rated); code maps indices back onto the requirements (lib/ai/explainMatch.ts toExplanation).
 */
export const ExplainOutput = z.object({
  rows: z.array(z.object({ index: z.number().int(), match: z.enum(["strong", "partial", "missing"]), cv_evidence: z.string().nullable() })),
  why_fit: z.array(z.string()),
  gaps: z.array(z.object({ index: z.number().int(), blocking: z.boolean(), adjacent_experience: z.string().nullable(), how_to_close: z.string() })),
});
export type ExplainOutputT = z.infer<typeof ExplainOutput>;

/** tailorCV raw output (spec §7.1, 05 §2 [2]). Education and interests are not part of it: code copies them from the source CV. */
const TailorChangeTypeOut = z.enum(["kept", "reordered", "rephrased", "merged", "dropped"]);
const TBullet = z.object({
  id: z.string(), text: z.string(), sourceRefs: z.array(z.string()), changeType: TailorChangeTypeOut,
  qualifiersKept: z.array(z.string()), keywordsAdded: z.array(z.string()), dropReason: z.string().nullable(),
});
const TEntry = z.object({ id: z.string(), org: z.string(), title: z.string(), dates: z.string(), location: z.string(), bullets: z.array(TBullet) });
const TChange = z.object({ bulletId: z.string(), before: z.string(), after: z.string(), reason: z.string(), jdRequirement: z.string().nullable(), keywordsAdded: z.array(z.string()) });
export const TailoredCvOutput = z.object({
  summary: z.string().nullable(),
  experience: z.array(TEntry), projects: z.array(TEntry), leadership: z.array(TEntry),
  skills: z.array(z.object({ group: z.string(), items: z.array(z.string()) })),
  changes: z.array(TChange),
});
export type TailoredCvOutputT = z.infer<typeof TailoredCvOutput>;

/**
 * The same shape, lenient, for recorded fixtures (C6): an older or hand-written fixture that omits the
 * per-bullet extras or a section still loads and goes through the same post-processing as live output.
 */
const TBulletLoose = TBullet.extend({
  changeType: TailorChangeTypeOut.optional(), qualifiersKept: z.array(z.string()).default([]),
  keywordsAdded: z.array(z.string()).default([]), dropReason: z.string().nullable().default(null),
});
const TEntryLoose = TEntry.extend({ dates: z.string().default(""), location: z.string().default(""), bullets: z.array(TBulletLoose) });
export const TailoredCvFixture = z.object({
  summary: z.string().nullable().default(null),
  experience: z.array(TEntryLoose).default([]), projects: z.array(TEntryLoose).default([]), leadership: z.array(TEntryLoose).default([]),
  skills: z.array(z.object({ group: z.string(), items: z.array(z.string()) })).default([]),
  changes: z.array(TChange.extend({ jdRequirement: z.string().nullable().default(null), keywordsAdded: z.array(z.string()).default([]) })).default([]),
});
export type TailoredCvFixtureT = z.infer<typeof TailoredCvFixture>;
