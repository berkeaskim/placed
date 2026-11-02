"use client";
import { useState, useTransition } from "react";
import { findNewCompanies, stopWatchingCompany } from "./job-search-actions";
import { Row, Spinner, btn } from "@/components/ui/apple";

type Row = { id: number; name: string; enabled: boolean };
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** The AI company search: a button to run it now, and the companies it added (each removable). */
export function DiscoveredCompanies({ rows, canSearch }: { rows: Row[]; canSearch: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const watched = rows.filter((r) => r.enabled);
  return (
    <Row
      title="New companies"
      subtitle={<span role="status" aria-live="polite">{msg ?? (canSearch ? "The AI suggests employers that fit you; Placed adds those it can read." : "Needs an AI provider (Settings → AI).")}</span>}
      trailing={
        <button type="button" disabled={pending || !canSearch} className={btn}
          onClick={() => {
            setMsg("Asking the AI and checking each careers site…");
            start(async () => {
              const r = await findNewCompanies();
              setMsg(!r.ok ? r.error : r.added.length
                ? `Added ${r.added.join(", ")}. Their jobs arrive with the next refresh.`
                : `Checked ${plural(r.suggested, "suggestion")}; none had a careers site we can read yet.`);
            });
          }}>
          {pending ? <Spinner /> : null}
          {pending ? "Searching" : "Find now"}
        </button>
      }
    >
      {watched.length > 0 && (
        <ul className="flex flex-wrap gap-1.5 px-4 pb-3" aria-label="Companies found by the AI">
          {watched.map((r) => (
            <li key={r.id} className="flex items-center gap-0.5 rounded-full bg-black/[0.05] py-0.5 pl-2.5 pr-0.5 text-[12px] font-medium text-black/75">
              {r.name}
              <button type="button" aria-label={`Stop watching ${r.name}`} disabled={pending}
                className="grid size-5 place-items-center rounded-full text-black/40 hover:bg-black/10 hover:text-black/70"
                onClick={() => start(async () => { await stopWatchingCompany(r.id); })}>×</button>
            </li>
          ))}
        </ul>
      )}
    </Row>
  );
}
