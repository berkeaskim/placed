import "server-only";
import { getBank } from "@/lib/bank/store";
import type { JobForScoring } from "@/lib/types";
import { springContext, springQuestions, type SpringContext } from "./spring-bank";
import { suggestStories, type StorySuggestion } from "./spring-stories";

export type SpringPrep = { ctx: SpringContext; stories: StorySuggestion[]; bankEmpty: boolean };

/** Spring week prep for the job page, or null when the job is not a spring week (it then gets the generic pack). */
export function springPrep(userId: string, job: { employmentType: JobForScoring["employmentType"]; company: string; title: string }): SpringPrep | null {
  if (job.employmentType !== "spring_week") return null;
  const ctx = springContext(job.company, job.title);
  const bank = getBank(userId);
  return { ctx, stories: suggestStories(bank, springQuestions(ctx)), bankEmpty: bank.entries.length === 0 };
}
