"use client";
import { useState, useTransition } from "react";
import { AgentStatus } from "@/components/agent/agent-steps";
import { ARCHETYPES, ARCHETYPE_LABELS, type Archetype } from "@/lib/types";
import { setTargetSector } from "./actions";

export function SectorSelect({ value, label = "Score my CV for" }: { value: Archetype; label?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  // Shows the new choice while rescoring; the page remounts this (key) with the saved sector afterwards.
  const [shown, setShown] = useState<Archetype>(value);
  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
        {label}
        <select
          value={shown}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.value as Archetype;
            setError(null);
            setShown(next);
            start(async () => {
              const r = await setTargetSector(next);
              if ("error" in r) { setError(r.error); if (!r.switched) setShown(value); }
            });
          }}
          className="min-h-11 rounded-xl border-2 border-[#E6E6EF] bg-white px-3 py-2 font-semibold disabled:opacity-60"
        >
          {ARCHETYPES.map((a) => <option key={a} value={a}>{ARCHETYPE_LABELS[a]}</option>)}
        </select>
      </label>
      {pending && <AgentStatus>Rescoring your CV…</AgentStatus>}
      {error && <span role="alert" className="text-sm text-destructive">{error}</span>}
    </div>
  );
}
