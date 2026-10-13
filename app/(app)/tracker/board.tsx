"use client";
import { useOptimistic, useState, useTransition } from "react";
import Link from "next/link";
import type { AppStatus } from "@/lib/types";
import { celebrate } from "@/components/reward-toast";
import { COLUMNS, groupByStatus, isAppStatus } from "@/lib/tracker/status";
import { updateStatus } from "./actions";

export type Card = { id: string; jobId: string; title: string; company: string; status: AppStatus };

export function Board({ cards }: { cards: Card[] }) {
  const [, start] = useTransition();
  const [over, setOver] = useState<AppStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [optimistic, move] = useOptimistic(cards, (s, { id, status }: { id: string; status: AppStatus }) => s.map((c) => (c.id === id ? { ...c, status } : c)));
  const grouped = groupByStatus(optimistic);

  const change = (id: string, status: AppStatus) => {
    if (!id || optimistic.find((c) => c.id === id)?.status === status) return;
    setError(null);
    start(async () => {
      move({ id, status });
      try {
        celebrate(await updateStatus(id, status));
      } catch {
        setError("Couldn't update that application. Try again.");
      }
    });
  };

  return (
    <>
      {error && <p role="alert" className="text-sm font-semibold text-[#B42318]">{error}</p>}
      <div className="grid gap-4 md:grid-cols-5">
        {COLUMNS.map((col) => (
          <section
            key={col.key}
            aria-label={col.label}
            className={`flex min-h-48 flex-col gap-2 rounded-[18px] p-3 ${over === col.key ? "bg-[#E3DCFF]" : "bg-[#EFEFF5]"}`}
            onDragOver={(e) => { e.preventDefault(); setOver(col.key); }}
            onDragLeave={() => setOver((o) => (o === col.key ? null : o))}
            onDrop={(e) => { e.preventDefault(); setOver(null); change(e.dataTransfer.getData("text/plain"), col.key); }}
          >
            <h2 className="px-1 text-sm font-bold">{col.label} <span className="text-muted-foreground">{grouped[col.key].length}</span></h2>
            {col.key === "rejected" && <p className="px-1 text-xs text-muted-foreground">Rejection is part of the game: +20 XP for logging it.</p>}
            {grouped[col.key].map((c) => (
              <article key={c.id} draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)} className="flex cursor-grab flex-col gap-2 rounded-xl border bg-white p-3">
                <Link href={`/jobs/${c.jobId}`} className="text-sm font-bold text-foreground no-underline">{c.title}</Link>
                <span className="text-xs text-muted-foreground">{c.company}</span>
                <label className="sr-only" htmlFor={`s-${c.id}`}>Status for {c.title}</label>
                <select
                  id={`s-${c.id}`} value={c.status} onChange={(e) => isAppStatus(e.target.value) && change(c.id, e.target.value)}
                  className="min-h-11 rounded-lg border bg-white px-2 text-sm"
                >
                  {COLUMNS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
                </select>
              </article>
            ))}
          </section>
        ))}
      </div>
    </>
  );
}
