import "server-only";
import { unstable_cache } from "next/cache";
import { getLiveJobs, type JobListItem } from "@/lib/db/queries";
import { jdRequirementSkills, type JdSkill } from "@/lib/scoring/coverage";

export const JOBS_TAG = "jobs";

/** A live job with its requirement skills already parsed; `textLines` is dropped since nothing downstream reads it. */
export type FeedJob = JobListItem & { jdSkills: JdSkill[] };

/**
 * Parsed requirement skills per live job id, shared across requests. Parsing is the slow part (~300 ms for ~1.3k jobs);
 * only these go in the cache because whole jobs (requirements included) outgrow Next's 2 MB entry limit and then never
 * cache. Jobs only change on ingest: pass the last run's time as `version` so a run from anywhere (button, background
 * scheduler, `npm run ingest`) is picked up at once; the button also expires JOBS_TAG.
 */
const getJdSkillsById = unstable_cache(
  async (...[today]: [today: string, version?: string | null]): Promise<Record<string, JdSkill[]>> => {
    const jobs = await getLiveJobs(today);
    return Object.fromEntries(jobs.map((j) => [j.id, jdRequirementSkills(j.textLines, j.requirements)]));
  },
  ["feed-jd-skills-v1"],
  { tags: [JOBS_TAG], revalidate: 600 },
);

/** Live jobs for the feed. The row read itself is a fast local SQLite query; a job the cached map doesn't know yet is parsed here. */
export async function getFeedJobs(today: string, version?: string | null): Promise<FeedJob[]> {
  const [jobs, skills] = await Promise.all([getLiveJobs(today), getJdSkillsById(today, version)]);
  return jobs.map((j) => ({ ...j, jdSkills: skills[j.id] ?? jdRequirementSkills(j.textLines, j.requirements), textLines: [] }));
}
