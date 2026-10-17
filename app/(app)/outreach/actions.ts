"use server";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { outreach } from "@/lib/db/schema";
import { isUuid } from "@/lib/feed/save-result";
import { cleanDraftInput } from "@/lib/outreach/input";
import { draftAndStore, type DraftResult } from "@/lib/outreach/store";

export async function draftOutreachAction(
  jobId: string, raw: { target: unknown; purpose: unknown; recipientName: unknown; note: unknown },
): Promise<DraftResult> {
  const input = cleanDraftInput(raw);
  if (!isUuid(jobId) || !input) return { ok: false, message: "Something's off with that request." };
  return draftAndStore(jobId, input, input.recipientName);
}

export async function setOutreachStatus(id: string, status: "sent" | "replied"): Promise<boolean> {
  if (!isUuid(id) || (status !== "sent" && status !== "replied")) return false;
  const { user } = await requireUser();
  try {
    db.update(outreach).set({ status, updated_at: new Date().toISOString() }).where(and(eq(outreach.id, id), eq(outreach.user_id, user.id))).run();
    return true;
  } catch {
    return false;
  }
}
