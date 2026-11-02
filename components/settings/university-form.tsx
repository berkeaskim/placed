"use client";
import { useActionState } from "react";
import { saveUniversity, type UniversityState } from "@/app/(app)/settings/actions";
import { FieldRow, Note, btn, field } from "@/components/ui/apple";

export function UniversityForm({ saved, fromCv }: { saved: string | null; fromCv: string | null }) {
  const [state, action, pending] = useActionState<UniversityState, FormData>(saveUniversity, null);
  return (
    <form action={action}>
      <FieldRow
        label="University"
        htmlFor="university"
        hint={
          state?.ok === false ? <Note tone="error">{state.error}</Note>
            : state?.ok ? <Note tone="ok">{state.value ? `Saved. Alumni searches now use ${state.value}.` : "Cleared. Placed will use the university on your CV."}</Note>
            : fromCv && !saved ? `Found ${fromCv} on your CV. Change it if that's not right.`
            : "Used to find alumni and in messages Placed writes."
        }
      >
        <input id="university" name="university" defaultValue={saved ?? ""} maxLength={120} autoComplete="organization" placeholder={fromCv ?? "University of Bristol"} className={field} />
        <button type="submit" disabled={pending} className={`${btn} shrink-0`}>{pending ? "Saving…" : "Save"}</button>
      </FieldRow>
    </form>
  );
}
