"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { awardXP } from "@/lib/gamify/award";
import { loadJobFit } from "@/lib/db/fit";
import { statusAfterApply } from "@/lib/tracker/status";
import type { AwardResult } from "@/lib/gamify/core";
import { isUuid, SAVE_FAILED, toSaveResult, type SaveResult } from "@/lib/feed/save-result";

export type ApplyResult = { ok: boolean; award: AwardResult | null; error?: string };
const APPLY_FAILED = "Couldn't record that — try again.";

/** Saves a job to the user's tracker (user-scoped client, RLS applies) and awards job_saved XP once per job. */
export async function saveJob(jobId: string): Promise<SaveResult> {
  if (!isUuid(jobId)) return { ok: false, award: null, error: SAVE_FAILED };
  const { supabase, user } = await requireUser();
  // ignoreDuplicates: an existing row (saved, applied, ...) is never downgraded back to "saved"
  const { error } = await supabase.from("applications").upsert(
    { user_id: user.id, job_id: jobId, status: "saved" },
    { onConflict: "user_id,job_id", ignoreDuplicates: true },
  );
  if (error) {
    console.error("saveJob: upsert failed", error.message);
    return toSaveResult(true, null);
  }
  try {
    return toSaveResult(false, await awardXP(supabase, user.id, { type: "job_saved" }, jobId));
  } catch (e) {
    console.error("saveJob: award failed", e instanceof Error ? e.message : e);
    return toSaveResult(false, null); // the save itself succeeded
  }
}

/**
 * "Did you apply?" -> Yes, and the "Mark as applied" buttons on the job page and feed card. The student applied on
 * the company's own site; we only record it.
 * The fit label (which sets the XP) is computed here from the DB, never taken from the client.
 */
export async function markApplied(jobId: string): Promise<ApplyResult> {
  if (!isUuid(jobId)) return { ok: false, award: null, error: APPLY_FAILED };
  const { supabase, user } = await requireUser();
  const [loaded, existing] = await Promise.all([
    loadJobFit(supabase, user.id, jobId),
    supabase.from("applications").select("status").eq("user_id", user.id).eq("job_id", jobId).maybeSingle(),
  ]);
  if (!loaded) return { ok: false, award: null, error: "This role is no longer available." };

  // never move a later stage (interview / offer / rejected) back to "applied"
  if (statusAfterApply(existing.data?.status as string | undefined)) {
    const { error } = await supabase.from("applications").upsert(
      { user_id: user.id, job_id: jobId, status: "applied", updated_at: new Date().toISOString() },
      { onConflict: "user_id,job_id" },
    );
    if (error) {
      console.error("markApplied: upsert failed", error.message);
      return { ok: false, award: null, error: APPLY_FAILED };
    }
  }

  // the tracker shows it under Applied; the feed and job page re-render so the Save button shows saved too
  revalidatePath("/tracker");
  revalidatePath("/feed");
  revalidatePath(`/jobs/${jobId}`);
  const { job, fit } = loaded;
  try {
    // `applied` is awarded once per job (unique index), so a second "Yes" earns nothing.
    const award = await awardXP(supabase, user.id, { type: "applied", fitLabel: fit.label, jobTitle: job.title, deadline: job.deadline }, jobId);
    return { ok: true, award };
  } catch (e) {
    console.error("markApplied: award failed", e instanceof Error ? e.message : e);
    return { ok: true, award: null }; // the application itself is recorded
  }
}
