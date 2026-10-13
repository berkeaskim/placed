import type { Archetype, JobForScoring, Requirement, Year } from "@/lib/types";
import { canonicalize } from "@/lib/skills/extract";
import { generateStructured, runAi } from "./provider";
import { SYSTEM_TAG_JOB, wrapJob } from "./prompts";
import { TagJobOutput, type TagJobOutputT } from "./schemas";
import { heuristicTagJob } from "./heuristics";

export type TaggedJob = {
  archetype: Archetype;
  fieldTags: string[];
  yearEligibility: Year[];
  sponsorsVisa: "yes" | "no" | "unknown";
  employmentType: JobForScoring["employmentType"];
  firstYearFriendly: boolean;
  deadline: string | null;
  summary: string;
  requirements: Requirement[];
  status: "ok" | "failed";
};

/** YYYY-MM-DD that is a real calendar date (2026-02-31 is rejected via a Date round-trip), else null. */
export function normalizeDeadline(d: string | null | undefined): string | null {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return null;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d ? d : null;
}

type RequirementOutT = TagJobOutputT["requirements"][number];

/** One Requirement per named skill, so "Excel and financial modelling" keeps both; "X or Y" share an anyOf group. */
function expandRequirement(r: RequirementOutT): Requirement[] {
  // enforce the inferred cap in code, whatever the model said
  const importance = r.evidence_tier === "inferred" && (r.importance === "critical" || r.importance === "high") ? "meaningful" : r.importance;
  const base = { text: r.text, importance, section: r.section, evidenceTier: r.evidence_tier } as const;
  const skills = [...new Set(r.skills.map((s) => s.trim()).filter(Boolean).map((s) => canonicalize(s) ?? s))];
  if (skills.length === 0) return [{ ...base, skill: null }];
  const anyOf = r.skill_logic === "any" && skills.length > 1 ? skills : undefined;
  return skills.map((skill) => (anyOf ? { ...base, skill, anyOf } : { ...base, skill }));
}

function fromOutput(o: TagJobOutputT): TaggedJob {
  return {
    archetype: o.archetype,
    fieldTags: o.field_tags,
    yearEligibility: o.year_eligibility,
    sponsorsVisa: o.sponsors_visa,
    employmentType: o.employment_type,
    firstYearFriendly: o.first_year_friendly,
    deadline: normalizeDeadline(o.deadline),
    summary: o.summary,
    requirements: o.requirements.flatMap(expandRequirement),
    status: "ok",
  };
}

export async function tagJob(input: { title: string; textLines: string[] }): Promise<TaggedJob> {
  const fallback = () => heuristicTagJob(input);
  try {
    return await runAi({
      fn: "tagJob",
      schema: TagJobOutput,
      fromFixture: fromOutput,
      live: async () =>
        fromOutput(
          await generateStructured({
            tier: "fast",
            system: SYSTEM_TAG_JOB,
            parts: [{ type: "text", text: wrapJob(input.textLines.join("\n"), input.title) }],
            schema: TagJobOutput,
            maxTokens: 8000, // Gemini counts thinking tokens here; 4000 truncated long JDs
          }),
        ),
      fallback,
    });
  } catch {
    return { ...fallback(), status: "failed" };
  }
}
