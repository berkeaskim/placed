"use client";
import { useActionState } from "react";
import { saveUniversity, type UniversityState } from "@/app/(app)/settings/actions";

export function UniversityForm({ saved, fromCv }: { saved: string | null; fromCv: string | null }) {
  const [state, action, pending] = useActionState<UniversityState, FormData>(saveUniversity, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="university" className="text-sm font-semibold">Your university</label>
      <div className="flex flex-wrap gap-2">
        <input id="university" name="university" defaultValue={saved ?? ""} maxLength={120} autoComplete="organization"
          placeholder={fromCv ?? "University of Bristol"}
          className="min-h-11 min-w-0 flex-1 rounded-[12px] border px-3 text-sm" />
        <button type="submit" disabled={pending} className="min-h-11 rounded-[12px] border-2 border-border bg-white px-4 text-sm font-bold transition-colors hover:bg-muted">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {state?.ok === false ? <span className="font-semibold text-[#B42318]">{state.error}</span>
          : state?.ok ? (state.value ? `Saved. Alumni searches now use ${state.value}.` : "Cleared. Placed will use the university on your CV.")
          : fromCv && !saved ? `Placed found ${fromCv} on your CV. Change it if that's not right.`
          : "Used to find alumni at each company and in the messages Placed writes for you."}
      </p>
    </form>
  );
}
