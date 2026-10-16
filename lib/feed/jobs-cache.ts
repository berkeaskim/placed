import "server-only";
import { unstable_cache } from "next/cache";
import { getLiveJobs, type JobListItem } from "@/lib/db/queries";
import { jdRequirementSkills, type JdSkill } from "@/lib/scoring/coverage";

export const JOBS_TAG = "jobs";

/** A live job with its requirement skills already parsed; `textLines` is dropped to keep the cache entry small. */
export type FeedJob = JobListItem & { jdSkills: JdSkill[] };

/**
 * Live jobs for the feed, shared across requests. Jobs only change on ingest, which revalidates JOBS_TAG; seed scripts
 * are picked up within `revalidate`. Without this every feed load re-read every posting and re-parsed its requirements.
 */
export const getFeedJobs = unstable_cache(
  async (today: string): Promise<FeedJob[]> => {
    const jobs = await getLiveJobs(today);
    return jobs.map((j) => ({ ...j, jdSkills: jdRequirementSkills(j.textLines, j.requirements), textLines: [] }));
  },
  ["feed-jobs-v1"],
  { tags: [JOBS_TAG], revalidate: 600 },
);
