"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { applications } from "@/lib/db/schema";
import { awardXP } from "@/lib/gamify/award";
import { loadJobFit } from "@/lib/db/fit";
import { statusAfterApply } from "@/lib/tracker/status";
import type { AwardResult } from "@/lib/gamify/core";
import { isUuid, SAVE_FAILED, toSaveResult, type SaveResult } from "@/lib/feed/save-result";

export type ApplyResult = { ok: boolean; award: AwardResult | null; error?: string };
const APPLY_FAILED = "Couldn't record that — try again.";

/** Saves a job to the user's tracker and awards job_saved XP once per job. */
export async function saveJob(jobId: string): Promise<SaveResult> {
  if (!isUuid(jobId)) return { ok: false, award: null, error: SAVE_FAILED };
  const { user } = await requireUser();
  try {
    // do nothing on conflict: an existing row (saved, applied, ...) is never downgraded back to "saved"
    db.insert(applications).values({ user_id: user.id, job_id: jobId, status: "saved" }).onConflictDoNothing().run();
  } catch (e) {
    console.error("saveJob: upsert failed", e instanceof Error ? e.message : e);
    return toSaveResult(true, null);
  }
  try {
    return toSaveResult(false, await awardXP(user.id, { type: "job_saved" }, jobId));
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
  const { user } = await requireUser();
  const loaded = await loadJobFit(user.id, jobId);
  if (!loaded) return { ok: false, award: null, error: "This role is no longer available." };
  const existing = db.select({ status: applications.status }).from(applications)
    .where(and(eq(applications.user_id, user.id), eq(applications.job_id, jobId))).get();

  // never move a later stage (interview / offer / rejected) back to "applied"
  if (statusAfterApply(existing?.status)) {
    try {
      const set = { status: "applied" as const, updated_at: new Date().toISOString() };
      db.insert(applications).values({ user_id: user.id, job_id: jobId, ...set })
        .onConflictDoUpdate({ target: [applications.user_id, applications.job_id], set }).run();
    } catch (e) {
      console.error("markApplied: upsert failed", e instanceof Error ? e.message : e);
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
    const award = await awardXP(user.id, { type: "applied", fitLabel: fit.label, jobTitle: job.title, deadline: job.deadline }, jobId);
    return { ok: true, award };
  } catch (e) {
    console.error("markApplied: award failed", e instanceof Error ? e.message : e);
    return { ok: true, award: null }; // the application itself is recorded
  }
}
