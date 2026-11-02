"use client";
import { useActionState } from "react";
import { saveCourse, type CourseState } from "@/app/(app)/settings/actions";
import { FieldRow, Note, btn, field } from "@/components/ui/apple";

export function CourseForm({ saved }: { saved: string | null }) {
  const [state, action, pending] = useActionState<CourseState, FormData>(saveCourse, null);
  return (
    <form action={action}>
      <FieldRow
        label="Course"
        htmlFor="course"
        hint={
          state?.ok === false ? <Note tone="error">{state.error}</Note>
            : state?.ok ? <Note tone="ok">{state.value ? `Saved. Placed now tells the AI you study ${state.value}.` : "Cleared."}</Note>
            : "Used when the AI suggests employers and reads your profile."
        }
      >
        <input id="course" name="course" defaultValue={saved ?? ""} maxLength={120} autoComplete="off" placeholder="Economics and Statistics" className={field} />
        <button type="submit" disabled={pending} className={`${btn} shrink-0`}>{pending ? "Saving…" : "Save"}</button>
      </FieldRow>
    </form>
  );
}
