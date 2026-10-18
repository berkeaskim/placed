"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { WORK_AUTH, YEARS, type WorkAuth, type Year } from "@/lib/types";
import { WORK_AUTH_LABEL, needsVisaFor } from "@/lib/profile/work-auth";
import type { OnboardingInputT } from "@/lib/validation/onboarding";
import { SuggestInput } from "@/components/onboarding/suggest-input";
import { fieldForCourse, searchCourses } from "@/lib/profile/courses";
import { searchUniversities } from "@/lib/profile/uk-universities";
import { celebrate } from "@/components/reward-toast";
import { gradYearOptions, guessGradYear } from "@/lib/profile/cycle";
import { todayLondon } from "@/lib/scoring/dates";
import { saveOnboarding } from "./actions";

const YEAR_LABEL: Record<Year, string> = { "1st": "1st year", "2nd": "2nd year", penultimate: "Penultimate", final: "Final year", masters: "Master's" };
/** Index of the final step (university, course, year, locations). */
const LAST = 3;
const LOCATIONS = [["london", "London"], ["uk", "Anywhere in the UK"], ["europe", "Europe"], ["remote", "Remote"]] as const;

function Choice({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={selected}
      className={`card-quest min-h-14 px-4 py-3 text-left font-bold transition ${selected ? "border-primary bg-[#EFEBFF] text-[#3A20C4]" : "hover:border-[#C9C2FF]"}`}>
      {children}
    </button>
  );
}

export default function Onboarding() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [university, setUniversity] = useState("");
  const [course, setCourse] = useState("");
  const [year, setYear] = useState<Year | null>(null);
  const [gradYear, setGradYear] = useState<number | null>(null);
  const today = todayLondon();
  const [loc, setLoc] = useState<string[]>([]);
  const [workAuth, setWorkAuth] = useState<WorkAuth | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const named = (s: string) => s.trim().length >= 2 && /\p{L}/u.test(s);
  const canNext = [named(university), named(course), year, loc.length > 0][step];
  const courseField = named(course) ? fieldForCourse(course) : null;

  function finish() {
    setError(null);
    start(async () => {
      const r = await saveOnboarding({ university, course, year: year!, gradYear, locationPref: loc, needsVisa: needsVisaFor(workAuth), workAuth } as OnboardingInputT);
      if ("error" in r) { setError(r.error ?? "Something went wrong"); return; }
      celebrate(r.award);
      router.push("/profile/build");
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-6 py-10">
      <Progress value={((step + 1) / (LAST + 1)) * 100} aria-label={`Step ${step + 1} of ${LAST + 1}`} />
      {step === 0 && (<section className="flex flex-col gap-3"><h1 className="text-3xl font-extrabold">Where do you study?</h1>
        <SuggestInput label="Your university" value={university} onChange={setUniversity} search={searchUniversities}
          placeholder="Start typing: UCL, Bristol, Edinburgh…" hint="Placed uses it to find alumni at each company. Not listed? Type the full name." /></section>)}
      {step === 1 && (<section className="flex flex-col gap-3"><h1 className="text-3xl font-extrabold">What do you study?</h1>
        <SuggestInput label="Your course" value={course} onChange={setCourse} search={searchCourses}
          placeholder="e.g. Economics and Statistics"
          hint={courseField ? `Placed will read this as ${courseField}.` : "Your course as it's called at your university. The AI works out the rest."} /></section>)}
      {step === 2 && (<section className="flex flex-col gap-3"><h1 className="text-3xl font-extrabold">What year are you in?</h1>
        <div className="grid grid-cols-2 gap-3">{YEARS.map((y) => (
          <Choice key={y} selected={year === y} onClick={() => { setYear(y); setGradYear(guessGradYear(y, today)); }}>{YEAR_LABEL[y]}</Choice>))}</div>
        {year && (<>
          <h2 className="mt-3 text-xl font-extrabold">When do you graduate?</h2>
          <p className="-mt-1 text-sm text-muted-foreground">Spring weeks and internships recruit by graduation year. Change it if your degree is 4 years or has a placement year.</p>
          <div className="grid grid-cols-3 gap-3">{gradYearOptions(today).map((g) => (
            <Choice key={g} selected={gradYear === g} onClick={() => setGradYear(g)}>{g}</Choice>))}</div>
        </>)}</section>)}
      {step === LAST && (<section className="flex flex-col gap-3"><h1 className="text-3xl font-extrabold">Where do you want to work?</h1>
        <div className="grid grid-cols-2 gap-3">{LOCATIONS.map(([k, label]) => (
          <Choice key={k} selected={loc.includes(k)} onClick={() => setLoc((l) => l.includes(k) ? l.filter((x) => x !== k) : [...l, k])}>{label}</Choice>))}</div>
        <label className="flex flex-col gap-1.5 font-bold">Your right to work in the UK
          <select value={workAuth ?? ""} onChange={(e) => setWorkAuth((e.target.value || null) as WorkAuth | null)} className="card-quest min-h-14 px-4 font-semibold">
            <option value="">Prefer not to say</option>
            {WORK_AUTH.map((w) => <option key={w} value={w}>{WORK_AUTH_LABEL[w]}</option>)}
          </select>
          <span className="text-xs font-normal text-muted-foreground">On a Student visa you can usually intern full-time in the holidays, so Placed only flags sponsorship on graduate and permanent roles.</span>
        </label></section>)}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">
        {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="min-h-12 rounded-[14px] border-2 px-5 py-3 font-bold">Back</button>}
        <button type="button" disabled={!canNext || pending} onClick={() => (step < LAST ? setStep(step + 1) : finish())} className="btn-quest min-h-12 flex-1 py-3 disabled:opacity-50">
          {step < LAST ? "Next" : pending ? "Saving…" : "Let's go"}
        </button>
      </div>
    </main>
  );
}
