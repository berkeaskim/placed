"use client";
import { useState, useTransition } from "react";
import { disagreeWithFix } from "./actions";

/** Per-fix "I disagree": records feedback only. Nothing else on the panel changes. */
export function DisagreeButton({ cvId, ruleId, sector }: { cvId: string; ruleId: string; sector: string }) {
  const [state, setState] = useState<"idle" | "done" | "error">("idle");
  const [pending, start] = useTransition();

  if (state === "done") {
    return (
      <span role="status" className="inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-[#0B6B49]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
        Thanks — noted
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          const r = await disagreeWithFix({ cvId, ruleId, sector });
          setState("ok" in r ? "done" : "error");
        })}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 text-sm font-semibold text-[#5B5B6B] hover:bg-[#F2F2F7] hover:text-[#16161D] focus-visible:outline-2 focus-visible:outline-[#5B3DF5] disabled:opacity-60"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" /><path d="M4 22v-7" />
        </svg>
        {pending ? "Sending…" : "I disagree"}
      </button>
      {state === "error" && <span role="alert" className="text-xs text-[#9A2E0B]">Couldn&apos;t record that — try again.</span>}
    </span>
  );
}
