"use client";
import { useEffect, useState } from "react";
import { Rocket } from "lucide-react";
import { onAutopilotOpen, onAutopilotProgress, openAutopilotChat } from "./autopilot-host";

/** The sidebar entry point. The chat itself (and its locked / error states) opens full width above the job. */
export function AutopilotStartCard() {
  const [open, setOpen] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    const offOpen = onAutopilotOpen(() => setOpen(true));
    const offProgress = onAutopilotProgress((n) => { setOpen(n !== null); setLeft(n); });
    return () => { offOpen(); offProgress(); };
  }, []);

  if (open) {
    return (
      <section className="flex flex-col gap-1 rounded-[20px] border bg-white p-5">
        <p className="flex items-center gap-2 text-sm font-bold"><Rocket size={16} aria-hidden="true" /> Autopilot is open above</p>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          {left !== null && (
            <span aria-live="polite" className={`font-bold ${left ? "text-[#7A4100]" : "text-[#0B6B49]"}`}>{left ? `${left} left` : "All answered"}</span>
          )}
          <button type="button" onClick={openAutopilotChat} className="min-h-11 font-semibold text-[#5B3DF5] hover:underline">Jump to it</button>
        </div>
      </section>
    );
  }
  return (
    <section className="flex flex-col gap-2 rounded-[20px] border bg-white p-5">
      <button type="button" onClick={openAutopilotChat} className="btn-quest flex min-h-12 items-center justify-center gap-2 px-4 py-3">
        <Rocket size={18} aria-hidden="true" /> Autopilot this application
      </button>
      <p className="text-xs text-muted-foreground">Placed gets the form ready; you check every answer and press Submit yourself.</p>
    </section>
  );
}
