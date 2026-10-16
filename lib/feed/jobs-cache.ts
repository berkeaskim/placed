import "server-only";
import { unstable_cache } from "next/cache";
import { getLiveJobs, type JobListItem } from "@/lib/db/queries";
import { jdRequirementSkills, type JdSkill } from "@/lib/scoring/coverage";

export const JOBS_TAG = "jobs";

/** A live job with its requirement skills already parsed; `textLines` is dropped to keep the cache entry small. */
export type FeedJob = JobListItem & { jdSkills: JdSkill[] };

/**
 * Live jobs for the feed, shared across requests. Jobs only change on ingest: pass the last run's time as `version` so
 * a run from anywhere (button, background scheduler, `npm run ingest`) is picked up at once; the button also expires
 * JOBS_TAG. Without this every feed load re-read every posting and re-parsed its requirements.
 */
export const getFeedJobs = unstable_cache(
  async (today: string, _version: string | null = null): Promise<FeedJob[]> => {
    const jobs = await getLiveJobs(today);
    return jobs.map((j) => ({ ...j, jdSkills: jdRequirementSkills(j.textLines, j.requirements), textLines: [] }));
  },
  ["feed-jobs-v1"],
  { tags: [JOBS_TAG], revalidate: 600 },
);
