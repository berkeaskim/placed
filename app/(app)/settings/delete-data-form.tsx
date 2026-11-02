"use client";
import { useActionState, useState } from "react";
import { deleteMyData, type DeleteState } from "./actions";
import { isDeleteConfirmed } from "@/lib/settings/confirm";
import { Chevron, Note, Row, field } from "@/components/ui/apple";

/** Destructive, so it sits one step deeper: a row that opens the typed confirmation. */
export function DeleteDataForm() {
  const [state, action, pending] = useActionState<DeleteState, FormData>(deleteMyData, null);
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const confirmed = isDeleteConfirmed(value);
  return (
    <Row
      title={<span className="text-[#D70015]">Reset all local data…</span>}
      subtitle="Deletes CVs, scores, applications, XP and feedback. AI settings and jobs stay."
      onClick={() => setOpen(!open)}
      trailing={<Chevron open={open} />}
    >
      {open ? (
        <form action={action} className="flex flex-col gap-2.5 px-4 pb-4 text-left">
          <p className="text-[13px] text-black/60">
            This permanently deletes your CVs, scores, tailored CVs, applications, XP, badges and saved feedback from this computer, and restarts
            onboarding. It can&apos;t be undone.
          </p>
          <label htmlFor="confirm" className="text-[13px] font-medium text-black/75">Type DELETE to confirm</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input id="confirm" name="confirm" type="text" value={value} onChange={(e) => setValue(e.target.value)} autoComplete="off" autoCapitalize="characters"
              spellCheck={false} aria-describedby="confirm-help" className={`${field} font-mono`} />
            <button type="submit" disabled={!confirmed || pending}
              className="inline-flex min-h-10 shrink-0 items-center justify-center rounded-[9px] bg-[#FF3B30] px-3.5 text-[13px] font-semibold text-white transition-[background-color,transform] duration-100 hover:bg-[#E5352B] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 sm:min-h-8">
              {pending ? "Resetting…" : "Reset"}
            </button>
          </div>
          <span id="confirm-help" className="text-[12px] text-black/45">The button unlocks once you type DELETE in capitals.</span>
          {state?.error ? <Note tone="error">{state.error}</Note> : null}
        </form>
      ) : null}
    </Row>
  );
}
