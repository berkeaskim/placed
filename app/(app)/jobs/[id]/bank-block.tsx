"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import type { SelectionReport, SelItem } from "@/lib/bank/select";
import type { TailoredCV } from "@/lib/types";
import { reselectFromBank, swapBankItem, type OverflowResult, type TailorResult } from "./actions";

const LEFT_OUT_SHOWN = 5;
const pill = "inline-flex min-h-11 shrink-0 items-center rounded-full border-2 px-4 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50";
const ghost = `${pill} border-[#E6E6EF] text-[#3A20C4] hover:bg-[#F4F1FF]`;

/** Ids of untailored bullets and of the entries holding them, so the Added list can tag them. */
export function untailoredIdsOf(t: { experience: Entry[]; projects: Entry[]; leadership: Entry[] }): string[] {
  const out: string[] = [];
  for (const e of [...t.experience, ...t.projects, ...t.leadership]) {
    const hit = e.bullets.filter((b) => b.untailored);
    if (hit.length) out.push(e.id, ...hit.map((b) => b.id));
  }
  return out;
}
type Entry = { id: string; bullets: { id: string; untailored?: boolean }[] };

function Row({ item, action, tag }: { item: SelItem; action: React.ReactNode; tag?: boolean }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-xl border-2 border-[#E6E6EF] px-3 py-2">
      <div className="min-w-0">
        <p className="text-sm font-semibold">{item.label}</p>
        <p className="text-xs text-muted-foreground">{item.reason}</p>
        {tag && <p className="mt-0.5 text-xs font-semibold text-[#7A4100]">added, not tailored — Tailor again to polish</p>}
      </div>
      {action}
    </li>
  );
}

/**
 * "From your bank": what was added to this CV from the student's experience bank, what was left out, and one-click
 * Remove / Add back (no AI call). Every swap goes through swapBankItem; results flow back via onResult.
 */
export function BankBlock({ report, stale, newCvSuggestions, jobId, untailoredIds, disabled, currentFinal, onResult }: {
  report: SelectionReport; stale: boolean; newCvSuggestions: number; jobId: string; untailoredIds: string[];
  disabled?: boolean; onResult: (r: TailorResult) => void;
  /** The panel's current version (with unsaved edits): every swap carries it instead of the last saved one. */
  currentFinal?: TailoredCV | null;
}) {
  const [pending, start] = useTransition();
  const [working, setWorking] = useState<string | null>(null);
  const off = pending || !!disabled;
  const untailored = new Set(untailoredIds);
  const leftOut = report.leftOut.slice(0, LEFT_OUT_SHOWN);

  const swap = (id: string, op: "add" | "remove") => start(async () => {
    setWorking(id);
    try { onResult(await swapBankItem(jobId, id, op, currentFinal ?? undefined)); } finally { setWorking(null); }
  });
  const reselect = () => start(async () => {
    setWorking("reselect");
    try { onResult(await reselectFromBank(jobId)); } finally { setWorking(null); }
  });

  return (
    <div className="flex flex-col gap-3" aria-busy={pending}>
      {stale && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#FFF1DC] px-3 py-2 text-sm text-[#7A4100]" role="status">
          <span className="font-semibold">Your bank changed since this was tailored</span>
          <button type="button" onClick={reselect} disabled={off} className={ghost}>{working === "reselect" ? "Re-selecting…" : "Re-select"}</button>
        </div>
      )}
      {newCvSuggestions > 0 && (
        <p className="flex flex-wrap items-center gap-x-2 rounded-xl bg-[#EEF2FF] px-3 py-2 text-sm text-[#2340A8]" role="status">
          <span>Your new CV added {newCvSuggestions} suggestion{newCvSuggestions === 1 ? "" : "s"} to your bank</span>
          <Link href="/profile/bank" className="inline-flex min-h-11 items-center font-bold underline">Review in your bank</Link>
        </p>
      )}
      {report.pinnedOverflow && (
        <p className="rounded-xl bg-[#FFF1DC] px-3 py-2 text-sm text-[#7A4100]" role="status">Some pinned items didn&apos;t fit on one page.</p>
      )}

      {report.education && report.education.length > 0 && (
        <details className="rounded-xl bg-[#F6F5FB] px-3 py-2 text-sm">
          <summary className="inline-flex min-h-11 cursor-pointer items-center font-bold text-[#3A20C4]">Education tidied for this programme ({report.education.length})</summary>
          <ul className="mt-1 flex flex-col gap-2 pb-1" aria-label="Education changes">
            {report.education.map((c, i) => (
              <li key={i} className="flex flex-col gap-0.5">
                <span className="text-muted-foreground line-through">{c.before}</span>
                {c.after ? <span className="font-semibold text-foreground">{c.after}</span> : <span className="font-semibold text-foreground">Removed</span>}
                <span className="text-xs text-muted-foreground">{c.why}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {report.added.length === 0 ? (
        <p className="text-sm text-muted-foreground">Nothing was added from your bank for this role.</p>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Added from your bank">
          {report.added.map((it) => (
            <Row key={it.id} item={it} tag={untailored.has(it.id)}
              action={<button type="button" onClick={() => swap(it.id, "remove")} disabled={off} aria-label={`Remove ${it.label}`} className={ghost}>{working === it.id ? "Removing…" : "Remove"}</button>} />
          ))}
        </ul>
      )}

      {leftOut.length > 0 && (
        <details className="rounded-xl">
          <summary className="inline-flex min-h-11 cursor-pointer items-center text-sm font-bold text-[#3A20C4]">Left out for this role ({report.leftOut.length})</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {leftOut.map((it) => (
              <Row key={it.id} item={it}
                action={<button type="button" onClick={() => swap(it.id, "add")} disabled={off} aria-label={`Add back ${it.label}`} className={ghost}>{working === it.id ? "Adding…" : "Add back"}</button>} />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/**
 * The "this is X pages" refusal: the 3 lowest-scoring bank bullets, each one click from removal. With nothing to offer
 * (a pre-bank tailoring) the message says to tailor again, and the button does it.
 */
export function OverflowRemove({ overflow, pending, onRemove, onTailorAgain }: {
  overflow: Pick<OverflowResult, "message" | "remove">; pending: boolean; onRemove: (bulletId: string) => void; onTailorAgain: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl bg-[#FFF1DC] px-3 py-3 text-sm text-[#7A4100]" role="alert">
      <p className="font-semibold">{overflow.message}</p>
      {overflow.remove.length === 0 && (
        <button type="button" onClick={onTailorAgain} disabled={pending} className={`${ghost} self-start bg-white`}>Tailor again</button>
      )}
      <ul className="flex flex-col gap-2">
        {overflow.remove.map((r) => (
          <li key={r.bulletId} className="flex items-center justify-between gap-3 rounded-xl border-2 border-[#E6E6EF] bg-white px-3 py-2">
            <p className="min-w-0 text-sm text-foreground">{r.text}</p>
            <button type="button" onClick={() => onRemove(r.bulletId)} disabled={pending} aria-label={`Remove: ${r.text}`} className={ghost}>Remove</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
