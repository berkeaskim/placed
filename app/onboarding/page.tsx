"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { YEARS, type Year } from "@/lib/types";
import { FIELDS, type OnboardingInputT } from "@/lib/validation/onboarding";
import { celebrate } from "@/components/reward-toast";
import { saveOnboarding } from "./actions";

const YEAR_LABEL: Record<Year, string> = { "1st": "1st year", "2nd": "2nd year", penultimate: "Penultimate", final: "Final year", masters: "Master's" };
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
  const [year, setYear] = useState<Year | null>(null);
  const [field, setField] = useState<string | null>(null);
  const [loc, setLoc] = useState<string[]>([]);
  const [visa, setVisa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canNext = [year, field, loc.length > 0][step];

  function finish() {
    setError(null);
    start(async () => {
      const r = await saveOnboarding({ year: year!, field: field!, locationPref: loc, needsVisa: visa } as OnboardingInputT);
      if ("error" in r) { setError(r.error ?? "Something went wrong"); return; }
      celebrate(r.award);
      router.push("/profile/build");
    });
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col gap-6 px-6 py-10">
      <Progress value={((step + 1) / 3) * 100} aria-label={`Step ${step + 1} of 3`} />
      {step === 0 && (<section className="flex flex-col gap-3"><h1 className="text-3xl font-extrabold">What year are you in?</h1>
        <div className="grid grid-cols-2 gap-3">{YEARS.map((y) => <Choice key={y} selected={year === y} onClick={() => setYear(y)}>{YEAR_LABEL[y]}</Choice>)}</div></section>)}
      {step === 1 && (<section className="flex flex-col gap-3"><h1 className="text-3xl font-extrabold">What do you study?</h1>
        <div className="grid grid-cols-2 gap-3">{FIELDS.map((f) => <Choice key={f} selected={field === f} onClick={() => setField(f)}>{f}</Choice>)}</div></section>)}
      {step === 2 && (<section className="flex flex-col gap-3"><h1 className="text-3xl font-extrabold">Where do you want to work?</h1>
        <div className="grid grid-cols-2 gap-3">{LOCATIONS.map(([k, label]) => (
          <Choice key={k} selected={loc.includes(k)} onClick={() => setLoc((l) => l.includes(k) ? l.filter((x) => x !== k) : [...l, k])}>{label}</Choice>))}</div>
        <label className="card-quest flex min-h-14 items-center justify-between px-4 font-bold">I&apos;ll need visa sponsorship <Switch checked={visa} onCheckedChange={setVisa} /></label></section>)}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-3">
        {step > 0 && <button type="button" onClick={() => setStep(step - 1)} className="min-h-12 rounded-[14px] border-2 px-5 py-3 font-bold">Back</button>}
        <button type="button" disabled={!canNext || pending} onClick={() => (step < 2 ? setStep(step + 1) : finish())} className="btn-quest min-h-12 flex-1 py-3 disabled:opacity-50">
          {step < 2 ? "Next" : pending ? "Saving…" : "Let's go"}
        </button>
      </div>
    </main>
  );
}
