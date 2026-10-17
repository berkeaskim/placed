"use client";
import { useState } from "react";
import type { Fact } from "@/lib/cover-letter/types";
import { monthYear } from "./research-card";

/** The facts question: chips stagger in 70ms apart, a tap toggles one and its check stroke draws itself. */
export function FactChips({ facts, disabled, onPick }: { facts: Fact[]; disabled: boolean; onPick: (ids: string[]) => void }) {
  const [on, setOn] = useState<string[]>([]);
  const toggle = (id: string) => setOn((xs) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]));
  return (
    <>
      <div className="facts" role="group" aria-label="Facts to use">
        {facts.map((f, i) => {
          const picked = on.includes(f.id);
          return (
            <button key={f.id} type="button" className={`fact${picked ? " on" : ""}`} aria-pressed={picked} disabled={disabled}
              style={{ animationDelay: `${i * 70}ms` }} onClick={() => toggle(f.id)}>
              <span className="box" aria-hidden="true"><svg viewBox="0 0 12 12"><path d="M2 6.5l2.5 2.5L10 3.5" /></svg></span>
              <span>{f.claim}<small>{[f.publisher, monthYear(f.date)].filter(Boolean).join(" · ")}</small></span>
            </button>
          );
        })}
      </div>
      <div className="actchips">
        <button type="button" className="act" disabled={disabled || !on.length} onClick={() => onPick(on)}>
          {on.length > 1 ? `Use these ${on.length}` : "Use this"}
        </button>
        <button type="button" className="act quiet" disabled={disabled} onClick={() => onPick([])} style={{ animationDelay: "70ms" }}>None of these</button>
      </div>
    </>
  );
}
