"use server";
import { and, count, desc, eq, gte } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { outreach } from "@/lib/db/schema";
import { isUuid } from "@/lib/feed/save-result";
import { GROUPS, type Group } from "@/lib/inside-track/types";
import { firstName, noteOf } from "@/lib/inside-track/view";
import { cleanDraftInput } from "@/lib/outreach/input";
import { draftAndStore } from "@/lib/outreach/store";

const DAILY_DRAFTS = 8;

/** A sample connection note for one person: the model sees the first name, the row keeps the full name. */
export async function draftInsideTrack(jobId: string, group: unknown, fullName: unknown, rewrite: unknown = false):
  Promise<{ ok: true; id: string | null; note: string; removed: string[] } | { ok: false; message: string }> {
  const name = typeof fullName === "string" ? fullName.replace(/\s+/g, " ").trim().slice(0, 60) : "";
  if (!isUuid(jobId) || !GROUPS.includes(group as Group) || !name) return { ok: false, message: "Something's off with that request." };
  const input = cleanDraftInput({ target: group, purpose: "intro", recipientName: firstName(name), note: null });
  if (!input) return { ok: false, message: "Something's off with that request." };
  const { user } = await requireUser();
  const mine = and(eq(outreach.user_id, user.id), eq(outreach.job_id, jobId));
  if (rewrite !== true) {
    // Auto-drafts can fire twice (a second tab, a reload mid-draft): an existing draft for this person is returned, not redone.
    const prev = db.select({ id: outreach.id, body: outreach.body }).from(outreach)
      .where(and(mine, eq(outreach.target, group as Group), eq(outreach.recipient_name, name)))
      .orderBy(desc(outreach.created_at)).limit(1).get();
    if (prev) return { ok: true, id: prev.id, note: noteOf(prev.body), removed: [] };
  }
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const today = db.select({ n: count() }).from(outreach).where(and(mine, gte(outreach.created_at, since))).get()?.n ?? 0;
  if (today >= DAILY_DRAFTS) return { ok: false, message: "That's plenty of drafts for one role today. Come back tomorrow." };
  const r = await draftAndStore(jobId, input, name);
  if (!r.ok) return r;
  return { ok: true, id: r.id, note: noteOf(r.draft.connectionNote), removed: r.draft.removed };
}
