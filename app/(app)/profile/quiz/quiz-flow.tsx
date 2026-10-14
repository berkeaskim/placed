"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { Progress } from "@/components/ui/progress";
import { QUESTIONS } from "@/lib/quiz/questions";
import type { RoleCard } from "@/lib/quiz/view";
import { celebrate } from "@/components/reward-toast";
import { submitQuiz } from "./actions";

/** One stroke icon per question card (spec §9 step 3: "6 visual cards"). */
const ICONS: Record<string, React.ReactNode> = {
  fun: <><path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.4 6.7 19.4l1.2-6L3.4 9.3l6-.7z" /></>,
  tuesday: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 11h18" /></>,
  power: <><path d="M13 2 4 14h7l-1 8 9-12h-7z" /></>,
  group: <><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.5" /><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" /><path d="M15 14.5c2.8 0 5 2.2 5 5" /></>,
  module: <><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 19V5" /><path d="M8 7h7" /></>,
  matters: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></>,
};

function QIcon({ id }: { id: string }) {
  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#EFEBFF] text-[#5B3DF5]">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS[id]}
      </svg>
    </span>
  );
}

type Done = { roles: RoleCard[]; skills: string[]; keptCvRoles: boolean };

export function QuizFlow() {
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, start] = useTransition();
  const q = QUESTIONS[i];
  const last = i === QUESTIONS.length - 1;

  function submit(all: Record<string, string>) {
    setError(null);
    start(async () => {
      const r = await submitQuiz(all);
      if ("error" in r) { setError(r.error); return; }
      celebrate(r.award);
      setDone({ roles: r.roles, skills: r.skills, keptCvRoles: r.keptCvRoles });
    });
  }

  function pick(id: string) {
    if (pending) return;
    const next = { ...answers, [q.id]: id };
    setAnswers(next);
    if (!last) { setI(i + 1); return; }
    submit(next);
  }

  if (done) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Roles that fit you</h1>
          <p className="text-muted-foreground">From your quiz answers. Upload a CV later for a sharper picture.</p>
        </div>
        {done.keptCvRoles && (
          <p role="note" className="rounded-2xl border border-[#F5D9A8] bg-[#FFF1DC] px-4 py-3 text-sm font-semibold text-[#7A4100]">
            Your profile still uses the roles from your CV. Upload a new CV to change them.
          </p>
        )}
        <ol className="flex flex-col gap-3">
          {done.roles.map((r) => (
            <li key={r.key} className="card-quest flex items-start gap-4 p-5">
              <span className="num-quest flex h-14 w-14 shrink-0 items-center justify-center rounded-[14px] bg-[#EFEBFF] text-lg text-[#3A20C4]">{r.score}%</span>
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-bold">{r.title}</h2>
                <ul className="flex flex-col gap-0.5 text-sm text-[#5B5B6B]">{r.why.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            </li>
          ))}
        </ol>
        {done.skills.length > 0 && (
          <section aria-labelledby="starter-h" className="flex flex-col gap-2">
            <h2 id="starter-h" className="text-sm font-bold">Skills worth learning first</h2>
            <ul className="flex flex-wrap gap-2">
              {done.skills.map((s) => <li key={s} className="rounded-lg bg-[#F2F2F7] px-3 py-1.5 text-sm font-semibold text-[#3F3F4C]">{s}</li>)}
            </ul>
          </section>
        )}
        <Link href="/profile" className="btn-quest flex min-h-12 items-center justify-center self-start px-6 py-3">See my profile</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Progress value={((i + 1) / QUESTIONS.length) * 100} aria-label={`Question ${i + 1} of ${QUESTIONS.length}`} />
      <section className="card-quest flex flex-col gap-5 p-5 sm:p-6" aria-labelledby="quiz-q">
        <div className="flex items-center gap-4">
          <QIcon id={q.id} />
          <div className="flex flex-col">
            <span className="text-xs font-bold uppercase tracking-wide text-[#5B5B6B]">Question {i + 1} of {QUESTIONS.length}</span>
            <h1 id="quiz-q" className="text-2xl font-extrabold tracking-tight sm:text-3xl">{q.prompt}</h1>
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {q.options.map((o) => {
            const selected = answers[q.id] === o.id;
            return (
              <button key={o.id} type="button" disabled={pending} onClick={() => pick(o.id)} aria-pressed={selected}
                className={`min-h-14 rounded-[16px] border-2 border-b-4 px-4 py-3 text-left font-bold transition disabled:opacity-60 ${selected ? "border-[#5B3DF5] bg-[#EFEBFF] text-[#3A20C4]" : "border-[#E6E6EF] bg-white hover:border-[#C9C2FF]"}`}>
                {o.label}
              </button>
            );
          })}
        </div>
      </section>
      <div className="flex flex-wrap items-center gap-3">
        {i > 0 && (
          <button type="button" disabled={pending} onClick={() => { setError(null); setI(i - 1); }} className="min-h-12 rounded-[14px] border-2 px-5 py-3 font-bold disabled:opacity-60">Back</button>
        )}
        {last && answers[q.id] && error && !pending && (
          <button type="button" onClick={() => submit(answers)} className="btn-quest min-h-12 px-5 py-3">Try again</button>
        )}
        {pending && <p role="status" aria-live="polite" className="font-semibold text-[#3A20C4]">Finding your roles…</p>}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
