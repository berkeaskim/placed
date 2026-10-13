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
    requirements: o.requirements.map((r) => ({
      text: r.text,
      skill: r.skill ? canonicalize(r.skill) ?? r.skill : null,
      // enforce the inferred cap in code, whatever the model said
      importance: r.evidence_tier === "inferred" && (r.importance === "critical" || r.importance === "high") ? "meaningful" : r.importance,
      section: r.section,
      evidenceTier: r.evidence_tier,
    })),
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
            maxTokens: 4000,
          }),
        ),
      fallback,
    });
  } catch {
    return { ...fallback(), status: "failed" };
  }
}
