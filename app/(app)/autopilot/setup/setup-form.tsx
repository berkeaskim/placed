"use client";
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { RTW_LABELS, type Core } from "@/lib/autopilot/vault";
import { YEARS } from "@/lib/types";
import { deleteVault, saveVault, type SaveState } from "./actions";
import { AppIcon, Group, btnPrimary, field, select } from "@/components/ui/apple";

const LABELS: Record<string, string> = {
  first_name: "First name", last_name: "Last name", preferred_name: "Preferred name", pronouns: "Pronouns", email: "Email", phone: "Phone",
  country: "Country", city: "City", university: "University", degree: "Degree", year_of_study: "Year of study", grades: "Grades so far",
  grad_month: "Graduation month", grad_year: "Graduation year", rtw_uk: "Right to work in the UK", needs_sponsorship: "Visa sponsorship",
  start_date: "Earliest start date", internship_length: "Preferred length", outstanding_offers: "Outstanding offers or deadlines",
  linkedin: "LinkedIn", github: "GitHub", portfolio: "Portfolio or website", languages: "Languages", heard_about: "How did you hear about the role?",
  placement_included: "Course includes a placement year", placement_academic_year: "Placement academic year", available_from: "Available from",
  available_to: "Available until", placement_duration: "Placement length you can do", placement_min_weeks: "University minimum (weeks)",
  returning_to_study: "Returning to study afterwards", year1_result: "Year 1 result", predicted_class: "Predicted degree class",
  relocation: "Relocation", placement_office: "University placement office",
};

const YEAR_LABELS: Record<(typeof YEARS)[number], string> = {
  "1st": "1st year", "2nd": "2nd year", penultimate: "Penultimate year", final: "Final year", masters: "Master's",
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const REQUIRED = [
  "first_name", "last_name", "email", "phone", "university", "degree", "year_of_study", "grad_month", "grad_year",
  "country", "city", "rtw_uk", "needs_sponsorship", "start_date", "heard_about",
] as const;

const inputCls = field;
const selectCls = select;

/** One question as a System Settings row: label (and hint) leading, the control trailing. */
function Field({ name, label, required, hint, children }: { name: string; label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="relative flex flex-col gap-2 px-4 py-2.5 after:pointer-events-none after:absolute after:bottom-0 after:left-4 after:right-0 after:h-px after:bg-black/[0.07] last:after:hidden sm:flex-row sm:items-center sm:gap-4">
      <span className="flex min-w-0 flex-col sm:w-[42%] sm:shrink-0">
        <label htmlFor={name} className="text-[14px] font-medium tracking-[-0.01em] text-black/90">
          {label}
          {required && <span className="text-[#5B3DF5]" aria-hidden="true"> *</span>}
        </label>
        {hint && <span className="mt-0.5 text-[12px] leading-snug text-black/50">{hint}</span>}
      </span>
      <span className="flex min-w-0 flex-1">{children}</span>
    </div>
  );
}

function Card({ title, footer, children }: { title: string; footer?: React.ReactNode; children: React.ReactNode }) {
  return <Group title={title} footer={footer}>{children}</Group>;
}

export function SetupForm({ initial, unlocked, needsVisaHint }: { initial: Partial<Core>; unlocked: boolean; needsVisaHint: boolean }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveVault, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [formKey, setFormKey] = useState(0);
  const [clearedFor, setClearedFor] = useState<{ s: SaveState } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, startDelete] = useTransition();
  const cleared = clearedFor !== null && clearedFor.s === state;
  const values: Record<string, string> = cleared ? {} : (state?.values ?? (initial as Record<string, string>));
  const isUnlocked = cleared ? false : state ? state.unlocked : unlocked;
  const [filled, setFilled] = useState(() => REQUIRED.filter((k) => Boolean(initial[k])).length);

  const recount = () => {
    const f = formRef.current;
    if (!f) return;
    const data = new FormData(f);
    setFilled(REQUIRED.filter((k) => String(data.get(k) ?? "").trim() !== "").length);
  };

  // React resets the form after an action; the fields re-mount (key) seeded from the returned values, so typing is kept. Recount from the DOM afterwards.
  useEffect(() => {
    recount();
    if (state && !cleared) {
      const first = [...state.invalid, ...state.missing][0];
      if (first) document.getElementById(first)?.focus();
    }
  }, [state, formKey, cleared]);

  useEffect(() => {
    if (state?.unlocked && state.xp) {
      toast.success(`Autopilot unlocked 🚀 +${state.xp} XP`);
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.8 }, colors: ["#5B3DF5", "#FFC800", "#FF9600", "#0E8A5F"] });
    }
  }, [state]);

  const v = (k: keyof Core) => values[k] ?? "";
  const labelList = (keys: string[]) => keys.map((k) => LABELS[k] ?? k).join(", ");
  const shownInvalid = cleared ? [] : (state?.invalid ?? []);
  const shownMissing = cleared ? [] : (state?.missing ?? []).filter((k) => !shownInvalid.includes(k));

  const onDelete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!window.confirm("Delete your saved Autopilot answers and packs? This can't be undone.")) return;
    setDeleteError(null);
    startDelete(async () => {
      const r = await deleteVault();
      if (r.ok) { setClearedFor({ s: state }); setFormKey((n) => n + 1); }
      else setDeleteError(r.error ?? "We couldn't delete your Autopilot data. Please try again.");
    });
  };
  const pct = Math.round((filled / REQUIRED.length) * 100);

  return (
    <div className="flex flex-col gap-6">
      <form key={`${formKey}:${JSON.stringify(values)}`} ref={formRef} action={action} onChange={recount} className="flex flex-col gap-6">
        <div className="flex items-center gap-4 rounded-[14px] bg-white p-4 shadow-[0_0_0_0.5px_rgba(0,0,0,0.09),0_1px_3px_rgba(0,0,0,0.05)] sm:p-5" role="group" aria-label="Progress">
          <AppIcon kind="autopilot" size={44} />
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[15px] font-semibold tracking-[-0.015em] text-black/90">{filled} of {REQUIRED.length} required answers</span>
              {isUnlocked ? (
                <span className="flex items-center gap-1.5 text-[13px] font-medium text-[#248A3D]"><span aria-hidden className="size-2 rounded-full bg-[#34C759]" />Autopilot unlocked</span>
              ) : (
                <span className="text-[13px] text-black/50">{REQUIRED.length - filled} to go</span>
              )}
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-black/[0.08]" role="progressbar" aria-label="Required answers completed" aria-valuemin={0} aria-valuemax={REQUIRED.length} aria-valuenow={filled}>
              <div className="h-full rounded-full bg-[#5B3DF5] transition-[width] duration-300 ease-out motion-reduce:transition-none" style={{ width: `${pct}%` }} />
            </div>
          </div>
        </div>

        <Card title="Identity">
          <>
            <Field name="first_name" label="First name" required><input id="first_name" name="first_name" required autoComplete="given-name" defaultValue={v("first_name")} placeholder="Ayşe" className={inputCls} /></Field>
            <Field name="last_name" label="Last name" required><input id="last_name" name="last_name" required autoComplete="family-name" defaultValue={v("last_name")} placeholder="Demir" className={inputCls} /></Field>
            <Field name="preferred_name" label="Preferred name" hint="Optional. Only if you go by something else."><input id="preferred_name" name="preferred_name" defaultValue={v("preferred_name")} placeholder="Ash" className={inputCls} /></Field>
            <Field name="pronouns" label="Pronouns" hint="Optional."><input id="pronouns" name="pronouns" defaultValue={v("pronouns")} placeholder="she/her" className={inputCls} /></Field>
            <Field name="email" label="Email" required><input id="email" name="email" type="email" required autoComplete="email" defaultValue={v("email")} placeholder="you@university.ac.uk" className={inputCls} /></Field>
            <Field name="phone" label="Phone" required><input id="phone" name="phone" type="tel" required minLength={5} autoComplete="tel" defaultValue={v("phone")} placeholder="+44 7700 900123" className={inputCls} /></Field>
            <Field name="country" label="Country" required><input id="country" name="country" required autoComplete="country-name" defaultValue={v("country")} placeholder="United Kingdom" className={inputCls} /></Field>
            <Field name="city" label="City" required><input id="city" name="city" required autoComplete="address-level2" defaultValue={v("city")} placeholder="London" className={inputCls} /></Field>
          </>
        </Card>

        <Card title="Education">
          <>
            <Field name="university" label="University" required><input id="university" name="university" required defaultValue={v("university")} placeholder="University College London" className={inputCls} /></Field>
            <Field name="degree" label="Degree" required><input id="degree" name="degree" required defaultValue={v("degree")} placeholder="BSc Economics" className={inputCls} /></Field>
            <Field name="year_of_study" label="Year of study" required>
              <select id="year_of_study" name="year_of_study" required defaultValue={v("year_of_study")} className={selectCls}>
                <option value="" disabled>Choose one</option>
                {YEARS.map((y) => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
              </select>
            </Field>
            <Field name="grades" label="Grades so far" hint="Optional. For example 2:1 predicted, or 68% average."><input id="grades" name="grades" defaultValue={v("grades")} placeholder="First-year average: 68%" className={inputCls} /></Field>
            <Field name="grad_month" label="Graduation month" required>
              <select id="grad_month" name="grad_month" required defaultValue={v("grad_month")} className={selectCls}>
                <option value="" disabled>Choose one</option>
                {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field name="grad_year" label="Graduation year" required><input id="grad_year" name="grad_year" required inputMode="numeric" pattern="20\d\d" maxLength={4} defaultValue={v("grad_year")} placeholder="2028" className={inputCls} /></Field>
          </>
        </Card>

        <Card title="Eligibility">
          {needsVisaHint && (
            <p className="relative px-4 py-2.5 text-[13px] font-medium text-[#B25000] after:absolute after:bottom-0 after:left-4 after:right-0 after:h-px after:bg-black/[0.07]">You told us you may need a visa. Choose the option that&apos;s true for you.</p>
          )}
          <Field name="rtw_uk" label="Right to work in the UK" required>
            <select id="rtw_uk" name="rtw_uk" required defaultValue={v("rtw_uk")} className={selectCls}>
              <option value="" disabled>Choose one</option>
              {(Object.keys(RTW_LABELS) as (keyof typeof RTW_LABELS)[]).map((k) => <option key={k} value={k}>{RTW_LABELS[k]}</option>)}
            </select>
          </Field>
          <Field name="needs_sponsorship" label="Will you now or in future need visa sponsorship?" required>
            <select id="needs_sponsorship" name="needs_sponsorship" required defaultValue={v("needs_sponsorship")} className={selectCls}>
              <option value="" disabled>Choose one</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
        </Card>

        <Card title="Availability">
          <>
            <Field name="start_date" label="Earliest start date" required><input id="start_date" name="start_date" type="date" required defaultValue={v("start_date")} className={inputCls} /></Field>
            <Field name="internship_length" label="Preferred length" hint="Optional."><input id="internship_length" name="internship_length" defaultValue={v("internship_length")} placeholder="10 to 12 weeks" className={inputCls} /></Field>
          </>
          <Field name="outstanding_offers" label="Outstanding offers or deadlines" hint="Optional. Employers sometimes ask."><input id="outstanding_offers" name="outstanding_offers" defaultValue={v("outstanding_offers")} placeholder="None" className={inputCls} /></Field>
        </Card>

        <Card title="Placement year" footer="Optional. Only if your course has a placement year: placement forms ask these, and Autopilot fills them from here.">
          <>
            <Field name="placement_included" label="Does your course include a placement year?">
              <select id="placement_included" name="placement_included" defaultValue={v("placement_included")} className={selectCls}>
                <option value="">Not set</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field name="placement_academic_year" label="Placement academic year" hint="For example 2027–28."><input id="placement_academic_year" name="placement_academic_year" defaultValue={v("placement_academic_year")} placeholder="2027–28" className={inputCls} /></Field>
            <Field name="available_from" label="Available from"><input id="available_from" name="available_from" type="date" defaultValue={v("available_from")} className={inputCls} /></Field>
            <Field name="available_to" label="Available until" hint="The last day before you go back to university."><input id="available_to" name="available_to" type="date" defaultValue={v("available_to")} className={inputCls} /></Field>
            <Field name="placement_duration" label="Placement length you can do"><input id="placement_duration" name="placement_duration" defaultValue={v("placement_duration")} placeholder="9 to 13 months" className={inputCls} /></Field>
            <Field name="placement_min_weeks" label="University minimum (weeks)" hint="Your course's minimum placement length, if it has one."><input id="placement_min_weeks" name="placement_min_weeks" inputMode="numeric" pattern="\d{1,2}" maxLength={2} defaultValue={v("placement_min_weeks")} placeholder="36" className={inputCls} /></Field>
            <Field name="returning_to_study" label="Returning to full-time study afterwards?">
              <select id="returning_to_study" name="returning_to_study" defaultValue={v("returning_to_study")} className={selectCls}>
                <option value="">Not set</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            </Field>
            <Field name="year1_result" label="Year 1 result"><input id="year1_result" name="year1_result" defaultValue={v("year1_result")} placeholder="68% average (First)" className={inputCls} /></Field>
            <Field name="predicted_class" label="Predicted degree class"><input id="predicted_class" name="predicted_class" defaultValue={v("predicted_class")} placeholder="2:1" className={inputCls} /></Field>
            <Field name="relocation" label="Relocation"><input id="relocation" name="relocation" defaultValue={v("relocation")} placeholder="Willing to relocate anywhere in the UK" className={inputCls} /></Field>
          </>
          <Field name="placement_office" label="University placement office" hint="Optional. Some employers ask who approves your placement."><input id="placement_office" name="placement_office" defaultValue={v("placement_office")} placeholder="placements@university.ac.uk" className={inputCls} /></Field>
        </Card>

        <Card title="Links & defaults">
          <>
            <Field name="linkedin" label="LinkedIn" hint="Optional."><input id="linkedin" name="linkedin" type="text" inputMode="url" autoCapitalize="off" spellCheck={false} defaultValue={v("linkedin")} placeholder="https://linkedin.com/in/your-name" className={inputCls} /></Field>
            <Field name="github" label="GitHub" hint="Optional."><input id="github" name="github" type="text" inputMode="url" autoCapitalize="off" spellCheck={false} defaultValue={v("github")} placeholder="https://github.com/your-name" className={inputCls} /></Field>
            <Field name="portfolio" label="Portfolio or website" hint="Optional."><input id="portfolio" name="portfolio" type="text" inputMode="url" autoCapitalize="off" spellCheck={false} defaultValue={v("portfolio")} placeholder="https://your-site.co.uk" className={inputCls} /></Field>
            <Field name="languages" label="Languages" hint="Optional."><input id="languages" name="languages" defaultValue={v("languages")} placeholder="English (native), Turkish (fluent)" className={inputCls} /></Field>
          </>
          <Field name="heard_about" label="How did you hear about the role?" required hint="Your default answer for the “How did you hear about us?” question."><input id="heard_about" name="heard_about" required defaultValue={v("heard_about")} placeholder="Placed" className={inputCls} /></Field>
        </Card>

        <p className="px-3 text-[12px] text-black/50">We never store questions about gender, ethnicity, disability and similar. You answer those on the form yourself.</p>

        {!cleared && state && !state.ok && <p role="alert" className="text-[13px] font-medium text-[#D70015]">We couldn&apos;t save that. Please try again.</p>}
        {shownInvalid.length > 0 && (
          <p role="alert" className="rounded-[10px] bg-[#FF9F0A]/[0.12] px-3 py-2 text-[13px] font-medium text-[#8A4200]">These answers don&apos;t look right, so we kept your last saved version: {labelList(shownInvalid)}.</p>
        )}
        {shownMissing.length > 0 && (
          <p role="status" className="rounded-[10px] bg-[#FF9F0A]/[0.12] px-3 py-2 text-[13px] font-medium text-[#8A4200]">Progress saved. Still to answer: {labelList(shownMissing)}.</p>
        )}
        {!cleared && state?.ok && state.unlocked && shownInvalid.length === 0 && (
          <p role="status" className="rounded-[10px] bg-[#34C759]/[0.12] px-3 py-2 text-[13px] font-semibold text-[#1C6B30]">Autopilot unlocked 🚀{state.xp ? ` +${state.xp} XP` : ""}</p>
        )}

        <div className="sticky bottom-3 z-10 flex items-center justify-between gap-3 rounded-[14px] border border-white/60 bg-white/70 px-4 py-2.5 shadow-[0_0_0_0.5px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.08)] backdrop-blur-xl backdrop-saturate-150 supports-[not(backdrop-filter:blur(1px))]:bg-white motion-reduce:backdrop-blur-none">
          <span className="text-[12px] text-black/55">{filled} of {REQUIRED.length} required · saved on this Mac only</span>
          <button type="submit" disabled={pending} className={`${btnPrimary} min-h-10 px-5 text-[14px]`}>
            {pending ? "Saving…" : "Save my answers"}
          </button>
        </div>
      </form>

      <form onSubmit={onDelete}>
        <Group footer={deleteError ? <span role="alert" className="font-medium text-[#D70015]">{deleteError}</span> : "Removes these answers, remembered answers and saved packs from this Mac."}>
          <button type="submit" disabled={deleting} className="block w-full px-4 py-3 text-left text-[14px] font-medium text-[#D70015] transition-colors duration-75 hover:bg-black/[0.025] active:bg-black/[0.06] disabled:opacity-50">
            {deleting ? "Deleting…" : "Delete my Autopilot data…"}
          </button>
        </Group>
      </form>
    </div>
  );
}
