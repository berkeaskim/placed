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
import { claimEffect, classifierFor, planInboxEvents, safeClassify, unseenBatch } from "@/lib/inbox/plan";
import { canUndo, nextDeadline, targetStatus } from "@/lib/inbox/rules";
import { companyMatches } from "@/lib/inbox/match";
import type { AppRef, Classification, InboxKind, RawEmail } from "@/lib/inbox/types";
import { updateStatus } from "./actions";

export type SyncResult =
  | { ok: true; moved: number; suggested: number; scanned: number; remaining: number }
  | { ok: false; reason: "not_connected" | "reconnect" | "failed" };

type Db = ReturnType<typeof createAdminClient>;

async function loadApps(supabase: Awaited<ReturnType<typeof requireUser>>["supabase"], userId: string): Promise<AppRef[] | null> {
  const { data, error } = await supabase.from("applications").select("id, job_id, status, jobs(title, companies(name))").eq("user_id", userId);
  if (error) { console.error("syncInbox: loading applications failed", error.message); return null; }
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
  if (!apps) return { ok: false, reason: "failed" };

  // Seen ids first: Gmail bodies of recorded messages are never downloaded (or classified) again.
  const { data: seenRows, error: seenErr } = await supabase.from("inbox_events").select("gmail_message_id").eq("user_id", user.id);
  if (seenErr) { console.error("syncInbox: loading seen messages failed", seenErr.message); return { ok: false, reason: "failed" }; }
  const seen = new Set((seenRows ?? []).map((r) => r.gmail_message_id as string));

  let emails: RawEmail[];
  const demo = isDemoEmail(user.email);
  const demoById = new Map<string, Classification>();
  if (demo) {
    const set = demoEmails(); // once, so email dates and deadlines share one `now`
    for (const d of set) demoById.set(d.email.id, d.classification);
    emails = set.map((d) => d.email);
  } else {
    const { data: conn } = await db.from("gmail_connections").select("refresh_token_enc").eq("user_id", user.id).maybeSingle();
    if (!conn) return { ok: false, reason: "not_connected" };
    let refresh: string;
    try { refresh = decryptToken(conn.refresh_token_enc); }
    catch { await dropConnection(db, user.id, false); return { ok: false, reason: "reconnect" }; } // rotated/wrong GMAIL_TOKEN_KEY
    try {
      const access = await refreshAccessToken(refresh);
      emails = await fetchRecentEmails(access, buildGmailQuery(apps.map((a) => a.company)), 100, seen);
    } catch (e) {
      if (e instanceof GmailAuthError) { await dropConnection(db, user.id, false); return { ok: false, reason: "reconnect" }; }
      console.error("syncInbox: Gmail fetch failed", e instanceof Error ? e.message : e);
      return { ok: false, reason: "failed" };
    }
  }

  // The demo account never reaches the model (deterministic on stage, whatever AI_MODE is).
  const planned = await planInboxEvents({ apps, emails, seen, classify: safeClassify(classifierFor(demo, demoById, (e) => classifyEmail(e))) });
  const { remaining } = unseenBatch(emails, seen);

  let moved = 0, suggested = 0;
  const touched: string[] = [];
  for (const p of planned) {
    if (p.failed) continue; // not recorded, so the next sync retries it
    // The insert is the claim: the unique (user_id, gmail_message_id) means only one sync ever acts on a message.
    const { data: row, error } = await db.from("inbox_events").insert({
      user_id: user.id, gmail_message_id: p.email.id, application_id: p.appId, company: p.c.company,
      subject: p.email.subject.slice(0, 300), received_at: p.email.date, kind: p.c.kind, deadline: p.c.deadline,
      action_url: p.c.actionUrl, confidence: p.c.confidence, effect: claimEffect(p.decision), prev_status: null, new_status: null,
    }).select("id").single();
    if (error || !row) {
      if (error?.code !== "23505") console.error("syncInbox: insert failed", error?.message); // 23505 = another sync claimed it
      continue;
    }
    if (p.appId) touched.push(p.appId);
    if (p.decision.effect === "suggested") { suggested++; continue; }
    if (p.decision.effect !== "moved" || !p.appId) continue;

    // The board may have changed since planning (a drag, a parallel sync): re-read and recompute before moving.
    const { data: cur } = await supabase.from("applications").select("status").eq("id", p.appId).eq("user_id", user.id).maybeSingle();
    const from = cur && isAppStatus(cur.status) ? cur.status : null;
    const to = from ? targetStatus(from, p.c.kind) : null;
    let done = false;
    if (from && to) {
      await updateStatus(p.appId, to); // same path as a drag: XP once per stage, fit label for "applied"
      // updateStatus returns null both on failure and when only the XP award failed, so the card itself is the signal
      const { data: after } = await supabase.from("applications").select("status").eq("id", p.appId).eq("user_id", user.id).maybeSingle();
      done = after?.status === to;
    }
    if (done) {
      const { error: upErr } = await db.from("inbox_events").update({ effect: "moved", prev_status: from, new_status: to }).eq("id", row.id).eq("user_id", user.id);
      if (upErr) console.error("syncInbox: confirming move failed", upErr.message);
    }
    if (done) moved++;
  }
  await refreshDeadlines(db, user.id, touched);
  await db.from("gmail_connections").update({ last_synced_at: new Date().toISOString() }).eq("user_id", user.id);
  revalidatePath("/tracker");
  return { ok: true, moved, suggested, scanned: emails.length, remaining };
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

/** Clears a row from "Emails to review" without touching any card. */
export async function dismissInboxSuggestion(eventId: string): Promise<{ ok: boolean }> {
  if (!isUuid(eventId)) return { ok: false };
  const { user } = await requireUser();
  const { error } = await createAdminClient().from("inbox_events").update({ effect: "none" })
    .eq("id", eventId).eq("user_id", user.id).eq("effect", "suggested");
  if (error) { console.error("dismissInboxSuggestion: update failed", error.message); return { ok: false }; }
  revalidatePath("/tracker");
  return { ok: true };
}

/** "Not in your tracker — add it?": saves the newest live role at that company, if Placed has one. */
export async function addSuggestedApplication(eventId: string): Promise<{ ok: boolean; message?: string }> {
  if (!isUuid(eventId)) return { ok: false };
  const { supabase, user } = await requireUser();
  const { data: ev } = await supabase.from("inbox_events").select("id, company, kind, effect, application_id").eq("id", eventId).eq("user_id", user.id).maybeSingle();
  if (!ev || ev.effect !== "suggested") return { ok: false };
  let appId = ev.application_id as string | null;
  if (!appId) {
    if (!ev.company) return { ok: false };
    const { data: jobs } = await supabase.from("jobs").select("id, posted_at, companies!inner(name)").eq("is_live", true).order("posted_at", { ascending: false }).limit(500);
    const job = (jobs ?? []).find((j) => companyMatches(ev.company!, (j.companies as unknown as { name: string }).name));
    if (!job) return { ok: false, message: `Placed doesn't list a live ${ev.company} role, so it can't be tracked here yet.` };
    // Insert-if-absent: an already-tracked job keeps its status (an email never moves a card backwards or revives a rejected one).
    await supabase.from("applications").upsert({ user_id: user.id, job_id: job.id, status: "saved" }, { onConflict: "user_id,job_id", ignoreDuplicates: true });
    const { data: found } = await supabase.from("applications").select("id").eq("user_id", user.id).eq("job_id", job.id).maybeSingle();
    appId = found?.id ?? null;
  }
  // A matched (low-confidence) suggestion already names its card: act on that one, never on another job at the company.
  const { data: app } = appId ? await supabase.from("applications").select("id, status").eq("id", appId).eq("user_id", user.id).maybeSingle() : { data: null };
  if (!app || !isAppStatus(app.status)) return { ok: false };
  const to = targetStatus(app.status, ev.kind as InboxKind);
  const db = createAdminClient();
  if (!to) {
    const { error: linkErr } = await db.from("inbox_events").update({ application_id: app.id, effect: "none" }).eq("id", ev.id).eq("user_id", user.id);
    if (linkErr) console.error("addSuggestedApplication: linking event failed", linkErr.message);
    else await refreshDeadlines(db, user.id, [app.id]); // the linked email's deadline now counts for this card
    revalidatePath("/tracker");
    return { ok: true, message: "Already tracked, so nothing was moved." };
  }
  await updateStatus(app.id, to);
  const { data: after } = await supabase.from("applications").select("status").eq("id", app.id).eq("user_id", user.id).maybeSingle();
  const done = after?.status === to;
  // Only a confirmed move is logged as "moved"; otherwise the event just links the card.
  const { error: upErr } = await db.from("inbox_events").update(done
    ? { application_id: app.id, effect: "moved", prev_status: app.status, new_status: to }
    : { application_id: app.id, effect: "none" }).eq("id", ev.id).eq("user_id", user.id);
  if (upErr) console.error("addSuggestedApplication: updating event failed", upErr.message);
  else await refreshDeadlines(db, user.id, [app.id]);
  revalidatePath("/tracker");
  return { ok: done };
}
