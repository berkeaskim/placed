"use client";
import { useActionState } from "react";
import { saveCourse, type CourseState } from "@/app/(app)/settings/actions";

export function CourseForm({ saved }: { saved: string | null }) {
  const [state, action, pending] = useActionState<CourseState, FormData>(saveCourse, null);
  return (
    <form action={action} className="flex flex-col gap-2">
      <label htmlFor="course" className="text-sm font-semibold">Your course</label>
      <div className="flex flex-wrap gap-2">
        <input id="course" name="course" defaultValue={saved ?? ""} maxLength={120} autoComplete="off"
          placeholder="Economics and Statistics"
          className="min-h-11 min-w-0 flex-1 rounded-[12px] border px-3 text-sm" />
        <button type="submit" disabled={pending} className="min-h-11 rounded-[12px] border-2 border-border bg-white px-4 text-sm font-bold transition-colors hover:bg-muted">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {state?.ok === false ? <span className="font-semibold text-[#B42318]">{state.error}</span>
          : state?.ok ? (state.value ? `Saved. Placed now tells the AI you study ${state.value}.` : "Cleared.")
          : "Used when the AI suggests employers and reads your profile."}
      </p>
    </form>
  );
}
