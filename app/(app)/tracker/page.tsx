import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isAppStatus } from "@/lib/tracker/status";
import { isDemoEmail } from "@/lib/demo/is-demo";
import { todayLondon } from "@/lib/scoring/dates";
import { InboxBanner } from "@/components/tracker/inbox-banner";
import { InboxSuggestions, type Suggestion } from "@/components/tracker/inbox-suggestions";
import type { AppStatus } from "@/lib/types";
import { Board, type Card } from "./board";

type Ev = { id: string; application_id: string | null; company: string | null; subject: string; received_at: string; kind: string;
  deadline: string | null; action_url: string | null; effect: string; new_status: AppStatus | null };

const DEADLINE_LABEL: Record<string, string> = { assessment: "Assessment", interview: "Interview" };

export default async function Tracker({ searchParams }: { searchParams: Promise<{ gmail?: string }> }) {
  const { supabase, user } = await requireUser();
  const today = todayLondon();
  const [{ data }, { data: evs }, { data: conn }] = await Promise.all([
    supabase.from("applications").select("id, job_id, status, next_deadline, last_event_at, updated_at, jobs(title, companies(name))")
      .eq("user_id", user.id).order("updated_at", { ascending: false }),
    supabase.from("inbox_events").select("id, application_id, company, subject, received_at, kind, deadline, action_url, effect, new_status")
      .eq("user_id", user.id).order("received_at", { ascending: false }).limit(300),
    createAdminClient().from("gmail_connections").select("google_email, last_synced_at").eq("user_id", user.id).maybeSingle(),
  ]);
  const events = (evs ?? []) as Ev[];
  const cards: Card[] = (data ?? []).filter((a) => isAppStatus(a.status)).map((a) => {
    const j = a.jobs as unknown as { title: string; companies: { name: string } | null } | null;
    const mine = events.filter((e) => e.application_id === a.id);
    const moved = mine.find((e) => e.effect === "moved");
    const due = mine.filter((e) => e.deadline && e.deadline === a.next_deadline)[0];
    return {
      id: a.id, jobId: a.job_id, status: a.status, title: j?.title ?? "Role", company: j?.companies?.name ?? "",
      updatedAt: a.updated_at, lastEventAt: a.last_event_at,
      evidence: moved ? { eventId: moved.id, subject: moved.subject, date: moved.received_at, to: moved.new_status!, canUndo: moved.new_status === a.status } : null,
      deadline: due ? { date: due.deadline!, label: DEADLINE_LABEL[due.kind] ?? "Deadline", url: due.action_url } : null,
    };
  });
  const suggestions: Suggestion[] = events.filter((e) => e.effect === "suggested")
    .map((e) => ({ eventId: e.id, subject: e.subject, company: e.company, reason: e.application_id ? "matched" : "unmatched" }));
  const flash = { connected: "Gmail connected. Press Sync inbox.", denied: "Gmail wasn't connected.", error: "Couldn't connect Gmail. Try again.",
    unconfigured: "Gmail isn't set up on this server yet." }[(await searchParams).gmail ?? ""] ?? null;
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[28px] font-extrabold tracking-tight">Your applications</h1>
      <InboxBanner connected={!!conn} googleEmail={conn?.google_email ?? null} lastSynced={conn?.last_synced_at ?? null} demo={isDemoEmail(user.email)} flash={flash} />
      <InboxSuggestions items={suggestions} />
      {cards.length === 0
        ? <p className="card-quest p-6 font-semibold">Save a role from your feed to start tracking.</p>
        : <Board cards={cards} today={today} />}
    </div>
  );
}
