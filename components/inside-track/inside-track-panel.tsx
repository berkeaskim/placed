"use client";
import { useEffect, useRef, useState } from "react";
import { draftInsideTrack } from "@/app/(app)/jobs/[id]/inside-track-actions";
import { setOutreachStatus } from "@/app/(app)/outreach/actions";
import type { Card } from "@/lib/inside-track/view";
import { GROUPS, type Group } from "@/lib/inside-track/types";
import { alumniLabel } from "@/lib/outreach/targets";

const groupLabel = (g: Group, school: string | null) =>
  g === "alumni" ? alumniLabel(school) : g === "team" ? "In the team" : "Early careers recruiter";
export type Fallback = { key: Group; why: string; url: string };
type DraftState = { note: string | null; id: string | null; status: string | null; busy: boolean; error: string | null; removed: boolean };

function PersonCard({ card, jobId, why, hasCv, company }: { card: Card; jobId: string; why: string; hasCv: boolean; company: string }) {
  const auto = hasCv && !card.draft;
  const [s, setS] = useState<DraftState>({ note: card.draft, id: card.outreachId, status: card.status, busy: auto, error: null, removed: false });
  const [copied, setCopied] = useState(false);

  const started = useRef(false);
  const request = (rewrite = false) => draftInsideTrack(jobId, card.group, card.name, rewrite)
    .catch(() => ({ ok: false as const, message: "Couldn't write a message right now." }));
  const apply = (r: Awaited<ReturnType<typeof request>>) => setS((x) => (r.ok
    ? { ...x, busy: false, note: r.note, id: r.id, status: "drafted", removed: r.removed.length > 0 }
    : { ...x, busy: false, error: r.message }));
  function write() {
    setS((x) => ({ ...x, busy: true, error: null }));
    void request(true).then(apply);
  }
  // First visit only: people without a stored draft get one. Stored drafts are reused, so this runs once per person.
  useEffect(() => {
    if (!auto || started.current) return; // the ref survives strict mode's second effect run
    started.current = true;
    void request().then(apply);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sent = s.status === "sent" || s.status === "replied";
  return (
    <li className="flex flex-col gap-2 rounded-xl border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-bold">{card.name}</p>
          {card.headline && <p className="truncate text-xs text-muted-foreground">{card.headline}</p>}
        </div>
        <a href={card.url} target="_blank" rel="noopener noreferrer"
          className="shrink-0 rounded-full border px-3 py-1.5 text-xs font-bold text-foreground no-underline">LinkedIn ↗</a>
      </div>
      <p className="text-xs text-muted-foreground">{why}</p>
      {!hasCv ? (
        <p className="text-xs">Upload your CV to get a sample message.</p>
      ) : s.busy && !s.note ? (
        <p className="text-xs text-muted-foreground" aria-live="polite">Writing a message from your CV…</p>
      ) : s.error ? (
        <p className="text-xs text-[#7A4100]">{s.error} <button type="button" className="font-bold underline" onClick={write}>Retry</button></p>
      ) : s.note ? (
        <div className="flex flex-col gap-1.5">
          <p className="whitespace-pre-wrap rounded-lg bg-[#F6F6FA] p-2.5 text-sm">{s.note}</p>
          <span className="text-[11px] text-muted-foreground">{s.note.length}/300 characters · LinkedIn connection note</span>
          {s.removed && <span className="text-[11px] text-[#7A4100]">We removed a line we couldn&apos;t back up from your CV.</span>}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className="min-h-9 rounded-full border px-3 text-xs font-semibold"
              onClick={async () => {
                try { await navigator.clipboard.writeText(s.note ?? ""); } catch { return; }
                setCopied(true); setTimeout(() => setCopied(false), 1500);
              }}>
              {copied ? "Copied" : "Copy message"}
            </button>
            <button type="button" disabled={s.busy} className="min-h-9 rounded-full border px-3 text-xs font-semibold" onClick={write}>
              {s.busy ? "Rewriting…" : "Rewrite"}
            </button>
            {s.id && !sent && (
              <button type="button" className="min-h-9 rounded-full border px-3 text-xs font-semibold"
                onClick={async () => { if (await setOutreachStatus(s.id!, "sent")) setS((x) => ({ ...x, status: "sent" })); }}>
                Mark as sent
              </button>
            )}
            {sent && <span className="chip-xp">Sent</span>}
          </div>
        </div>
      ) : null}
      <p className="text-[11px] text-muted-foreground">Found via public web search. Check they still work at {company}.</p>
    </li>
  );
}

export function InsideTrackPanel({ jobId, company, cards, fallbacks, hasCv, school }: {
  jobId: string; company: string; cards: Card[]; fallbacks: Fallback[]; hasCv: boolean; school: string | null;
}) {
  return (
    <section id="inside-track" aria-label="Inside Track" className="flex flex-col gap-3 rounded-[20px] border bg-white p-5">
      <h2 className="text-lg font-bold">Inside Track</h2>
      <p className="text-sm text-muted-foreground">Real people at {company} you could message. A warm note can get your application read.</p>
      <p className="text-xs font-semibold">Start with alumni, then the team, then the recruiter.</p>
      {GROUPS.map((g) => {
        const people = cards.filter((c) => c.group === g);
        const fb = fallbacks.find((f) => f.key === g);
        if (!people.length && !fb) return null;
        return (
          <div key={g} className="flex flex-col gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{groupLabel(g, school)}</h3>
            {people.length ? (
              <ul className="flex flex-col gap-2">
                {people.map((c) => <PersonCard key={c.url} card={c} jobId={jobId} why={fb?.why ?? ""} hasCv={hasCv} company={company} />)}
              </ul>
            ) : (
              <a href={fb!.url} target="_blank" rel="noopener noreferrer" className="rounded-xl border p-3 text-sm font-semibold">
                We couldn&apos;t find anyone public. Search on LinkedIn ↗
              </a>
            )}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">Placed never sends anything. You copy, edit and send it yourself.</p>
    </section>
  );
}
