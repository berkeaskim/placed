"use client";
import { useActionState } from "react";
import { saveStudy, type StudyState } from "@/app/(app)/settings/actions";
import { PLACEMENT_STATUSES, WORK_AUTH, YEARS, type PlacementStatus, type WorkAuth, type Year } from "@/lib/types";
import { WORK_AUTH_LABEL } from "@/lib/profile/work-auth";

const PLACEMENT_LABEL: Record<PlacementStatus, string> = {
  required: "Yes, it's compulsory", opted_in: "Yes, I'm doing one", considering: "Optional, not decided", none: "No", completed: "Already done it",
};
const YEAR_LABEL: Record<Year, string> = { "1st": "1st year", "2nd": "2nd year", penultimate: "Penultimate", final: "Final year", masters: "Master's" };

export function StudyForm({ year, gradYear, placement, secureBy, workAuth, options }: {
  year: Year | null; gradYear: number | null; placement: PlacementStatus | null; secureBy: string | null; workAuth: WorkAuth | null; options: number[];
}) {
  const [state, action, pending] = useActionState<StudyState, FormData>(saveStudy, null);
  const select = "min-h-11 min-w-0 flex-1 rounded-[12px] border bg-white px-3 text-sm";
  return (
    <form action={action} className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold">Year of study
          <select name="year" defaultValue={year ?? ""} className={select} required>
            <option value="" disabled>Choose…</option>
            {YEARS.map((y) => <option key={y} value={y}>{YEAR_LABEL[y]}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-sm font-semibold">Graduating in
          <select name="grad_year" defaultValue={gradYear ?? ""} className={select}>
            <option value="">Not sure</option>
            {[...new Set([...(gradYear ? [gradYear] : []), ...options])].sort().map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-0 flex-1 basis-60 flex-col gap-1 text-sm font-semibold">Placement year in your degree
          <select name="placement_status" defaultValue={placement ?? ""} className={select}>
            <option value="">Not sure</option>
            {PLACEMENT_STATUSES.map((p) => <option key={p} value={p}>{PLACEMENT_LABEL[p]}</option>)}
          </select>
        </label>
        <label className="flex min-w-0 flex-1 basis-60 flex-col gap-1 text-sm font-semibold">University deadline to secure a placement
          <input type="date" name="placement_secure_by" defaultValue={secureBy ?? ""} className={select} />
          <span className="text-xs font-normal text-muted-foreground">Leave empty for 30 June. Your placement team will know the date.</span>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <label className="flex min-w-0 flex-1 basis-60 flex-col gap-1 text-sm font-semibold">Right to work in the UK
          <select name="work_auth" defaultValue={workAuth ?? ""} className={select}>
            <option value="">Prefer not to say</option>
            {WORK_AUTH.map((w) => <option key={w} value={w}>{WORK_AUTH_LABEL[w]}</option>)}
          </select>
        </label>
        <button type="submit" disabled={pending} className="min-h-11 self-end rounded-[12px] border-2 border-border bg-white px-4 text-sm font-bold transition-colors hover:bg-muted">
          {pending ? "Saving…" : "Save"}
        </button>
      </div>
      <p className="text-xs text-muted-foreground" role="status">
        {state?.ok === false ? <span className="font-semibold text-[#B42318]">{state.error}</span>
          : state?.ok ? state.message
          : "Spring weeks and placements recruit by graduation year, so these decide whether your feed opens on spring weeks, placements or internships."}
      </p>
    </form>
  );
}
