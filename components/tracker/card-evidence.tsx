"use client";
import { useState, useTransition } from "react";
import { undoInboxEvent } from "@/app/(app)/tracker/inbox-actions";
import { COLUMNS } from "@/lib/tracker/status";
import type { AppStatus } from "@/lib/types";

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

export function CardEvidence({ e }: { e: { eventId: string; subject: string; date: string; to: AppStatus; canUndo: boolean } }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const label = COLUMNS.find((c) => c.key === e.to)?.label ?? e.to;
  return (
    <p className="text-xs text-muted-foreground">
      Placed moved this to <b>{label}</b>: “{e.subject}”, {fmt(e.date)}.
      {e.canUndo && (
        <button type="button" disabled={pending} className="ml-1 font-semibold underline"
          onClick={() => start(async () => { const r = await undoInboxEvent(e.eventId); if (!r.ok) setMsg(r.message ?? "Couldn't undo."); })}>
          Undo
        </button>
      )}
      {msg && <span role="status" className="block">{msg}</span>}
    </p>
  );
}
