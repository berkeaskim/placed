import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveCv, getJob, getProfile, toStudent } from "@/lib/db/queries";
import { coverageFor } from "@/lib/scoring/coverage";
import { scoreFit } from "@/lib/scoring/fit";
import { todayLondon } from "@/lib/scoring/dates";

/** Server-side fit for one job from the DB (profile + active CV). Shared by markApplied and the tracker: labels are never client-sent. */
export async function loadJobFit(supabase: SupabaseClient, userId: string, jobId: string) {
  const [job, profile, cv] = await Promise.all([getJob(supabase, jobId), getProfile(supabase, userId), getActiveCv(supabase, userId)]);
  if (!job) return null;
  const student = toStudent(profile);
  return { job, fit: scoreFit(student, job, coverageFor(job, cv?.parsed ?? null, student.skills), todayLondon()) };
}
