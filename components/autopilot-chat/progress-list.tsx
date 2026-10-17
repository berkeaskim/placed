"use client";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import type { ProgressRow } from "@/lib/autopilot/chat-flow";
import { openAndFill } from "@/app/(app)/jobs/[id]/autopilot-actions";
import { ExtensionHint } from "@/components/autopilot/extension-install";

const ROW: Record<ProgressRow["state"], string> = {
  done: "text-[#6B6B7B]",
  current: "bg-[#EEEAFE] font-bold text-[#16161D] shadow-[inset_0_0_0_1.5px_#5B3DF5]",
  upcoming: "text-[#16161D]",
  skipped: "text-[#9A9AAD]",
  yours: "text-[#9A9AAD]",
};

function Mark({ state }: { state: ProgressRow["state"] }) {
  if (state === "done") return <span className="grid size-5 flex-none place-items-center rounded-full bg-[#E3F6EE] text-[#0B6B49]"><Check size={13} strokeWidth={3} aria-hidden="true" /></span>;
  if (state === "current") return <span className="size-5 flex-none rounded-full border-2 border-[#5B3DF5] bg-white" aria-hidden="true" />;
  return <span className={`size-5 flex-none rounded-full border-2 ${state === "upcoming" ? "border-[#C9C9D6]" : "border-dashed border-[#D8D8E0]"}`} aria-hidden="true" />;
}

/** Rows that count towards progress (not "yours"), how many are done, and how many still wait for an answer. */
export function progressCounts(rows: ProgressRow[]): { total: number; done: number; left: number } {
  const counted = rows.filter((r) => r.state !== "yours");
  return { total: counted.length, done: counted.filter((r) => r.state === "done").length, left: counted.filter((r) => r.state === "current" || r.state === "upcoming").length };
}

const STATE_TEXT: Record<ProgressRow["state"], string> = { done: "answered", current: "asking now", upcoming: "not answered yet", skipped: "you'll fill", yours: "you'll fill" };

/** Every form question as a compact row, the progress bar, and Open & fill once nothing blocking is left. */
export function ProgressList({ jobId, rows, pickable, ready, highlight, expanded, onExpand, onPick }: {
  jobId: string; rows: ProgressRow[]; pickable: Set<string>; ready: boolean; highlight: boolean;
  expanded: boolean; onExpand: (open: boolean) => void; onPick: (key: string) => void;
}) {
  const [opening, startOpen] = useTransition();
  const [openError, setOpenError] = useState<string | null>(null);
  const [openedUrl, setOpenedUrl] = useState<string | null>(null);
  const { total, done, left } = progressCounts(rows);
  const pct = total ? Math.round((done / total) * 100) : 100;
  const status = left ? `${left} of ${total} left` : "All answered";

  const open = () => startOpen(async () => {
    setOpenError(null);
    try {
      const r = await openAndFill(jobId);
      if ("error" in r) { setOpenError(r.error); return; }
      setOpenedUrl(r.url);
      window.open(r.url, "_blank", "noopener");
    } catch {
      setOpenError("Couldn't open the form. Try again.");
    }
  });

  const bar = (
    <span className="block h-1.5 w-full overflow-hidden rounded-full bg-[#E4E4EC]" aria-hidden="true">
      <span className="block h-full rounded-full bg-[#5B3DF5] transition-[width] duration-500 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
    </span>
  );

  return (
    <div className="flex min-w-0 flex-col gap-3 border-b border-[rgba(22,22,29,.08)] p-4 lg:border-b-0 lg:border-l">
      <button type="button" aria-expanded={expanded} onClick={() => onExpand(!expanded)} className="flex min-h-11 flex-col gap-1.5 text-left lg:hidden">
        <span className="flex w-full items-center justify-between text-sm font-bold"><span aria-live="polite">{status}</span><span aria-hidden="true">{expanded ? "▴" : "▾"}</span></span>
        {bar}
      </button>
      <div className="hidden flex-col gap-1.5 lg:flex">
        <span className="text-sm font-bold" aria-live="polite">{status}</span>
        {bar}
      </div>

      <ol aria-label="Questions" className={`${expanded ? "flex" : "hidden"} max-h-[480px] flex-col gap-0.5 overflow-y-auto lg:flex`}>
        {rows.map((r) => {
          const inner = (
            <>
              <Mark state={r.state} />
              <span className="min-w-0 flex-1 truncate">{r.label}</span>
              {(r.state === "skipped" || r.state === "yours") && <span className="flex-none text-[11px] font-semibold">You&apos;ll fill</span>}
              <span className="sr-only">, {STATE_TEXT[r.state]}</span>
            </>
          );
          const cls = `flex min-h-11 w-full items-center gap-2 rounded-xl px-2.5 py-1.5 text-left text-[13.5px] ${ROW[r.state]} ${highlight && r.state === "done" ? "bg-[#E3F6EE]" : ""} transition-colors`;
          return (
            <li key={r.key} data-autopilot-row={r.state}>
              {pickable.has(r.key) && r.state !== "current"
                ? <button type="button" className={`${cls} hover:bg-[#F6F6FA]`} onClick={() => onPick(r.key)} title="Change this answer">{inner}</button>
                : <div className={cls} aria-current={r.state === "current" ? "step" : undefined}>{inner}</div>}
            </li>
          );
        })}
      </ol>

      <div className="flex flex-col gap-2 border-t border-[rgba(22,22,29,.08)] pt-3">
        <button type="button" onClick={open} disabled={!ready || opening} className="btn-quest min-h-12 px-4 py-3 disabled:opacity-50">
          {opening ? "Opening…" : "Open & fill →"}
        </button>
        {!ready && <p className="text-xs font-semibold text-[#7A4100]">Answer the questions in the chat to unlock this.</p>}
        {openError && <p role="alert" className="text-xs font-semibold text-[#7A4100]">{openError}</p>}
        {openedUrl && (
          <p className="text-xs text-muted-foreground">
            Nothing opened? <a href={openedUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-[#5B3DF5]">Open the form</a>. This link works once.
          </p>
        )}
        <ExtensionHint />
      </div>
    </div>
  );
}
