"use client";
import { useState, useTransition } from "react";
import { addSuggestedApplication, dismissInboxSuggestion } from "@/app/(app)/tracker/inbox-actions";

/** `matched` = the email already points at one of the student's cards (low confidence); `unmatched` = no card yet. */
export type Suggestion = { eventId: string; subject: string; company: string | null; reason: "unmatched" | "matched" };

export function InboxSuggestions({ items }: { items: Suggestion[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Record<string, string>>({});
  const notes = Object.values(msg);
  if (!items.length && !notes.length) return null;
  const run = (id: string, ok: string, fail: string) => start(async () => {
    const r = await addSuggestedApplication(id);
    setMsg((m) => ({ ...m, [id]: r.ok ? r.message ?? ok : r.message ?? fail }));
  });
  return (
    <section aria-label="Emails to review" className="flex flex-col gap-2">
      <h2 className="text-sm font-bold">Emails to review</h2>
      {items.map((s) => (
        <div key={s.eventId} className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 text-sm">
          <span className="min-w-0 flex-1 basis-full sm:basis-auto">“{s.subject}”{s.company ? ` · ${s.company}` : ""}</span>
          {s.reason === "matched" ? (
            <button type="button" disabled={pending} className="min-h-11 rounded-full border px-3 font-semibold"
              onClick={() => run(s.eventId, "Applied.", "Couldn't apply it.")}>
              Apply this update
            </button>
          ) : s.company ? (
            <button type="button" disabled={pending} className="min-h-11 rounded-full border px-3 font-semibold"
              onClick={() => run(s.eventId, "Added.", "Couldn't add it.")}>
              Not in your tracker: add it
            </button>
          ) : <span className="text-xs text-muted-foreground">This email might be about one of your applications.</span>}
          <button type="button" disabled={pending} aria-label="Dismiss" className="min-h-11 rounded-full px-3 text-sm font-semibold underline"
            onClick={() => start(async () => {
              const r = await dismissInboxSuggestion(s.eventId);
              if (!r.ok) setMsg((m) => ({ ...m, [s.eventId]: "Couldn't dismiss it." }));
            })}>
            Dismiss
          </button>
        </div>
      ))}
      {/* Outside the rows: revalidation removes an applied row, and its result must outlive it. */}
      <div role="status" className="text-xs font-semibold">{notes.map((n, i) => <p key={i}>{n}</p>)}</div>
    </section>
  );
}
