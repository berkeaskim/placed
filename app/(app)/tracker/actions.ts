"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { applications } from "@/lib/db/schema";
import { awardXP } from "@/lib/gamify/award";
import { loadJobFit } from "@/lib/db/fit";
import { isUuid } from "@/lib/feed/save-result";
import { isAppStatus, STATUS_EVENT } from "@/lib/tracker/status";
import { canAccept, isChecklistKey, statusClearsAcceptance } from "@/lib/tracker/placement";
import type { AwardResult, GamifyEvent } from "@/lib/gamify/core";
import type { AppStatus } from "@/lib/types";

/**
 * Moves an application to `status` (validated server-side) and awards the stage XP once per (type, job): the DB's
 * unique index makes repeats worth 0. Moving back never removes XP. For "applied" the fit label is computed here.
 */
export async function updateStatus(appId: string, status: AppStatus): Promise<AwardResult | null> {
  if (!isUuid(appId) || !isAppStatus(status)) return null;
  const { user } = await requireUser();
  let app: { job_id: string } | undefined;
  try {
    app = db.update(applications).set({ status, updated_at: new Date().toISOString(), ...(statusClearsAcceptance(status) ? { accepted_at: null } : {}) })
      .where(and(eq(applications.id, appId), eq(applications.user_id, user.id))).returning({ job_id: applications.job_id }).get();
  } catch (e) {
    console.error("updateStatus: update failed", e instanceof Error ? e.message : e);
  }
  revalidatePath("/tracker");
  if (!app || status === "saved") return null;
  try {
    const type = STATUS_EVENT[status];
    let event: GamifyEvent = { type };
    if (status === "applied") {
      const loaded = await loadJobFit(user.id, app.job_id);
      if (loaded) event = { type, fitLabel: loaded.fit.label, jobTitle: loaded.job.title, deadline: loaded.job.deadline };
    }
    return await awardXP(user.id, event, app.job_id);
  } catch (e) {
    console.error("updateStatus: award failed", e instanceof Error ? e.message : e);
    return null; // the move itself is saved
  }
}

/** "I've accepted this offer" (or undo). Only an offer can be accepted; accepting a placement stops placement suggestions. */
export async function setAccepted(appId: string, accepted: boolean): Promise<boolean> {
  if (!isUuid(appId)) return false;
  const { user } = await requireUser();
  const row = db.select({ status: applications.status }).from(applications)
    .where(and(eq(applications.id, appId), eq(applications.user_id, user.id))).get();
  if (!row || !isAppStatus(row.status) || !canAccept(row.status)) return false;
  db.update(applications).set({ accepted_at: accepted ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
    .where(and(eq(applications.id, appId), eq(applications.user_id, user.id))).run();
  revalidatePath("/tracker");
  revalidatePath("/feed");
  return true;
}

/** Ticks one step of the after-acceptance checklist. */
export async function setChecklistItem(appId: string, key: string, done: boolean): Promise<boolean> {
  if (!isUuid(appId) || !isChecklistKey(key)) return false;
  const { user } = await requireUser();
  const row = db.select({ checklist: applications.checklist }).from(applications)
    .where(and(eq(applications.id, appId), eq(applications.user_id, user.id))).get();
  if (!row) return false;
  db.update(applications).set({ checklist: { ...(row.checklist ?? {}), [key]: done } })
    .where(and(eq(applications.id, appId), eq(applications.user_id, user.id))).run();
  revalidatePath("/tracker");
  return true;
}
