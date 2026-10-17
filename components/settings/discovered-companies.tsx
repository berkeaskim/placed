"use client";
import { useState, useTransition } from "react";
import { findNewCompanies, stopWatchingCompany } from "./job-search-actions";

type Row = { id: number; name: string; enabled: boolean };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The AI company search: a button to run it now, and the companies it added (each removable). */
export function DiscoveredCompanies({ rows, canSearch }: { rows: Row[]; canSearch: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const watched = rows.filter((r) => r.enabled);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button type="button" disabled={pending || !canSearch}
          className="min-h-11 rounded-full border bg-white px-4 font-semibold hover:bg-[#EFEBFF] disabled:opacity-60"
          onClick={() => {
            setMsg("Asking the AI and checking each careers site…");
            start(async () => {
              const r = await findNewCompanies();
              setMsg(!r.ok ? r.error : r.added.length
                ? `Added ${r.added.join(", ")}. Their jobs arrive with the next refresh.`
                : `Checked ${plural(r.suggested, "suggestion")}; none had a careers site we can read yet.`);
            });
          }}>
          {pending ? "Searching…" : "Find new companies"}
        </button>
        <span role="status" aria-live="polite" className="text-muted-foreground">
          {msg ?? (canSearch ? null : "Needs an AI provider (Settings → AI).")}
        </span>
      </div>
      {watched.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Companies found by the AI">
          {watched.map((r) => (
            <li key={r.id} className="flex items-center gap-1 rounded-full bg-[#EFEBFF] py-1 pl-3 pr-1 text-xs font-bold text-[#5B3DF5]">
              {r.name}
              <button type="button" aria-label={`Stop watching ${r.name}`} disabled={pending}
                className="grid size-6 place-items-center rounded-full hover:bg-white"
                onClick={() => start(async () => { await stopWatchingCompany(r.id); })}>×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
