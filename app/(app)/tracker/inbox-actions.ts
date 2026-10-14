"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isUuid } from "@/lib/feed/save-result";
import { isAppStatus } from "@/lib/tracker/status";
import { todayLondon } from "@/lib/scoring/dates";
import { isDemoEmail } from "@/lib/demo/is-demo";
import { demoEmails } from "@/lib/gmail/fixtures";
import { decryptToken } from "@/lib/gmail/crypto";
import { dropConnection } from "@/lib/gmail/connection";
import { refreshAccessToken } from "@/lib/gmail/oauth";
import { GmailAuthError, buildGmailQuery, fetchRecentEmails } from "@/lib/gmail/search";
import { classifyEmail } from "@/lib/inbox/classify";
import { planInboxEvents, safeClassify } from "@/lib/inbox/plan";
import { canUndo, nextDeadline } from "@/lib/inbox/rules";
import { companyMatches } from "@/lib/inbox/match";
import type { AppRef, Classification, RawEmail } from "@/lib/inbox/types";
import { updateStatus } from "./actions";

export type SyncResult =
  | { ok: true; moved: number; suggested: number; scanned: number }
  | { ok: false; reason: "not_connected" | "reconnect" | "failed" };

type Db = ReturnType<typeof createAdminClient>;

async function loadApps(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string): Promise<AppRef[]> {
  const { data } = await supabase.from("applications").select("id, job_id, status, jobs(title, companies(name))").eq("user_id", userId);
  return (data ?? []).filter((a) => isAppStatus(a.status)).map((a) => {
    const j = a.jobs as unknown as { title: string; companies: { name: string } | null } | null;
    return { id: a.id, jobId: a.job_id, status: a.status, title: j?.title ?? "", company: j?.companies?.name ?? "" };
  });
}

/** Recompute next_deadline/last_event_at for the touched applications from all their events. */
async function refreshDeadlines(db: Db, userId: string, appIds: string[]): Promise<void> {
  const today = todayLondon();
  for (const id of new Set(appIds)) {
    const { data } = await db.from("inbox_events").select("deadline, received_at").eq("user_id", userId).eq("application_id", id);
    const rows = data ?? [];
    const last = rows.map((r) => r.received_at as string).sort().at(-1) ?? null;
    await db.from("applications").update({ next_deadline: nextDeadline(rows.map((r) => r.deadline as string | null), today), last_event_at: last })
      .eq("id", id).eq("user_id", userId);
  }
}

export async function syncInbox(): Promise<SyncResult> {
  const { supabase, user } = await requireUser();
  const db = createAdminClient();
  const apps = await loadApps(supabase, user.id);

  let emails: RawEmail[];
  const demoById = new Map<string, Classification>();
  if (isDemoEmail(user.email)) {
    const set = demoEmails(); // once, so email dates and deadlines share one `now`
    for (const d of set) demoById.set(d.email.id, d.classification);
    emails = set.map((d) => d.email);
  } else {
    const { data: conn } = await db.from("gmail_connections").select("refresh_token_enc").eq("user_id", user.id).maybeSingle();
    if (!conn) return { ok: false, reason: "not_connected" };
    try {
      const access = await refreshAccessToken(decryptToken(conn.refresh_token_enc));
      emails = await fetchRecentEmails(access, buildGmailQuery(apps.map((a) => a.company)));
    } catch (e) {
      if (e instanceof GmailAuthError) { await dropConnection(db, user.id, false); return { ok: false, reason: "reconnect" }; }
      console.error("syncInbox: Gmail fetch failed", e instanceof Error ? e.message : e);
      return { ok: false, reason: "failed" };
    }
  }

  const { data: seenRows } = await supabase.from("inbox_events").select("gmail_message_id").eq("user_id", user.id);
  const planned = await planInboxEvents({
    apps, emails, seen: new Set((seenRows ?? []).map((r) => r.gmail_message_id as string)),
    classify: safeClassify((e) => classifyEmail(e, demoById.get(e.id))),
  });

  let moved = 0, suggested = 0;
  for (const p of planned) {
    if (p.decision.effect === "moved" && p.appId) {
      await updateStatus(p.appId, p.decision.to); // same path as a drag: XP once per stage, fit label for "applied"
      moved++;
    }
    if (p.decision.effect === "suggested") suggested++;
    const { error } = await db.from("inbox_events").insert({
      user_id: user.id, gmail_message_id: p.email.id, application_id: p.appId, company: p.c.company,
      subject: p.email.subject.slice(0, 300), received_at: p.email.date, kind: p.c.kind, deadline: p.c.deadline,
      action_url: p.c.actionUrl, confidence: p.c.confidence, effect: p.decision.effect,
      prev_status: p.prevStatus, new_status: p.decision.effect === "moved" ? p.decision.to : null,
    });
    if (error && error.code !== "23505") console.error("syncInbox: insert failed", error.message); // 23505 = a parallel sync got there first
  }
  await refreshDeadlines(db, user.id, planned.map((p) => p.appId).filter((x): x is string => !!x));
  await db.from("gmail_connections").update({ last_synced_at: new Date().toISOString() }).eq("user_id", user.id);
  revalidatePath("/tracker");
  return { ok: true, moved, suggested, scanned: emails.length };
}

export async function undoInboxEvent(eventId: string): Promise<{ ok: boolean; message?: string }> {
  if (!isUuid(eventId)) return { ok: false };
  const { supabase, user } = await requireUser();
  const { data: ev } = await supabase.from("inbox_events").select("id, effect, application_id, prev_status, new_status").eq("id", eventId).eq("user_id", user.id).maybeSingle();
  if (!ev?.application_id || !ev.prev_status) return { ok: false };
  const { data: app } = await supabase.from("applications").select("status").eq("id", ev.application_id).eq("user_id", user.id).maybeSingle();
  if (!app || !canUndo(ev, app.status)) return { ok: false, message: "This card has moved since, so there's nothing to undo." };
  await supabase.from("applications").update({ status: ev.prev_status, updated_at: new Date().toISOString() }).eq("id", ev.application_id).eq("user_id", user.id);
  await createAdminClient().from("inbox_events").update({ effect: "undone" }).eq("id", ev.id).eq("user_id", user.id);
  revalidatePath("/tracker");
  return { ok: true };
}

export async function disconnectGmail(): Promise<void> {
  const { user } = await requireUser();
  const db = createAdminClient();
  await dropConnection(db, user.id, true);
  await db.from("inbox_events").delete().eq("user_id", user.id);
  revalidatePath("/tracker");
}

/** "Not in your tracker — add it?": saves the newest live role at that company, if Placed has one. */
export async function addSuggestedApplication(eventId: string): Promise<{ ok: boolean; message?: string }> {
  if (!isUuid(eventId)) return { ok: false };
  const { supabase, user } = await requireUser();
  const { data: ev } = await supabase.from("inbox_events").select("id, company, kind").eq("id", eventId).eq("user_id", user.id).maybeSingle();
  if (!ev?.company) return { ok: false };
  const { data: jobs } = await supabase.from("jobs").select("id, posted_at, companies!inner(name)").eq("is_live", true).order("posted_at", { ascending: false }).limit(500);
  const job = (jobs ?? []).find((j) => companyMatches(ev.company!, (j.companies as unknown as { name: string }).name));
  if (!job) return { ok: false, message: `Placed doesn't list a live ${ev.company} role, so it can't be tracked here yet.` };
  const status = ev.kind === "rejection" ? "rejected" : ev.kind === "interview" ? "interview" : ev.kind === "offer" ? "offer" : "applied";
  const { data: app, error } = await supabase.from("applications").upsert({ user_id: user.id, job_id: job.id, status: "saved" }, { onConflict: "user_id,job_id" }).select("id").single();
  if (error || !app) return { ok: false };
  await updateStatus(app.id, status);
  await createAdminClient().from("inbox_events").update({ application_id: app.id, effect: "moved", prev_status: "saved", new_status: status }).eq("id", ev.id).eq("user_id", user.id);
  revalidatePath("/tracker");
  return { ok: true };
}
