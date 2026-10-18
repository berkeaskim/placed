import "server-only";
import { unstable_cache } from "next/cache";
import { getLiveJobs, type JobListItem } from "@/lib/db/queries";
import { jdRequirementSkills, type JdSkill } from "@/lib/scoring/coverage";
import { parseEligibility, type EligibilitySignals } from "@/lib/scoring/eligibility";
import { LOCAL_USER_ID } from "@/lib/auth/local-user";
import { eligibilityOverrideIds } from "./overrides";

export const JOBS_TAG = "jobs";

/**
 * A live job with its requirement skills and eligibility signals already parsed; `textLines` is dropped since nothing
 * downstream reads it. `eligibilityOverride`: the local user marked this job's eligibility check as wrong.
 */
export type FeedJob = JobListItem & { jdSkills: JdSkill[]; elig: EligibilitySignals; eligibilityOverride: boolean };
type Parsed = { skills: JdSkill[]; elig: EligibilitySignals };
const parse = (j: JobListItem): Parsed => ({ skills: jdRequirementSkills(j.textLines, j.requirements), elig: parseEligibility(j.title, j.textLines) });

/**
 * Parsed requirement skills per live job id, shared across requests. Parsing is the slow part (~300 ms for ~1.3k jobs);
 * only these go in the cache because whole jobs (requirements included) outgrow Next's 2 MB entry limit and then never
 * cache. Jobs only change on ingest: pass the last run's time as `version` so a run from anywhere (button, background
 * scheduler, `npm run ingest`) is picked up at once; the button also expires JOBS_TAG.
 */
const getParsedById = unstable_cache(
  async (...[today]: [today: string, version?: string | null]): Promise<Record<string, Parsed>> => {
    const jobs = await getLiveJobs(today);
    return Object.fromEntries(jobs.map((j) => [j.id, parse(j)]));
  },
  ["feed-jd-skills-v2"],
  { tags: [JOBS_TAG], revalidate: 600 },
);

/**
 * Live jobs for the feed. The row read itself is a fast local SQLite query; a job the cached map doesn't know yet is
 * parsed here. Overrides are read fresh (never cached) so "This is wrong" shows on the next render.
 */
export async function getFeedJobs(today: string, version?: string | null): Promise<FeedJob[]> {
  const [jobs, parsed] = await Promise.all([getLiveJobs(today), getParsedById(today, version)]);
  const overrides = eligibilityOverrideIds(LOCAL_USER_ID);
  return jobs.map((j) => {
    const p = parsed[j.id] ?? parse(j);
    return { ...j, jdSkills: p.skills, elig: p.elig, eligibilityOverride: overrides.has(j.id), textLines: [] };
  });
}
