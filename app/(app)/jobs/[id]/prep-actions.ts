import "server-only";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getActiveCv, getJob } from "@/lib/db/queries";
import { isUuid } from "@/lib/feed/save-result";
import { isPastSaved } from "@/lib/tracker/status";
import { currentModelId } from "@/lib/ai/models";
import { aiMode } from "@/lib/env";
import { generatePrepPack, mapStories, PrepResult } from "@/lib/ai/interviewPrep";
import { roleKey } from "@/lib/interview-prep/sources";
import { getOrCreatePrep, type PrepView } from "@/lib/interview-prep/service";

const GONE = "This role is no longer available.";

/**
 * Interview prep for a job the student has applied to: shared pack (cached per company + role family) plus their CV
 * stories. Called by /api/interview-prep/[jobId], not a server action (server actions run one at a time).
 */
export async function getInterviewPrep(jobId: string): Promise<PrepView | { error: string }> {
  if (!isUuid(jobId)) return { error: GONE };
  const { supabase, user } = await requireUser();
  const [job, cv, app, jobRow] = await Promise.all([
    getJob(supabase, jobId),
    getActiveCv(supabase, user.id),
    supabase.from("applications").select("status").eq("user_id", user.id).eq("job_id", jobId).maybeSingle(),
    supabase.from("jobs").select("company_id").eq("id", jobId).maybeSingle(),
  ]);
  if (!job || !jobRow.data) return { error: GONE };
  if (!isPastSaved(app.data?.status as string | undefined)) return { error: "Mark this role as applied to unlock interview prep." };

  const companyId = jobRow.data.company_id as number;
  const key = roleKey(job);
  const admin = createAdminClient();
  return getOrCreatePrep({
    key: `${companyId}:${key}`,
    cache: aiMode() !== "fixture",
    now: () => new Date(),
    readCache: async () => {
      const { data } = await supabase.from("interview_preps").select("pack, sources, grounded, created_at").eq("company_id", companyId).eq("role_key", key).maybeSingle();
      if (!data) return null;
      const parsed = PrepResult.safeParse({ pack: data.pack, sources: data.sources, grounded: data.grounded });
      return parsed.success ? { ...parsed.data, createdAt: data.created_at as string } : null;
    },
    countRecent: async (since) => {
      const { count, error } = await admin.from("interview_preps").select("company_id", { count: "exact", head: true }).eq("created_by", user.id).gte("created_at", since);
      if (error || count === null) throw new Error(`interview prep: daily count unavailable${error ? `: ${error.message}` : ""}`);
      return count;
    },
    writeCache: async (r, createdAt) => {
      const { error } = await admin.from("interview_preps").upsert({
        company_id: companyId, role_key: key, pack: r.pack, sources: r.sources, grounded: r.grounded,
        model_id: currentModelId("fast"), created_by: user.id, created_at: createdAt,
      }, { onConflict: "company_id,role_key" });
      if (error) throw new Error(error.message);
    },
    generate: () => generatePrepPack({ company: job.company, jobTitle: job.title, roleKey: key, jdText: job.textLines.join("\n"), fixtureKey: job.extId }),
    stories: (r) => (cv ? mapStories({ questions: r.pack.questions, cvText: cv.rawText ?? "", fixtureKey: job.extId }) : Promise.resolve([])),
  });
}
