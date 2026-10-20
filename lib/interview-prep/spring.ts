import "server-only";
import { getBank } from "@/lib/bank/store";
import type { JobForScoring } from "@/lib/types";
import { springContext, springQuestions, type SpringContext } from "./spring-bank";
import { suggestStories, type StorySuggestion } from "./spring-stories";
import { bansAiInInterviews, coachOnlyNotice } from "./banks";

/** `coachOnly`: the employer bans AI in interviews and assessments; the panel says so up front (the notice text). */
export type SpringPrep = { ctx: SpringContext; stories: StorySuggestion[]; bankEmpty: boolean; coachOnly: string | null };

/** Spring week prep for the job page, or null when the job is not a spring week (it then gets the generic pack). */
export function springPrep(userId: string, job: { employmentType: JobForScoring["employmentType"]; company: string; title: string; textLines?: string[] }): SpringPrep | null {
  if (job.employmentType !== "spring_week") return null;
  const ctx = springContext(job.company, job.title);
  const bank = getBank(userId);
  const coachOnly = bansAiInInterviews(job.company, (job.textLines ?? []).join("\n")) ? coachOnlyNotice(job.company) : null;
  return { ctx, stories: suggestStories(bank, springQuestions(ctx)), bankEmpty: bank.entries.length === 0, coachOnly };
}
