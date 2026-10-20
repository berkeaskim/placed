import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { applications, interviewPreps, jobs } from "@/lib/db/schema";
import { getActiveCv, getJob } from "@/lib/db/queries";
import { isUuid } from "@/lib/feed/save-result";
import { isPastSaved } from "@/lib/tracker/status";
import { currentModelId } from "@/lib/ai/models";
import { aiMode } from "@/lib/ai/config";
import { generatePrepPack, mapStories, PrepResult } from "@/lib/ai/interviewPrep";
import { roleKey } from "@/lib/interview-prep/sources";
import { getOrCreatePrep, type PrepView } from "@/lib/interview-prep/service";

const GONE = "This role is no longer available.";
export const SPRING_OWN_PREP = "Spring weeks have their own interview prep on this page.";

/**
 * Interview prep for a job the student has applied to: shared pack (cached per company + role family) plus their CV
 * stories. Called by /api/interview-prep/[jobId], not a server action (server actions run one at a time).
 */
export async function getInterviewPrep(jobId: string): Promise<PrepView | { error: string }> {
  if (!isUuid(jobId)) return { error: GONE };
  const { user } = await requireUser();
  const [job, cv] = await Promise.all([getJob(jobId), getActiveCv(user.id)]);
  const app = db.select({ status: applications.status }).from(applications)
    .where(and(eq(applications.user_id, user.id), eq(applications.job_id, jobId))).get();
  const jobRow = db.select({ company_id: jobs.company_id }).from(jobs).where(eq(jobs.id, jobId)).get();
  if (!job || !jobRow) return { error: GONE };
  // Spring weeks have their own local prep (SpringPrepPanel): a generic internship pack is never built or cached for one.
  if (job.employmentType === "spring_week") return { error: SPRING_OWN_PREP };
  if (!isPastSaved(app?.status)) return { error: "Mark this role as applied to unlock interview prep." };

  const companyId = jobRow.company_id;
  const key = roleKey(job);
  return getOrCreatePrep({
    key: `${companyId}:${key}`,
    cache: aiMode() !== "fixture",
    now: () => new Date(),
    readCache: async () => {
      const data = db.select({ pack: interviewPreps.pack, sources: interviewPreps.sources, grounded: interviewPreps.grounded, created_at: interviewPreps.created_at })
        .from(interviewPreps).where(and(eq(interviewPreps.company_id, companyId), eq(interviewPreps.role_key, key))).get();
      if (!data) return null;
      const parsed = PrepResult.safeParse({ pack: data.pack, sources: data.sources, grounded: data.grounded });
      return parsed.success ? { ...parsed.data, createdAt: data.created_at } : null;
    },
    countRecent: async (since) => {
      return db.select({ n: count() }).from(interviewPreps)
        .where(and(eq(interviewPreps.created_by, user.id), gte(interviewPreps.created_at, since))).get()?.n ?? 0;
    },
    writeCache: async (r, createdAt) => {
      const row = {
        company_id: companyId, role_key: key, pack: r.pack, sources: r.sources, grounded: r.grounded,
        model_id: currentModelId("fast"), created_by: user.id, created_at: createdAt,
      };
      db.insert(interviewPreps).values(row).onConflictDoUpdate({ target: [interviewPreps.company_id, interviewPreps.role_key], set: row }).run();
    },
    generate: () => generatePrepPack({ company: job.company, jobTitle: job.title, roleKey: key, jdText: job.textLines.join("\n"), fixtureKey: job.extId }),
    stories: (r) => (cv ? mapStories({ questions: r.pack.questions, cvText: cv.rawText ?? "", fixtureKey: job.extId }) : Promise.resolve([])),
  });
}
