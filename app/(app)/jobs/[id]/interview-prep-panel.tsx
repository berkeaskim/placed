"use client";
import { useState } from "react";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "motion/react";
import { BookOpenText, ChevronDown, ClipboardCheck, ExternalLink, Lightbulb, MessagesSquare, Quote, Route, ShieldAlert, Sparkles } from "lucide-react";
import { AgentSteps, useAgentSteps } from "@/components/agent/agent-steps";
import { AiWrittenTag } from "@/components/ai-written-tag";
import type { PrepView } from "@/lib/interview-prep/service";
import { THEME_LABELS, type BankTheme, type TrackBank } from "@/lib/interview-prep/banks";

type State = { status: "idle" } | { status: "loading" } | { status: "error"; message: string; bank?: TrackBank | null } | { status: "ready"; p: PrepView };
type Cat = (typeof CATS)[number][0];
const CATS = [["all", "All"], ["behavioural", "Behavioural"], ["technical", "Technical"], ["motivational", "Motivation"], ["case", "Case"]] as const;
// Real stages of getInterviewPrep: grounded web search, structuring with sources, CV story match.
const STEPS = ["Searching Reddit, Glassdoor and forums", "Reading what candidates reported", "Matching questions to your CV"] as const;
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

// Critically damped by default; nothing here is thrown, so nothing overshoots.
const SPRING = { type: "spring", bounce: 0, duration: 0.4 } as const;
const PRESS = "transition-transform duration-100 ease-out active:scale-[0.97]";

/** Interview prep for an applied job: process, reported vs likely questions with sources, and CV stories. Built on click. */
export function InterviewPrepPanel({ jobId, company, hasCv }: { jobId: string; company: string; hasCv: boolean }) {
  const [state, setState] = useState<State>({ status: "idle" });
  const { index, finishing } = useAgentSteps(STEPS.length, state.status === "loading", { stepMs: 15000 });

  const run = async () => {
    setState({ status: "loading" });
    try {
      // A route, not a server action: a ~40 s first build must not queue the page's other actions behind it.
      const res = await fetch(`/api/interview-prep/${encodeURIComponent(jobId)}`, { method: "POST", cache: "no-store" });
      const r = (await res.json()) as PrepView | { error: string; bank?: TrackBank | null };
      setState("error" in r ? { status: "error", message: r.error, bank: r.bank } : { status: "ready", p: r });
    } catch {
      setState({ status: "error", message: "We couldn't build your interview prep right now. Try again in a moment." });
    }
  };

  const ready = state.status === "ready" && !finishing;

  return (
    <section id="prep" aria-label="Interview prep" className="relative flex scroll-mt-6 flex-col gap-6 overflow-hidden rounded-[24px] border border-black/[0.06] bg-white p-5 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_24px_-12px_rgba(31,20,90,0.12)] sm:p-7">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5B3DF5]">{company}</p>
          <h2 className="text-[26px] font-bold leading-[1.1] tracking-[-0.022em] text-[#1C1C1E]">Interview prep</h2>
        </div>
        {ready && <AiWrittenTag />}
      </header>

      {state.status === "idle" && <Intro company={company} onRun={run} />}

      {(state.status === "loading" || (finishing && state.status === "ready")) && (
        <div className="rounded-[18px] bg-[#F6F5FB] p-4 sm:p-5">
          <AgentSteps steps={STEPS} index={index} label="Interview prep agent" />
        </div>
      )}

      {state.status === "error" && (
        <div className="flex flex-col gap-3 rounded-[18px] bg-[#FFF4E5] p-4 text-[#7A4100]" role="alert">
          <p className="text-[15px] font-semibold leading-snug">{state.message}</p>
          <button type="button" onClick={run} className={`min-h-11 self-start rounded-full bg-white px-5 text-[15px] font-semibold text-[#7A4100] shadow-[0_0_0_1px_rgba(122,65,0,0.2)] ${PRESS}`}>Try again</button>
        </div>
      )}
      {state.status === "error" && state.bank && <PracticeBank bank={state.bank} />}

      {ready && <Pack p={state.p} company={company} hasCv={hasCv} />}
    </section>
  );
}

function Intro({ company, onRun }: { company: string; onRun: () => void }) {
  const items = [
    { icon: Route, title: "The process", body: `Every stage of ${company}'s hiring, in order.` },
    { icon: MessagesSquare, title: "Real questions", body: "What candidates reported, with the source." },
    { icon: BookOpenText, title: "Your stories", body: "Which parts of your CV answer them best." },
  ];
  return (
    <div className="flex flex-col gap-6">
      <p className="max-w-[60ch] text-[17px] leading-[1.47] tracking-[-0.01em] text-[#3C3C43]">
        See what candidates say {company} asked for roles like this on Reddit, Glassdoor and student forums, and which of your experiences answer it.
      </p>
      <ul className="grid gap-3 sm:grid-cols-3">
        {items.map(({ icon: Icon, title, body }) => (
          <li key={title} className="flex flex-col gap-2 rounded-[18px] bg-[#F6F5FB] p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-[10px] bg-white text-[#5B3DF5] shadow-[0_1px_2px_rgba(0,0,0,0.06)]">
              <Icon className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden="true" />
            </span>
            <p className="text-[15px] font-semibold tracking-[-0.01em] text-[#1C1C1E]">{title}</p>
            <p className="text-[13px] leading-[1.38] text-[#6E6E73]">{body}</p>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="button" onClick={onRun} className={`inline-flex min-h-12 items-center gap-2 rounded-full bg-[#5B3DF5] px-6 text-[17px] font-semibold tracking-[-0.01em] text-white shadow-[0_6px_16px_-6px_rgba(91,61,245,0.6)] hover:bg-[#4E31E6] ${PRESS}`}>
          <Sparkles className="h-[18px] w-[18px]" aria-hidden="true" />
          Prep for this interview
        </button>
        <p className="text-[13px] text-[#8E8E93]">About a minute the first time, instant after that.</p>
      </div>
    </div>
  );
}

function Pack({ p, company, hasCv }: { p: PrepView; company: string; hasCv: boolean }) {
  const reduce = useReducedMotion();
  const reported = p.pack.questions.filter((q) => q.reported).length;
  const stats = [
    { value: p.pack.questions.length, label: "Questions" },
    { value: reported, label: "Reported" },
    { value: p.stories.length, label: "Your stories" },
    { value: p.sources.length, label: "Sources" },
  ];
  // Sections settle in one after another, rising a few pixels: a gentle arrival, not a performance.
  const enter = (i: number) => reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.2 } }
    : { initial: { opacity: 0, y: 8 }, animate: { opacity: 1, y: 0 }, transition: { ...SPRING, delay: i * 0.06 } };

  return (
    <div className="flex flex-col gap-8">
      <motion.dl {...enter(0)} className="grid grid-cols-2 overflow-hidden rounded-[18px] bg-[#F6F5FB] sm:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.label} className={`flex flex-col gap-0.5 px-4 py-3.5 ${i % 2 ? "border-l border-black/[0.06]" : ""} ${i >= 2 ? "border-t border-black/[0.06] sm:border-t-0" : ""} ${i === 2 ? "sm:border-l" : ""}`}>
            <dt className="order-2 text-[12px] font-medium text-[#6E6E73]">{s.label}</dt>
            <dd className="order-1 text-[28px] font-semibold leading-none tracking-[-0.025em] tabular-nums text-[#1C1C1E]">{s.value}</dd>
          </div>
        ))}
      </motion.dl>

      {!p.grounded && (
        <p className="rounded-[14px] bg-[#FFF4E5] px-4 py-3 text-[14px] leading-snug text-[#7A4100]" role="note">
          <span className="font-semibold">Few public reports for this role.</span> These are the questions {company} is likely to ask based on the posting, not ones candidates reported.
        </p>
      )}

      {p.pack.process.length > 0 && (
        <motion.div {...enter(1)} className="flex flex-col gap-3">
          <SectionTitle icon={Route}>The process</SectionTitle>
          <ol className="relative flex flex-col">
            {p.pack.process.map((s, i, all) => (
              <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
                {i < all.length - 1 && <span aria-hidden="true" className="absolute left-[13px] top-7 bottom-0 w-px bg-gradient-to-b from-[#5B3DF5]/40 to-[#5B3DF5]/10" />}
                <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#5B3DF5] text-[13px] font-semibold tabular-nums text-white shadow-[0_0_0_4px_#fff]">{i + 1}</span>
                <div className="flex flex-col gap-0.5 pt-[3px]">
                  <p className="text-[15px] font-semibold tracking-[-0.01em] text-[#1C1C1E]">{s.stage}</p>
                  {s.note && <p className="text-[14px] leading-[1.43] text-[#6E6E73]">{s.note}</p>}
                </div>
              </li>
            ))}
          </ol>
        </motion.div>
      )}

      <motion.div {...enter(2)}><Questions p={p} /></motion.div>

      {p.bank && <motion.div {...enter(2)}><PracticeBank bank={p.bank} /></motion.div>}

      <motion.div {...enter(3)} className="flex flex-col gap-3">
        <SectionTitle icon={BookOpenText}>Your stories</SectionTitle>
        {p.stories.length > 0 ? (
          <ul className="grid gap-3 sm:grid-cols-2">
            {p.stories.map((s, i) => (
              <li key={i} className="flex flex-col gap-3 rounded-[18px] bg-gradient-to-br from-[#F4F1FF] to-[#FAF9FF] p-4 shadow-[inset_0_0_0_1px_rgba(91,61,245,0.08)]">
                <p className="flex gap-2 text-[13px] font-medium leading-snug text-[#6E6E73]">
                  <Quote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5B3DF5]/60" aria-hidden="true" />
                  {s.question}
                </p>
                <div className="flex flex-col gap-1">
                  <p className="text-[15px] font-semibold tracking-[-0.01em] text-[#3A20C4]">{s.story}</p>
                  <p className="text-[14px] leading-[1.43] text-[#3C3C43]">{s.angle}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-[18px] bg-[#F6F5FB] px-4 py-3.5 text-[14px] text-[#6E6E73]">{hasCv ? "We couldn't match stories from your CV this time." : "Upload your CV to see which of your experiences answer these questions."}</p>
        )}
      </motion.div>

      {p.pack.tips.length > 0 && (
        <motion.div {...enter(4)} className="flex flex-col gap-3">
          <SectionTitle icon={Lightbulb}>Tips for {company}</SectionTitle>
          <ul className="flex flex-col divide-y divide-black/[0.06] overflow-hidden rounded-[18px] bg-[#F6F5FB]">
            {p.pack.tips.map((t, i) => (
              <li key={i} className="flex gap-3 px-4 py-3 text-[15px] leading-[1.47] text-[#1C1C1E]">
                <span aria-hidden="true" className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#5B3DF5]" />
                {t}
              </li>
            ))}
          </ul>
        </motion.div>
      )}

      <motion.footer {...enter(5)} className="flex flex-col gap-3 border-t border-black/[0.06] pt-5">
        {p.sources.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[12px] font-semibold uppercase tracking-[0.06em] text-[#8E8E93]">Sources</span>
            {p.sources.map((s) => (
              <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer nofollow"
                className={`inline-flex min-h-8 items-center gap-1 rounded-full bg-[#F2F2F7] px-3 text-[13px] font-medium text-[#3C3C43] hover:bg-[#E8E8ED] ${PRESS}`}>
                {host(s.url)}
                <ExternalLink className="h-3 w-3 text-[#8E8E93]" aria-hidden="true" />
              </a>
            ))}
          </div>
        )}
        <p className="text-[12px] leading-snug text-[#8E8E93]">Built {new Date(p.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} from public posts. Reports can be out of date: use them to prepare, not as a script.</p>
      </motion.footer>
    </div>
  );
}

function Questions({ p }: { p: PrepView }) {
  const reduce = useReducedMotion();
  const [cat, setCat] = useState<Cat>("all");
  const [open, setOpen] = useState<number | null>(null);
  const cats = CATS.filter(([k]) => k === "all" || p.pack.questions.some((q) => q.category === k));
  const qs = p.pack.questions.filter((q) => cat === "all" || q.category === cat);

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle icon={MessagesSquare}>Questions to prepare</SectionTitle>

      {/* iOS-style segmented control: one thumb that slides to the chosen segment. */}
      <LayoutGroup id="prep-cats">
        <div role="tablist" aria-label="Question type" className="-mx-1 flex overflow-x-auto px-1 [scrollbar-width:none]">
          <div className="flex min-w-max gap-0.5 rounded-[11px] bg-[#EEEEF3] p-[3px]">
            {cats.map(([k, label]) => {
              const on = cat === k;
              const n = k === "all" ? p.pack.questions.length : p.pack.questions.filter((q) => q.category === k).length;
              return (
                <button key={k} type="button" role="tab" aria-selected={on} onClick={() => { setCat(k); setOpen(null); }}
                  className={`relative min-h-9 rounded-[8px] px-3.5 text-[13px] font-semibold transition-colors ${on ? "text-[#1C1C1E]" : "text-[#6E6E73] hover:text-[#3C3C43]"}`}>
                  {on && <motion.span layoutId="thumb" transition={reduce ? { duration: 0 } : SPRING} className="absolute inset-0 rounded-[8px] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12),0_0_0_0.5px_rgba(0,0,0,0.04)]" />}
                  <span className="relative z-10">{label} <span className="tabular-nums text-[#8E8E93]">{n}</span></span>
                </button>
              );
            })}
          </div>
        </div>
      </LayoutGroup>

      {/* Inset grouped list, like Settings: hairline separators, the row expands in place. */}
      <ul className="overflow-hidden rounded-[18px] bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07)]">
        {qs.map((q, i) => {
          const on = open === i;
          return (
            <li key={`${cat}-${i}`} className="relative [&+&]:before:absolute [&+&]:before:left-4 [&+&]:before:right-0 [&+&]:before:top-0 [&+&]:before:h-px [&+&]:before:bg-black/[0.06]">
              <button type="button" aria-expanded={on} onClick={() => setOpen(on ? null : i)}
                className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-black/[0.02] active:bg-black/[0.04]">
                <span className="flex-1 text-[15px] font-medium leading-[1.4] tracking-[-0.01em] text-[#1C1C1E]">{q.question}</span>
                <span className="flex shrink-0 items-center gap-2 pt-0.5">
                  {q.reported
                    ? <span className="rounded-full bg-[#E3F6EE] px-2 py-0.5 text-[11px] font-semibold text-[#0B6B49]">Reported</span>
                    : <span className="rounded-full bg-[#F2F2F7] px-2 py-0.5 text-[11px] font-semibold text-[#6E6E73]">Likely</span>}
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
                      {q.sourceUrl && (
                        <a href={q.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 self-start text-[13px] font-semibold text-[#5B3DF5] hover:underline">
                          Reported on {host(q.sourceUrl)}
                          <ExternalLink className="h-3 w-3" aria-hidden="true" />
                        </a>
                      )}
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

/** The curated placement bank: practice-only notice, format presets, questions by theme and the coach's rubric. */
function PracticeBank({ bank }: { bank: TrackBank }) {
  const themes = [...new Set(bank.questions.map((q) => q.theme))] as BankTheme[];
  return (
    <section aria-label="Placement practice bank" className="flex flex-col gap-3">
      <SectionTitle icon={ClipboardCheck}>Placement practice bank <span className="text-[13px] font-medium tabular-nums text-[#8E8E93]">{bank.questions.length}</span></SectionTitle>
      <p role="note" className={`flex gap-2 rounded-[14px] px-4 py-3 text-[14px] leading-snug ${bank.coachOnly ? "bg-[#FFF4E5] text-[#7A4100]" : "bg-[#F6F5FB] text-[#3C3C43]"}`}>
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{bank.coachOnly && <span className="font-semibold">Coach-only. </span>}{bank.practiceNotice}</span>
      </p>
      <ul className="flex flex-col gap-1 text-[14px] leading-snug text-[#3C3C43]">
        {bank.presets.map((p) => <li key={p} className="flex gap-2"><span aria-hidden="true" className="mt-[8px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#5B3DF5]" />{p}</li>)}
      </ul>
      <div className="flex flex-col overflow-hidden rounded-[18px] bg-white shadow-[inset_0_0_0_1px_rgba(0,0,0,0.07)]">
        {themes.map((t) => {
          const qs = bank.questions.filter((q) => q.theme === t);
          return (
            <details key={t} className="group border-black/[0.06] [&+&]:border-t">
              <summary className="flex min-h-11 cursor-pointer items-center justify-between px-4 py-3 text-[15px] font-semibold text-[#1C1C1E]">
                <span>{THEME_LABELS[t]}</span>
                <span className="text-[13px] tabular-nums text-[#8E8E93]">{qs.length}</span>
              </summary>
              <ol className="flex list-decimal flex-col gap-2 pb-4 pl-9 pr-4 text-[14px] leading-[1.43] text-[#3C3C43]">
                {qs.map((q) => <li key={q.question}>{q.question}</li>)}
              </ol>
            </details>
          );
        })}
      </div>
      <details className="rounded-[18px] bg-[#F6F5FB] px-4">
        <summary className="flex min-h-11 cursor-pointer items-center text-[14px] font-semibold text-[#3A20C4]">How to judge your own answers</summary>
        <ul className="flex flex-col gap-1.5 pb-4 text-[14px] leading-snug text-[#3C3C43]">
          {bank.rubric.map((r) => <li key={r}>{r}</li>)}
        </ul>
      </details>
    </section>
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
