"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { celebrate } from "./reward-toast";
import { markApplied } from "@/app/(app)/jobs/actions";

const FAILED = "Couldn't record that — try again.";

/** Shared by the "Did you apply?" dialog and the "Mark as applied" buttons: one server action, one XP rule. */
export function useMarkApplied(jobId: string, initiallyApplied: boolean) {
  const [applied, setApplied] = useState(initiallyApplied);
  const [pending, start] = useTransition();
  const mark = (onDone?: () => void) => start(async () => {
    try {
      const r = await markApplied(jobId);
      if (!r.ok) { toast.error(r.error ?? FAILED); return; }
      setApplied(true);
      onDone?.();
      celebrate(r.award);
    } catch {
      toast.error(FAILED);
    }
  });
  return { applied, pending, mark };
}

const CheckIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
);

/** "Applied" state: a link to the tracker, where the job now sits in the Applied column. */
export function AppliedChip({ title }: { title?: string }) {
  return (
    <Link href="/tracker" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#E3F6EE] px-3 text-sm font-bold text-[#0B6B49] no-underline hover:underline">
      <CheckIcon />Applied<span className="sr-only">{title ? ` to ${title}` : ""} (open your tracker)</span>
    </Link>
  );
}

/** Feed card control: records that the student applied on the company's site. Nothing is sent to the company. */
export function MarkAppliedButton({ jobId, initiallyApplied, title }: { jobId: string; initiallyApplied: boolean; title: string }) {
  const { applied, pending, mark } = useMarkApplied(jobId, initiallyApplied);
  if (applied) return <AppliedChip title={title} />;
  return (
    <button type="button" disabled={pending} onClick={() => mark()}
      className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 border-[#0E8A5F]/40 px-3 text-sm font-bold text-[#0B6B49] hover:bg-[#E3F6EE] disabled:opacity-60">
      <CheckIcon />{pending ? "Saving…" : "Mark applied"}<span className="sr-only">: {title}</span>
    </button>
  );
}
