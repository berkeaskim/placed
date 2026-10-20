import "server-only";
import { getBank } from "@/lib/bank/store";
import type { JobForScoring } from "@/lib/types";
import { bansAiInInterviews, coachOnlyNotice } from "./ai-ban";
import { placementContext, placementQuestions, type PlacementContext } from "./placement-bank";
import { suggestStories, type StorySuggestion } from "./spring-stories";

/** `coachOnly`: the employer bans AI in interviews and assessments; the panel says so up front (the notice text). */
export type PlacementPrep = { ctx: PlacementContext; stories: StorySuggestion[]; bankEmpty: boolean; coachOnly: string | null };

/** Placement prep for the job page (alongside the generic pack), or null when the job is not a placement. */
export function placementPrep(userId: string, job: Pick<JobForScoring, "employmentType" | "title" | "archetype" | "textLines"> & { company: string }): PlacementPrep | null {
  if (job.employmentType !== "placement") return null;
  const ctx = placementContext(job);
  const bank = getBank(userId);
  const coachOnly = bansAiInInterviews(job.company, job.textLines.join("\n")) ? coachOnlyNotice(job.company) : null;
  return { ctx, stories: suggestStories(bank, placementQuestions(ctx)), bankEmpty: bank.entries.length === 0, coachOnly };
}
