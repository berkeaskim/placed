"use server";
import { requireUser } from "@/lib/supabase/server";
import { awardXP } from "@/lib/gamify/award";
import { isUuid, SAVE_FAILED, toSaveResult, type SaveResult } from "@/lib/feed/save-result";

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
