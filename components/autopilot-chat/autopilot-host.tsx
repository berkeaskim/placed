"use client";
import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { AutopilotChat } from "./autopilot-chat";

const EVENT = "placed:autopilot";
const PROGRESS_EVENT = "placed:autopilot-progress";

/** Opens (or scrolls back to) the Autopilot chat above the job. */
export function openAutopilotChat(): void {
  window.dispatchEvent(new CustomEvent(EVENT));
}

/** Questions still left in the open chat; `null` means the chat was closed. */
export function announceAutopilotProgress(left: number | null): void {
  window.dispatchEvent(new CustomEvent<number | null>(PROGRESS_EVENT, { detail: left }));
}

export function onAutopilotProgress(cb: (left: number | null) => void): () => void {
  const on = (e: Event) => cb((e as CustomEvent<number | null>).detail);
  window.addEventListener(PROGRESS_EVENT, on);
  return () => window.removeEventListener(PROGRESS_EVENT, on);
}

export function onAutopilotOpen(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
}

/** Where the chat opens: full width above the job, scrolled into view on every open. */
export function AutopilotHost({ jobId }: { jobId: string }) {
  const [opened, setOpened] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => onAutopilotOpen(() => { setOpen(true); setOpened((n) => n + 1); }), []);
  useEffect(() => {
    if (!opened) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [opened]);
  if (!open) return null;
  const close = () => { setOpen(false); announceAutopilotProgress(null); };
  return (
    <section ref={ref} aria-label="Autopilot" className="cl scroll-mt-4">
      <div className="head">
        <h2>Autopilot</h2>
        <button type="button" onClick={close} aria-label="Close Autopilot" className="btn min-h-11!"><X size={16} aria-hidden="true" /></button>
      </div>
      <AutopilotChat jobId={jobId} />
    </section>
  );
}
