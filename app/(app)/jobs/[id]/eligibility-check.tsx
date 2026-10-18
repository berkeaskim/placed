"use client";
import { useState, useTransition } from "react";
import type { Gate } from "@/lib/scoring/fit";
import { setEligibilityOverrideAction } from "./actions";

/**
 * "Check eligibility" (audit 10#3): each failed gate with the posting sentence that triggered it, and a per-job
 * "This is wrong" override. Gates are read from the posting by rules and AI, so they can be wrong; the student decides.
 */
export function EligibilityCheck({ jobId, gates }: { jobId: string; gates: Gate[] }) {
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  const flagged = gates.filter((g) => !g.passed || g.overridden);
  if (!flagged.length) return null;
  const overridden = flagged.every((g) => g.overridden);
  const toggle = () => start(async () => {
    const r = await setEligibilityOverrideAction(jobId, !overridden);
    setFailed(!r.ok);
  });
  return (
    <div className={`flex flex-col gap-2 rounded-xl px-3 py-2.5 text-sm ${overridden ? "bg-[#F6F6FA] text-[#4A4A57]" : "bg-[#FFF1DC] text-[#7A4100]"}`} role="note">
      <p className="font-bold">{overridden ? "Eligibility check marked as wrong" : "Check eligibility"}</p>
      <ul className="flex flex-col gap-1.5">
        {flagged.map((g) => (
          <li key={g.key}>
            <span className={`font-semibold ${g.overridden ? "line-through" : ""}`}>{g.reason}</span>
            {g.quote && <span className="mt-0.5 block text-[13px] italic">The posting says: &ldquo;{g.quote}&rdquo;</span>}
          </li>
        ))}
      </ul>
      <p className="text-[13px]">
        {overridden
          ? "This role is scored as if you can apply. Undo if you change your mind."
          : "Placed reads this from the posting automatically, so it can be wrong. If it doesn't apply to you, say so and the role is scored normally."}
      </p>
      <button type="button" onClick={toggle} disabled={pending} className="self-start rounded-full border border-current px-3 py-1 text-[13px] font-semibold disabled:opacity-60">
        {pending ? "Saving…" : overridden ? "Undo" : "This is wrong"}
      </button>
      {failed && <p className="text-[13px] font-semibold" role="alert">Couldn&apos;t save that. Try again.</p>}
    </div>
  );
}
