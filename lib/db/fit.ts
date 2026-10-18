import { getActiveCv, getJob, getProfile, toStudent } from "@/lib/db/queries";
import { coverageFor } from "@/lib/scoring/coverage";
import { scoreFit } from "@/lib/scoring/fit";
import { todayLondon } from "@/lib/scoring/dates";
import { cvGradeOf } from "@/lib/scoring/eligibility";
import { hasEligibilityOverride } from "@/lib/feed/overrides";

/** Server-side fit for one job from the DB (profile + active CV). Shared by markApplied and the tracker: labels are never client-sent. */
export async function loadJobFit(userId: string, jobId: string) {
  const [job, profile, cv] = await Promise.all([getJob(jobId), getProfile(userId), getActiveCv(userId)]);
  if (!job) return null;
  const student = toStudent(profile);
  // same context as the feed and the job page, so the tracker label matches what the student saw
  const fit = scoreFit(student, job, coverageFor(job, cv?.parsed ?? null, student.skills), todayLondon(), {
    cvGrade: cvGradeOf(cv?.parsed), course: profile.course, overridden: hasEligibilityOverride(userId, jobId),
  });
  return { job, fit };
}
