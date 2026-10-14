"use client";
import { useActionState, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { RTW_LABELS, type Core } from "@/lib/autopilot/vault";
import { YEARS } from "@/lib/types";
import { deleteVault, saveVault, type SaveState } from "./actions";

const YEAR_LABELS: Record<(typeof YEARS)[number], string> = {
  "1st": "1st year", "2nd": "2nd year", penultimate: "Penultimate year", final: "Final year", masters: "Master's",
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const REQUIRED = [
  "first_name", "last_name", "email", "phone", "university", "degree", "year_of_study", "grad_month", "grad_year",
  "country", "city", "rtw_uk", "needs_sponsorship", "start_date", "heard_about",
] as const;

const inputCls = "min-h-11 w-full rounded-[14px] border-2 border-border bg-background px-3 py-2 text-[15px]";

function Field({ name, label, required, hint, children }: { name: string; label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={name} className="text-sm font-semibold">
        {label}
        {required && <span className="text-[#5B3DF5]" aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && <span className="text-xs text-[#4A4A57]">{hint}</span>}
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded-[20px] border bg-white p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

export function SetupForm({ initial, unlocked, needsVisaHint }: { initial: Partial<Core>; unlocked: boolean; needsVisaHint: boolean }) {
  const [state, action, pending] = useActionState<SaveState, FormData>(saveVault, null);
  const formRef = useRef<HTMLFormElement>(null);
  const [filled, setFilled] = useState(() => REQUIRED.filter((k) => Boolean(initial[k])).length);
  const isUnlocked = unlocked || Boolean(state?.unlocked);

  const recount = () => {
    const f = formRef.current;
    if (!f) return;
    const data = new FormData(f);
    setFilled(REQUIRED.filter((k) => String(data.get(k) ?? "").trim() !== "").length);
  };

  useEffect(() => {
    if (state?.unlocked && state.xp) {
      toast.success(`Autopilot unlocked 🚀 +${state.xp} XP`);
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.8 }, colors: ["#5B3DF5", "#FFC800", "#FF9600", "#0E8A5F"] });
    }
  }, [state]);

  const v = (k: keyof Core) => (initial[k] as string | undefined) ?? "";
  const pct = Math.round((filled / REQUIRED.length) * 100);

  return (
    <div className="flex flex-col gap-4">
      <form ref={formRef} action={action} onChange={recount} className="flex flex-col gap-4">
        <div className="rounded-[20px] border bg-white p-5" role="group" aria-label="Progress">
          <div className="mb-2 flex items-center justify-between text-sm font-bold">
            <span>{filled} of {REQUIRED.length} required answers</span>
            {isUnlocked && <span className="rounded-full bg-[#E3F6EE] px-2.5 py-0.5 text-xs text-[#0B6B49]">Autopilot unlocked</span>}
          </div>
          <div className="h-2.5 rounded-full bg-[#E6E6EF]" role="progressbar" aria-valuemin={0} aria-valuemax={REQUIRED.length} aria-valuenow={filled}>
            <div className="h-2.5 rounded-full bg-[#5B3DF5]" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <Card title="Identity">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="first_name" label="First name" required><input id="first_name" name="first_name" required autoComplete="given-name" defaultValue={v("first_name")} placeholder="Ayşe" className={inputCls} /></Field>
            <Field name="last_name" label="Last name" required><input id="last_name" name="last_name" required autoComplete="family-name" defaultValue={v("last_name")} placeholder="Demir" className={inputCls} /></Field>
            <Field name="preferred_name" label="Preferred name" hint="Optional. Only if you go by something else."><input id="preferred_name" name="preferred_name" defaultValue={v("preferred_name")} placeholder="Ash" className={inputCls} /></Field>
            <Field name="pronouns" label="Pronouns" hint="Optional."><input id="pronouns" name="pronouns" defaultValue={v("pronouns")} placeholder="she/her" className={inputCls} /></Field>
            <Field name="email" label="Email" required><input id="email" name="email" type="email" required autoComplete="email" defaultValue={v("email")} placeholder="you@university.ac.uk" className={inputCls} /></Field>
            <Field name="phone" label="Phone" required><input id="phone" name="phone" type="tel" required autoComplete="tel" defaultValue={v("phone")} placeholder="+44 7700 900123" className={inputCls} /></Field>
            <Field name="country" label="Country" required><input id="country" name="country" required autoComplete="country-name" defaultValue={v("country")} placeholder="United Kingdom" className={inputCls} /></Field>
            <Field name="city" label="City" required><input id="city" name="city" required autoComplete="address-level2" defaultValue={v("city")} placeholder="London" className={inputCls} /></Field>
          </div>
        </Card>

        <Card title="Education">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="university" label="University" required><input id="university" name="university" required defaultValue={v("university")} placeholder="University College London" className={inputCls} /></Field>
            <Field name="degree" label="Degree" required><input id="degree" name="degree" required defaultValue={v("degree")} placeholder="BSc Economics" className={inputCls} /></Field>
            <Field name="year_of_study" label="Year of study" required>
              <select id="year_of_study" name="year_of_study" required defaultValue={v("year_of_study")} className={inputCls}>
                <option value="" disabled>Choose one</option>
                {YEARS.map((y) => <option key={y} value={y}>{YEAR_LABELS[y]}</option>)}
              </select>
            </Field>
            <Field name="grades" label="Grades so far" hint="Optional. For example 2:1 predicted, or 68% average."><input id="grades" name="grades" defaultValue={v("grades")} placeholder="First-year average: 68%" className={inputCls} /></Field>
            <Field name="grad_month" label="Graduation month" required>
              <select id="grad_month" name="grad_month" required defaultValue={v("grad_month")} className={inputCls}>
                <option value="" disabled>Choose one</option>
                {MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>
            <Field name="grad_year" label="Graduation year" required><input id="grad_year" name="grad_year" required inputMode="numeric" pattern="20\d\d" maxLength={4} defaultValue={v("grad_year")} placeholder="2028" className={inputCls} /></Field>
          </div>
        </Card>

        <Card title="Eligibility">
          {needsVisaHint && (
            <p className="rounded-[14px] bg-[#FFF1DC] px-3 py-2 text-sm font-medium text-[#7A4100]">You told us you may need a visa. Choose the option that&apos;s true for you.</p>
          )}
          <Field name="rtw_uk" label="Right to work in the UK" required>
            <select id="rtw_uk" name="rtw_uk" required defaultValue={v("rtw_uk")} className={inputCls}>
              <option value="" disabled>Choose one</option>
              {(Object.keys(RTW_LABELS) as (keyof typeof RTW_LABELS)[]).map((k) => <option key={k} value={k}>{RTW_LABELS[k]}</option>)}
            </select>
          </Field>
          <Field name="needs_sponsorship" label="Will you now or in future need visa sponsorship?" required>
            <select id="needs_sponsorship" name="needs_sponsorship" required defaultValue={v("needs_sponsorship")} className={inputCls}>
              <option value="" disabled>Choose one</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
        </Card>

        <Card title="Availability">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="start_date" label="Earliest start date" required><input id="start_date" name="start_date" type="date" required defaultValue={v("start_date")} className={inputCls} /></Field>
            <Field name="internship_length" label="Preferred length" hint="Optional."><input id="internship_length" name="internship_length" defaultValue={v("internship_length")} placeholder="10 to 12 weeks" className={inputCls} /></Field>
          </div>
          <Field name="outstanding_offers" label="Outstanding offers or deadlines" hint="Optional. Employers sometimes ask."><input id="outstanding_offers" name="outstanding_offers" defaultValue={v("outstanding_offers")} placeholder="None" className={inputCls} /></Field>
        </Card>

        <Card title="Links & defaults">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="linkedin" label="LinkedIn" hint="Optional."><input id="linkedin" name="linkedin" type="url" defaultValue={v("linkedin")} placeholder="https://linkedin.com/in/your-name" className={inputCls} /></Field>
            <Field name="github" label="GitHub" hint="Optional."><input id="github" name="github" type="url" defaultValue={v("github")} placeholder="https://github.com/your-name" className={inputCls} /></Field>
            <Field name="portfolio" label="Portfolio or website" hint="Optional."><input id="portfolio" name="portfolio" type="url" defaultValue={v("portfolio")} placeholder="https://your-site.co.uk" className={inputCls} /></Field>
            <Field name="languages" label="Languages" hint="Optional."><input id="languages" name="languages" defaultValue={v("languages")} placeholder="English (native), Turkish (fluent)" className={inputCls} /></Field>
          </div>
          <Field name="heard_about" label="How did you hear about the role?" required hint="Your default answer for the “How did you hear about us?” question."><input id="heard_about" name="heard_about" required defaultValue={v("heard_about")} placeholder="Placed" className={inputCls} /></Field>
        </Card>

        <p className="text-sm text-[#4A4A57]">We never store questions about gender, ethnicity, disability and similar. You answer those on the form yourself.</p>

        {state && !state.ok && <p role="alert" className="text-sm font-semibold text-destructive">We couldn&apos;t save that. Please try again.</p>}
        {state?.ok && !state.unlocked && state.missing.length > 0 && (
          <p role="status" className="rounded-[14px] bg-[#FFF1DC] px-3 py-2 text-sm font-medium text-[#7A4100]">Progress saved. Still to answer: {state.missing.length} required {state.missing.length === 1 ? "field" : "fields"}.</p>
        )}
        {state?.ok && state.unlocked && (
          <p role="status" className="rounded-[14px] bg-[#E3F6EE] px-3 py-2 text-sm font-bold text-[#0B6B49]">Autopilot unlocked 🚀{state.xp ? ` +${state.xp} XP` : ""}</p>
        )}

        <button type="submit" disabled={pending} className="min-h-11 rounded-[14px] bg-[#5B3DF5] px-4 py-3 font-bold text-white shadow-[0_3px_0_#3A20C4] disabled:opacity-60">
          {pending ? "Saving..." : "Save my answers"}
        </button>
      </form>

      <form
        action={deleteVault}
        onSubmit={(e) => { if (!window.confirm("Delete your saved Autopilot answers and packs? This can't be undone.")) e.preventDefault(); }}
      >
        <button type="submit" className="min-h-11 w-full rounded-[14px] border-2 border-destructive px-4 py-3 font-bold text-destructive">Delete my Autopilot data</button>
      </form>
    </div>
  );
}
