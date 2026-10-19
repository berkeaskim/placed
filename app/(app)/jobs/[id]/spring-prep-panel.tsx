"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { BookOpenText, ChevronDown, Lightbulb, MessagesSquare, Quote, Route, ShieldCheck, Video } from "lucide-react";
import {
  practiceSet, SPRING_FRAMING, SPRING_GROUPS, springQuestions,
  type SpringContext, type SpringGroup, type SpringQuestion,
} from "@/lib/interview-prep/spring-bank";
import type { StorySuggestion } from "@/lib/interview-prep/spring-stories";
import { VideoPractice } from "./video-practice";

const SPRING = { type: "spring", bounce: 0, duration: 0.4 } as const;

/**
 * Interview prep for a spring week: replaces the generic web-researched pack. Motivation-first framing, a timed video
 * practice, the 30-question spring bank and STAR stories from the Experience Bank. All local, no AI call.
 */
export function SpringPrepPanel({ ctx, stories, bankEmpty }: { ctx: SpringContext; stories: StorySuggestion[]; bankEmpty: boolean }) {
  const [seed, setSeed] = useState(0);
  const [technicals, setTechnicals] = useState(false);
  const set = useMemo(() => practiceSet(ctx, { seed, technicals }), [ctx, seed, technicals]);
  const all = useMemo(() => springQuestions(ctx), [ctx]);

  return (
    <section id="prep" aria-label="Spring week interview prep" className="relative flex scroll-mt-6 flex-col gap-8 overflow-hidden rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(31,20,90,0.12)] sm:p-7">
      <header className="flex flex-col gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5B3DF5]">{ctx.firm} · Spring week</p>
        <h2 className="text-[26px] font-bold leading-[1.1] tracking-[-0.022em] text-[#1C1C1E]">Interview prep</h2>
        <p className="max-w-[62ch] text-[17px] leading-[1.47] tracking-[-0.01em] text-[#3C3C43]">{SPRING_FRAMING.lead}</p>
      </header>

      <div className="flex flex-col gap-3">
        <SectionTitle icon={Route}>How it usually runs</SectionTitle>
        <ol className="grid gap-2 sm:grid-cols-4">
          {SPRING_FRAMING.process.map((s, i) => (
            <li key={s.stage} className="flex flex-col gap-1 rounded-[14px] bg-[#F6F5FB] p-3">
              <span className="text-[12px] font-semibold tabular-nums text-[#5B3DF5]">{i + 1}</span>
              <p className="text-[14px] font-semibold leading-snug text-[#1C1C1E]">{s.stage}</p>
              <p className="text-[13px] leading-[1.38] text-[#6E6E73]">{s.note}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="flex flex-col gap-3">
        <SectionTitle icon={Video}>Practise the video interview</SectionTitle>
        <p className="text-[14px] leading-[1.43] text-[#6E6E73]">{ctx.preset.note}</p>
        <label className="flex min-h-9 cursor-pointer items-center gap-2 self-start text-[14px] text-[#3C3C43]">
          <input type="checkbox" checked={technicals} onChange={(e) => setTechnicals(e.target.checked)} className="h-4 w-4 accent-[#5B3DF5]" />
          Include a light technical question <span className="text-[#8E8E93]">(final rounds only, rare on video)</span>
        </label>
        <VideoPractice key={`${seed}-${technicals}`} questions={set} prepSeconds={ctx.preset.prepSeconds} answerSeconds={ctx.preset.answerSeconds} onRestart={() => setSeed((s) => s + 1)} />
      </div>

      <Stories stories={stories} bankEmpty={bankEmpty} />

      <Bank questions={all} reported={ctx.preset.reported} firm={ctx.firm} />

      <div className="flex flex-col gap-3">
        <SectionTitle icon={Lightbulb}>What gets people through</SectionTitle>
        <ul className="flex flex-col divide-y divide-black/[0.06] overflow-hidden rounded-[18px] bg-[#F6F5FB]">
          {SPRING_FRAMING.tips.map((t) => (
            <li key={t} className="flex gap-3 px-4 py-3 text-[15px] leading-[1.47] text-[#1C1C1E]">
              <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#5B3DF5]" />
              {t}
            </li>
          ))}
        </ul>
      </div>

      <footer className="flex gap-2 border-t border-black/[0.06] pt-5 text-[12px] leading-snug text-[#8E8E93]">
        <ShieldCheck className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <p>For practice only. Don&apos;t use Placed or any AI tool during a real video interview or online test: firms treat it as misconduct, and some (Barclays) ban it outright. Question reports come from student accounts and can be out of date.</p>
      </footer>
    </section>
  );
}

function Stories({ stories, bankEmpty }: { stories: StorySuggestion[]; bankEmpty: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      <SectionTitle icon={BookOpenText}>Your STAR stories</SectionTitle>
      {stories.length > 0 ? (
        <>
          <p className="text-[14px] leading-[1.43] text-[#6E6E73]">From your Experience Bank: one story per competency question. Practise each as Situation, Task, Action, Result, in about 90 seconds.</p>
          <ul className="grid gap-3 sm:grid-cols-2">
            {stories.map((s) => (
              <li key={s.questionId} className="flex flex-col gap-3 rounded-[18px] bg-gradient-to-br from-[#F4F1FF] to-[#FAF9FF] p-4 shadow-[inset_0_0_0_1px_rgba(91,61,245,0.08)]">
                <p className="flex gap-2 text-[13px] font-medium leading-snug text-[#6E6E73]">
                  <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5B3DF5]/60" aria-hidden="true" />
                  {s.question}
                </p>
                <div className="flex flex-col gap-1">
                  <p className="text-[15px] font-semibold tracking-[-0.01em] text-[#3A20C4]">{s.label}{s.dates && <span className="font-normal text-[#8E8E93]"> · {s.dates}</span>}</p>
                  {s.bullet && <p className="text-[14px] leading-[1.43] text-[#3C3C43]">&ldquo;{s.bullet}&rdquo;</p>}
                </div>
                <p className="text-[12px] leading-snug text-[#6E6E73]">
                  <span className="font-semibold text-[#3C3C43]">S/T:</span> where and why, in one sentence. <span className="font-semibold text-[#3C3C43]">A:</span> what you did, in your words. <span className="font-semibold text-[#3C3C43]">R:</span>{" "}
                  {s.hasResult ? "use the number above." : <span className="text-[#7A4100]">no number yet: add one if you can (people, £, %, time saved).</span>}
                </p>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p className="rounded-[18px] bg-[#F6F5FB] px-4 py-3.5 text-[14px] text-[#6E6E73]">
          {bankEmpty ? "Your Experience Bank is empty. " : "None of your Experience Bank entries match these questions yet. "}
          <Link href="/profile/bank" className="font-semibold text-[#5B3DF5] hover:underline">Add experiences</Link> (part-time jobs, societies, school roles all count) to get story suggestions.
        </p>
      )}
    </div>
  );
}

function Bank({ questions, reported, firm }: { questions: SpringQuestion[]; reported: number[]; firm: string }) {
  const reduce = useReducedMotion();
  const [group, setGroup] = useState<SpringGroup>("motivation");
  const [open, setOpen] = useState<number | null>(null);
  const qs = questions.filter((q) => q.group === group);

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle icon={MessagesSquare}>The spring week question bank</SectionTitle>
      <LayoutGroup id="spring-groups">
        <div role="tablist" aria-label="Question type" className="-mx-1 flex overflow-x-auto px-1 [scrollbar-width:none]">
          <div className="flex min-w-max gap-0.5 rounded-[11px] bg-[#EEEEF3] p-[3px]">
            {SPRING_GROUPS.map(({ key, label }) => {
              const on = group === key;
              const n = questions.filter((q) => q.group === key).length;
              return (
                <button key={key} type="button" role="tab" aria-selected={on} onClick={() => { setGroup(key); setOpen(null); }}
                  className={`relative min-h-9 rounded-[8px] px-3.5 text-[13px] font-semibold transition-colors ${on ? "text-[#1C1C1E]" : "text-[#6E6E73] hover:text-[#3C3C43]"}`}>
                  {on && <motion.span layoutId="spring-thumb" transition={reduce ? { duration: 0 } : SPRING} className="absolute inset-0 rounded-[8px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)]" />}
                  <span className="relative z-10">{label} <span className="tabular-nums text-[#8E8E93]">{n}</span></span>
                </button>
              );
            })}
          </div>
        </div>
      </LayoutGroup>
      <ul className="overflow-hidden rounded-[18px] bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07)]">
        {qs.map((q) => {
          const on = open === q.id;
          return (
            <li key={q.id} className="relative [&+&]:before:absolute [&+&]:before:left-4 [&+&]:before:right-0 [&+&]:before:top-0 [&+&]:before:h-px [&+&]:before:bg-black/[0.06]">
              <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : q.id)}
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-black/[0.02] active:bg-black/[0.04]">
                <span className="flex-1 text-[15px] font-medium leading-[1.4] tracking-[-0.01em] text-[#1C1C1E]">{q.text}</span>
                <span className="flex shrink-0 items-center gap-2 pt-0.5">
                  {reported.includes(q.id) && <span className="rounded-full bg-[#E3F6EE] px-2 py-0.5 text-[11px] font-semibold text-[#0B6B49]" title={`Students report ${firm} asking this`}>Reported at {firm}</span>}
                  <motion.span animate={{ rotate: on ? 180 : 0 }} transition={reduce ? { duration: 0 } : SPRING} className="text-[#C7C7CC]">
                    <ChevronDown className="h-4 w-4" strokeWidth={2.5} aria-hidden="true" />
                  </motion.span>
                </span>
              </button>
              <AnimatePresence initial={false}>
                {on && (
                  <motion.div
                    initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }}
                    exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                    transition={reduce ? { duration: 0.15 } : SPRING}
                    className="overflow-hidden"
                  >
                    <div className="flex flex-col gap-3 px-4 pb-4">
                      <Detail label="Why they ask">{q.whyTheyAsk}</Detail>
                      <Detail label="How to prepare">{q.prepTip}</Detail>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-[12px] bg-[#F6F5FB] px-3.5 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8E8E93]">{label}</p>
      <p className="text-[14px] leading-[1.43] text-[#3C3C43]">{children}</p>
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>; children: React.ReactNode }) {
  return (
    <h3 className="flex items-center gap-2 text-[17px] font-semibold tracking-[-0.015em] text-[#1C1C1E]">
      <Icon className="h-[18px] w-[18px] text-[#5B3DF5]" aria-hidden={true} />
      {children}
    </h3>
  );
}
