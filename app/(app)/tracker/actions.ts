"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { awardXP } from "@/lib/gamify/award";
import { loadJobFit } from "@/lib/db/fit";
import { isUuid } from "@/lib/feed/save-result";
import { isAppStatus, STATUS_EVENT } from "@/lib/tracker/status";
import type { AwardResult, GamifyEvent } from "@/lib/gamify/core";
import type { AppStatus } from "@/lib/types";

/**
 * Moves an application to `status` (validated server-side) and awards the stage XP once per (type, job): the DB's
 * unique index makes repeats worth 0. Moving back never removes XP. For "applied" the fit label is computed here.
 */
export async function updateStatus(appId: string, status: AppStatus): Promise<AwardResult | null> {
  if (!isUuid(appId) || !isAppStatus(status)) return null;
  const { supabase, user } = await requireUser();
  const { data: app, error } = await supabase.from("applications")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", appId).eq("user_id", user.id).select("job_id").maybeSingle();
  revalidatePath("/tracker");
  if (error || !app || status === "saved") return null;
  try {
    const type = STATUS_EVENT[status];
    let event: GamifyEvent = { type };
    if (status === "applied") {
      const loaded = await loadJobFit(supabase, user.id, app.job_id);
      if (loaded) event = { type, fitLabel: loaded.fit.label, jobTitle: loaded.job.title, deadline: loaded.job.deadline };
    }
    return await awardXP(supabase, user.id, event, app.job_id);
  } catch (e) {
    console.error("updateStatus: award failed", e instanceof Error ? e.message : e);
    return null; // the move itself is saved
  }
}
