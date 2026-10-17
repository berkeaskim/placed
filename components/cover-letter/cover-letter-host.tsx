"use client";
import { useEffect, useRef, useState } from "react";
import { PenLine } from "lucide-react";
import type { OutputTarget } from "@/lib/cover-letter/types";
import { CoverLetterCard } from "./cover-letter-card";

const EVENT = "placed:cover-letter";
type Open = { target: OutputTarget; autopilot: boolean };

/** Opens the job page's cover letter card on a target (from the button, or from an Autopilot cover item). */
export function openCoverLetterCard(target: OutputTarget, autopilot = false): void {
  window.dispatchEvent(new CustomEvent<Open>(EVENT, { detail: { target, autopilot } }));
}

const keyOf = (t: OutputTarget) => (t.kind === "upload" ? "upload" : `field:${t.fieldKey}`);

/** The manual entry point: a full cover letter for the upload. */
export function CoverLetterButton() {
  return (
    <button type="button" onClick={() => openCoverLetterCard({ kind: "upload" })}
      className="flex min-h-11 w-fit items-center gap-2 rounded-[14px] border-2 border-[#5B3DF5] px-4 py-2 text-sm font-bold text-[#5B3DF5] transition-transform duration-100 ease-out active:scale-[0.97]">
      <PenLine size={16} aria-hidden="true" /> Write cover letter
    </button>
  );
}

/** Where the card opens: full width above the job, scrolled into view. Reopening the same target keeps the card. */
export function CoverLetterHost({ jobId }: { jobId: string }) {
  const [open, setOpen] = useState<Open | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const on = (e: Event) => setOpen((e as CustomEvent<Open>).detail);
    window.addEventListener(EVENT, on);
    return () => window.removeEventListener(EVENT, on);
  }, []);
  useEffect(() => {
    if (!open) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    ref.current?.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
  }, [open]);
  if (!open) return null;
  return (
    <div ref={ref} className="scroll-mt-4">
      <CoverLetterCard key={`${keyOf(open.target)}:${open.autopilot}`} jobId={jobId} target={open.target} autopilot={open.autopilot} onClose={() => setOpen(null)} />
    </div>
  );
}
