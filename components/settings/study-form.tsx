"use client";
import { useActionState } from "react";
import { saveStudy, type StudyState } from "@/app/(app)/settings/actions";
import { PLACEMENT_STATUSES, WORK_AUTH, YEARS, type PlacementStatus, type WorkAuth, type Year } from "@/lib/types";
import { WORK_AUTH_LABEL } from "@/lib/profile/work-auth";
import { FieldRow, Note, btnPrimary, field, select } from "@/components/ui/apple";

const PLACEMENT_LABEL: Record<PlacementStatus, string> = {
  required: "Yes, it's compulsory", opted_in: "Yes, I'm doing one", considering: "Optional, not decided", none: "No", completed: "Already done it",
};
const YEAR_LABEL: Record<Year, string> = { "1st": "1st year", "2nd": "2nd year", penultimate: "Penultimate", final: "Final year", masters: "Master's" };

export function StudyForm({ year, gradYear, placement, secureBy, workAuth, options }: {
  year: Year | null; gradYear: number | null; placement: PlacementStatus | null; secureBy: string | null; workAuth: WorkAuth | null; options: number[];
}) {
  const [state, action, pending] = useActionState<StudyState, FormData>(saveStudy, null);
  return (
    <form action={action}>
      <FieldRow label="Year of study" htmlFor="year">
        <select id="year" name="year" defaultValue={year ?? ""} className={select} required>
          <option value="" disabled>Choose…</option>
          {YEARS.map((y) => <option key={y} value={y}>{YEAR_LABEL[y]}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Graduating in" htmlFor="grad_year">
        <select id="grad_year" name="grad_year" defaultValue={gradYear ?? ""} className={select}>
          <option value="">Not sure</option>
          {[...new Set([...(gradYear ? [gradYear] : []), ...options])].sort().map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Placement year in your degree" htmlFor="placement_status">
        <select id="placement_status" name="placement_status" defaultValue={placement ?? ""} className={select}>
          <option value="">Not sure</option>
          {PLACEMENT_STATUSES.map((p) => <option key={p} value={p}>{PLACEMENT_LABEL[p]}</option>)}
        </select>
      </FieldRow>
      <FieldRow label="Deadline to secure a placement" htmlFor="placement_secure_by" hint="Leave empty for 30 June. Your placement team will know the date.">
        <input id="placement_secure_by" type="date" name="placement_secure_by" defaultValue={secureBy ?? ""} className={field} />
      </FieldRow>
      <FieldRow label="Right to work in the UK" htmlFor="work_auth">
        <select id="work_auth" name="work_auth" defaultValue={workAuth ?? ""} className={select}>
          <option value="">Prefer not to say</option>
          {WORK_AUTH.map((w) => <option key={w} value={w}>{WORK_AUTH_LABEL[w]}</option>)}
        </select>
      </FieldRow>
      <div className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        {state?.ok === false ? <Note tone="error">{state.error}</Note>
          : state?.ok ? <Note tone="ok">{state.message}</Note>
          : <Note>These decide whether your feed opens on spring weeks, placements or internships.</Note>}
        <button type="submit" disabled={pending} className={`${btnPrimary} shrink-0 self-end sm:self-auto`}>{pending ? "Saving…" : "Save"}</button>
      </div>
    </form>
  );
}
