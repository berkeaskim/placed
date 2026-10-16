"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Check, ExternalLink, Sparkles } from "lucide-react";
import { OutreachDrafter } from "@/components/outreach/outreach-drafter";
import { alumniLabel, linkedinSearchUrl, searchKeywords } from "@/lib/outreach/targets";
import { REACH, type Plan, type PlanStep } from "@/lib/strategy/plan";

const DAY = 86_400_000;
const at = (d: string) => Date.parse(`${d}T00:00:00Z`);
const SPRING = { type: "spring", bounce: 0, duration: 0.35 } as const;

/** "Today", "Tomorrow", "In 3 days", "2 days late", or "Thu 24 Oct" further out. */
export function dueLabel(due: string, today: string): string {
  const d = Math.round((at(due) - at(today)) / DAY);
  if (d === 0) return "Today";
  if (d === 1) return "Tomorrow";
  if (d < 0) return `${-d} day${d === -1 ? "" : "s"} late`;
  if (d < 7) return `In ${d} days`;
  return new Date(at(due)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}

const DOT: Record<PlanStep["state"], string> = { done: "#12A150", next: "#5B3DF5", upcoming: "#C9C9D6" };

export function PlanBoard({ plan, jobId, company, title, today, deadline, school }: {
  plan: Plan; jobId: string; company: string; title: string; today: string; deadline: string | null; school: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState<string | null>(null);
  const reduce = useReducedMotion();

  const dates = [today, ...plan.steps.map((s) => s.due), ...(deadline ? [deadline] : [])].map(at);
  const lo = Math.min(...dates);
  const hi = Math.max(...dates, lo + 7 * DAY);
  const pos = (d: string) => `${((at(d) - lo) / (hi - lo)) * 100}%`;
  const moves = plan.steps.filter((s) => s.state !== "done" && s.target).slice(0, 3);

  const openStep = (key: string) => {
    setOpen(key);
    requestAnimationFrame(() => document.getElementById(`step-${key}`)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "center" }));
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-labelledby="plan-h" className="card-quest flex flex-col gap-5 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 id="plan-h" className="text-lg font-extrabold tracking-tight">Your plan</h2>
          <span className="text-sm text-muted-foreground">{plan.doneCount} of {plan.steps.length} done</span>
        </div>

        {/* Timeline: every step on one track between today and the last date. */}
        <div className="relative mx-2 mb-6 mt-6 h-2 rounded-full bg-[#EFEFF5]" aria-hidden>
          <div className="absolute inset-y-0 left-0 rounded-full bg-[#5B3DF5]/25" style={{ width: pos(today) }} />
          {plan.steps.map((s) => (
            <button key={s.key} type="button" tabIndex={-1} onClick={() => openStep(s.key)}
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(26,26,46,.08)] transition-transform hover:scale-125"
              style={{ left: pos(s.due), background: DOT[s.state] }} title={s.title} />
          ))}
          <span className="absolute top-4 -translate-x-1/2 text-[11px] font-semibold text-muted-foreground" style={{ left: pos(today) }}>Today</span>
          {deadline && (
            <>
              <span className="absolute -top-1.5 h-5 w-0.5 -translate-x-1/2 rounded-full bg-[#D92D20]" style={{ left: pos(deadline) }} />
              <span className="absolute -top-6 -translate-x-1/2 whitespace-nowrap text-[11px] font-semibold text-[#B42318]" style={{ left: pos(deadline) }}>Closes</span>
            </>
          )}
        </div>

        <ol className="flex flex-col">
          {plan.steps.map((s, i) => {
            const isOpen = open === s.key;
            return (
              <li key={s.key} id={`step-${s.key}`} className="relative flex gap-3 pb-5 last:pb-0">
                {i < plan.steps.length - 1 && <span aria-hidden className="absolute left-[11px] top-7 h-[calc(100%-1.25rem)] w-0.5 rounded-full bg-[#EFEFF5]" />}
                <span aria-hidden className="relative mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full"
                  style={{ background: s.state === "upcoming" ? "#fff" : DOT[s.state], boxShadow: s.state === "upcoming" ? "inset 0 0 0 2px #DCDCE6" : "none" }}>
                  {s.state === "done" ? <Check className="size-3.5 text-white" strokeWidth={3} /> : s.state === "next" && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className={`text-[15px] font-bold tracking-tight ${s.state === "done" ? "text-muted-foreground line-through decoration-[#C9C9D6]" : ""}`}>{s.title}</span>
                    <span className={`text-xs font-semibold ${s.overdue ? "text-[#B42318]" : "text-muted-foreground"}`}>
                      {s.state === "done" ? "Done" : dueLabel(s.due, today)}
                    </span>
                  </div>
                  {s.state !== "done" && <p className="text-sm leading-snug text-muted-foreground">{s.why}</p>}
                  {s.state !== "done" && (
                    <div className="mt-1 flex flex-wrap gap-2">
                      {s.target && (
                        <button type="button" onClick={() => (isOpen ? setOpen(null) : openStep(s.key))} aria-expanded={isOpen}
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-[#1A1A2E] px-3.5 text-xs font-bold text-white transition-transform duration-100 active:scale-95">
                          <Sparkles className="size-3.5" /> {isOpen ? "Hide message" : "Write the message"}
                        </button>
                      )}
                      {s.target && (
                        <a href={linkedinSearchUrl(searchKeywords(s.target, company, title, school))} target="_blank" rel="noopener noreferrer"
                          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-semibold text-foreground no-underline transition-transform duration-100 active:scale-95">
                          Find them on LinkedIn <ExternalLink className="size-3" />
                        </a>
                      )}
                      {s.kind === "apply" && (
                        <Link href={`/jobs/${jobId}`} className="inline-flex min-h-9 items-center rounded-full bg-[#5B3DF5] px-3.5 text-xs font-bold text-white no-underline">
                          Tailor and apply →
                        </Link>
                      )}
                      {s.kind === "prep" && (
                        <Link href={`/jobs/${jobId}#prep`} className="inline-flex min-h-9 items-center rounded-full border px-3.5 text-xs font-semibold text-foreground no-underline">
                          Interview prep →
                        </Link>
                      )}
                    </div>
                  )}
                  <AnimatePresence initial={false}>
                    {isOpen && s.target && s.purpose && (
                      <motion.div key="drafter" className="overflow-hidden"
                        initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }} animate={reduce ? { opacity: 1 } : { opacity: 1, height: "auto" }}
                        exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }} transition={SPRING}>
                        <div className="mt-2 rounded-2xl bg-[#F7F7FA] p-3">
                          <OutreachDrafter jobId={jobId} school={school} initialTarget={s.target} initialPurpose={s.purpose} onMarked={() => router.refresh()} />
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <aside aria-labelledby="moves-h" className="flex flex-col gap-3">
        <h2 id="moves-h" className="text-sm font-bold">Who to message this week</h2>
        {moves.length === 0 && (
          <p className="card-quest p-4 text-sm text-muted-foreground">Every message in the plan is sent. Keep the tracker up to date as replies come in.</p>
        )}
        {moves.map((m, i) => (
          <button key={m.key} type="button" onClick={() => openStep(m.key)}
            className={`flex flex-col gap-1 rounded-2xl border bg-white p-4 text-left transition-transform duration-100 ease-out active:scale-[0.98] ${i === 0 ? "border-[#5B3DF5] shadow-[0_0_0_1px_#5B3DF5]" : ""}`}>
            <span className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold">{i + 1} · {m.target === "alumni" ? alumniLabel(school) : REACH[m.target!].label}</span>
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${REACH[m.target!].reply === "High" ? "bg-[#E6F6EC] text-[#0B6B35]" : "bg-[#FFF3E0] text-[#93370D]"}`}>
                {REACH[m.target!].reply} reply
              </span>
            </span>
            <span className="text-xs leading-snug text-muted-foreground">{m.why}</span>
            <span className={`text-xs font-semibold ${m.overdue ? "text-[#B42318]" : "text-[#5B3DF5]"}`}>{dueLabel(m.due, today)} · Write it →</span>
          </button>
        ))}
        <p className="px-1 text-xs leading-snug text-muted-foreground">Placed writes the message from your CV. You send it yourself on LinkedIn, then mark it here.</p>
      </aside>
    </div>
  );
}
