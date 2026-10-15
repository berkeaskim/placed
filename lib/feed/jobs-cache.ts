import "server-only";
import { unstable_cache } from "next/cache";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import { getLiveJobs, type JobListItem } from "@/lib/db/queries";
import { jdRequirementSkills, type JdSkill } from "@/lib/scoring/coverage";

export const JOBS_TAG = "jobs";

/** A live job with its requirement skills already parsed; `textLines` is dropped to keep the cache entry small. */
export type FeedJob = JobListItem & { jdSkills: JdSkill[] };

/**
 * Live jobs for the feed, shared across users and requests. Jobs are public (RLS `public_read`) and only change on
 * ingest, which revalidates JOBS_TAG; seed scripts are picked up within `revalidate`. Without this every feed load
 * pulled ~1 MB of posting text and re-parsed every job's requirements.
 */
export const getFeedJobs = unstable_cache(
  async (today: string): Promise<FeedJob[]> => {
    const db = createClient(env.supabaseUrl, env.supabaseAnonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const jobs = await getLiveJobs(db, today);
    return jobs.map((j) => ({ ...j, jdSkills: jdRequirementSkills(j.textLines, j.requirements), textLines: [] }));
  },
  ["feed-jobs-v1"],
  { tags: [JOBS_TAG], revalidate: 600 },
);
