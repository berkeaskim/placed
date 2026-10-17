"use client";

import { useState, useTransition } from "react";
import { acceptAction, acceptAllAction, rejectAction, type BankActionResult } from "./actions";

export type SuggestionView = {
  id: string;
  kind: "new_entry" | "new_bullet" | "merge_into";
  entry?: { section: string; org: string; title: string; dates: string; location: string; bullets: string[] };
  /** new_bullet: the entry it joins, as "org — title". */
  target?: string;
  text?: string;
  /** Verbatim post excerpt, shown under the bullet. */
  sourceText?: string;
  /** merge_into: the existing entries it could join. */
  targets?: { id: string; label: string }[];
};
export type SuggestionGroup = { sourceId: string; label: string; importedAt: string; isPost: boolean; items: SuggestionView[] };

const btn = "flex min-h-11 items-center rounded-full border-2 border-[#E6E6EF] bg-white px-4 text-sm font-bold hover:bg-[#F6F6FA] disabled:opacity-50";
const primary = `${btn} !bg-foreground !text-background`;

function Card({ s, run, busy }: { s: SuggestionView; run: (fn: () => Promise<BankActionResult>) => void; busy: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(s.text ?? "");
  const [target, setTarget] = useState(s.targets?.[0]?.id ?? "");
  const mergeNeedsTarget = s.kind === "merge_into" && !target;

  return (
    <li className="rounded-2xl border-2 border-[#E6E6EF] bg-white p-4">
      {s.kind === "new_bullet" && (
        <>
          <p className="text-xs font-bold uppercase tracking-wide text-[#555]">Add to {s.target}</p>
          {editing
            ? <textarea aria-label="Edit bullet" value={draft} onChange={(e) => setDraft(e.target.value)} maxLength={300} rows={3} className="mt-1 w-full rounded-xl border-2 border-[#E6E6EF] p-3 text-sm" />
            : <p className="mt-1 text-sm font-semibold">{s.text}</p>}
          {s.sourceText && <blockquote className="mt-2 border-l-4 border-[#E6E6EF] pl-3 text-xs text-[#555]">&ldquo;{s.sourceText}&rdquo;</blockquote>}
        </>
      )}
      {s.kind !== "new_bullet" && s.entry && (
        <>
          <p className="text-xs font-bold uppercase tracking-wide text-[#555]">{s.kind === "new_entry" ? "New entry" : "Looks like one you have"} · {s.entry.section}</p>
          <p className="mt-1 text-sm font-extrabold">{s.entry.org} — {s.entry.title}</p>
          <p className="text-xs text-[#555]">{[s.entry.dates, s.entry.location].filter(Boolean).join(" · ")}</p>
          <ul className="mt-2 list-disc pl-5 text-sm">{s.entry.bullets.map((b, i) => <li key={i}>{b}</li>)}</ul>
        </>
      )}
      {s.kind === "merge_into" && s.targets && (
        <fieldset className="mt-3">
          <legend className="text-sm font-bold">Add these bullets to</legend>
          {s.targets.map((t) => (
            <label key={t.id} className="flex min-h-11 items-center gap-2 text-sm">
              <input type="radio" name={`merge-${s.id}`} value={t.id} checked={target === t.id} onChange={() => setTarget(t.id)} />
              {t.label}
            </label>
          ))}
        </fieldset>
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        {editing ? (
          <>
            <button type="button" className={primary} disabled={busy} onClick={() => run(() => acceptAction(s.id, { editedText: draft }))}>Save &amp; accept</button>
            <button type="button" className={btn} disabled={busy} onClick={() => { setEditing(false); setDraft(s.text ?? ""); }}>Cancel</button>
          </>
        ) : (
          <>
            <button type="button" className={primary} disabled={busy || mergeNeedsTarget}
              onClick={() => run(() => acceptAction(s.id, s.kind === "merge_into" ? { targetEntryId: target } : {}))}>Accept</button>
            {s.kind === "new_bullet" && <button type="button" className={btn} disabled={busy} onClick={() => setEditing(true)}>Edit &amp; accept</button>}
          </>
        )}
        <button type="button" className={btn} disabled={busy} onClick={() => run(() => rejectAction(s.id))}>Reject</button>
      </div>
    </li>
  );
}

/** Pending suggestions grouped by where they came from. Accept all is offered only for sources other than posts. */
export function SuggestionsList({ groups }: { groups: SuggestionGroup[] }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<BankActionResult>) => start(async () => {
    const r = await fn();
    setError("error" in r ? r.error : null);
  });
  if (!groups.length) return null;
  return (
    <div className="mb-6 space-y-6">
      {error && <p role="alert" className="text-sm font-semibold text-[#B3261E]">{error}</p>}
      {groups.map((g) => (
        <div key={g.sourceId}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold">{g.label} <span className="font-semibold text-[#555]">· imported {g.importedAt}</span></h3>
            {!g.isPost && <button type="button" className={btn} disabled={pending} onClick={() => run(() => acceptAllAction(g.sourceId))}>Accept all</button>}
          </div>
          <ul className="space-y-3">{g.items.map((s) => <Card key={s.id} s={s} run={run} busy={pending} />)}</ul>
        </div>
      ))}
    </div>
  );
}
