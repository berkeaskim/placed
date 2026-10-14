"use client";
import { useState, useTransition } from "react";
import { addSuggestedApplication } from "@/app/(app)/tracker/inbox-actions";

/** `matched` = the email already points at one of the student's cards (low confidence); `unmatched` = no card yet. */
export type Suggestion = { eventId: string; subject: string; company: string | null; reason: "unmatched" | "matched" };

export function InboxSuggestions({ items }: { items: Suggestion[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Record<string, string>>({});
  if (!items.length) return null;
  const run = (id: string, ok: string, fail: string) => start(async () => {
    const r = await addSuggestedApplication(id);
    setMsg((m) => ({ ...m, [id]: r.ok ? r.message ?? ok : r.message ?? fail }));
  });
  return (
    <section aria-label="Emails to review" className="flex flex-col gap-2">
      <h2 className="text-sm font-bold">Emails to review</h2>
      {items.map((s) => (
        <div key={s.eventId} className="flex flex-wrap items-center gap-2 rounded-xl border bg-white p-3 text-sm">
          <span className="min-w-0 flex-1">“{s.subject}”{s.company ? ` · ${s.company}` : ""}</span>
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
          {msg[s.eventId] && <span role="status" className="w-full text-xs">{msg[s.eventId]}</span>}
        </div>
      ))}
    </section>
  );
}
