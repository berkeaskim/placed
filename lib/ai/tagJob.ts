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

function fromOutput(o: TagJobOutputT): TaggedJob {
  return {
    archetype: o.archetype,
    fieldTags: o.field_tags,
    yearEligibility: o.year_eligibility,
    sponsorsVisa: o.sponsors_visa,
    employmentType: o.employment_type,
    firstYearFriendly: o.first_year_friendly,
    deadline: o.deadline && /^\d{4}-\d{2}-\d{2}$/.test(o.deadline) ? o.deadline : null,
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
            parts: [{ type: "text", text: `Title: ${input.title}\n${wrapJob(input.textLines.join("\n"))}` }],
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
