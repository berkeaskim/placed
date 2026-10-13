"use server";
import { requireUser } from "@/lib/supabase/server";
import { awardXP } from "@/lib/gamify/award";
import type { AwardResult } from "@/lib/gamify/core";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Saves a job to the user's tracker (user-scoped client, RLS applies) and awards job_saved XP once per job. */
export async function saveJob(jobId: string): Promise<AwardResult | null> {
  if (typeof jobId !== "string" || !UUID.test(jobId)) return null;
  const { supabase, user } = await requireUser();
  // ignoreDuplicates: an existing row (saved, applied, ...) is never downgraded back to "saved"
  const { error } = await supabase.from("applications").upsert(
    { user_id: user.id, job_id: jobId, status: "saved" },
    { onConflict: "user_id,job_id", ignoreDuplicates: true },
  );
  if (error) return null;
  try {
    return await awardXP(supabase, user.id, { type: "job_saved" }, jobId);
  } catch {
    return null; // the save itself succeeded; a failed XP award must not break the button
  }
}
