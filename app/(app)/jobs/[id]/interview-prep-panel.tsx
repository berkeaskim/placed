"use client";
import { useState } from "react";
import { AgentSteps, useAgentSteps } from "@/components/agent/agent-steps";
import { AiWrittenTag } from "@/components/ai-written-tag";
import type { PrepView } from "@/lib/interview-prep/service";

type State = { status: "idle" } | { status: "loading" } | { status: "error"; message: string } | { status: "ready"; p: PrepView };
const CATS = [["all", "All"], ["behavioural", "Behavioural"], ["technical", "Technical"], ["motivational", "Motivation"], ["case", "Case"]] as const;
// Real stages of getInterviewPrep: grounded web search, structuring with sources, CV story match.
const STEPS = ["Searching Reddit, Glassdoor and forums", "Reading what candidates reported", "Matching questions to your CV"] as const;
const host = (u: string) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch { return u; } };

/** Interview prep for an applied job: process, reported vs likely questions with sources, and CV stories. Built on click. */
export function InterviewPrepPanel({ jobId, company, hasCv }: { jobId: string; company: string; hasCv: boolean }) {
  const [state, setState] = useState<State>({ status: "idle" });
  const [cat, setCat] = useState<(typeof CATS)[number][0]>("all");
  const [open, setOpen] = useState<number | null>(null);
  const { index, finishing } = useAgentSteps(STEPS.length, state.status === "loading", { stepMs: 15000 });

  const run = async () => {
    setState({ status: "loading" });
    try {
      // A route, not a server action: a ~40 s first build must not queue the page's other actions behind it.
      const res = await fetch(`/api/interview-prep/${encodeURIComponent(jobId)}`, { method: "POST", cache: "no-store" });
      const r = (await res.json()) as PrepView | { error: string };
      setState("error" in r ? { status: "error", message: r.error } : { status: "ready", p: r });
    } catch {
      setState({ status: "error", message: "We couldn't build your interview prep right now. Try again in a moment." });
    }
  };

  return (
    <section id="prep" aria-label="Interview prep" className="flex scroll-mt-6 flex-col gap-4 rounded-[20px] border bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-extrabold tracking-tight">Interview prep</h2>
        {state.status === "ready" && !finishing && <AiWrittenTag />}
      </div>

      {state.status === "idle" && (
        <>
          <p className="text-[15px] text-[#4A4A57]">See what candidates say {company} asked for roles like this one on Reddit, Glassdoor and student forums, with the sources, and which stories from your CV answer the likely questions.</p>
          <button type="button" onClick={run} className="min-h-11 self-start rounded-xl bg-[#5B3DF5] px-5 font-bold text-white">Prep for this interview</button>
          <p className="text-xs text-muted-foreground">The first time takes about a minute while we search. After that it opens straight away.</p>
        </>
      )}

      {(state.status === "loading" || (finishing && state.status === "ready")) && <AgentSteps steps={STEPS} index={index} label="Interview prep agent" />}

      {state.status === "error" && (
        <div className="flex flex-col gap-2 rounded-xl bg-[#FFF1DC] p-3 text-sm text-[#7A4100]" role="alert">
          <p className="font-semibold">{state.message}</p>
          <button type="button" onClick={run} className="min-h-11 self-start rounded-xl border-2 border-[#7A4100]/30 bg-white px-4 font-bold text-[#7A4100]">Try again</button>
        </div>
      )}

      {state.status === "ready" && !finishing && (() => {
        const p = state.p;
        const qs = p.pack.questions.filter((q) => cat === "all" || q.category === cat);
        return (
          <div className="flex flex-col gap-5">
            {!p.grounded && (
              <p className="rounded-xl bg-[#FFF1DC] px-3 py-2 text-sm font-semibold text-[#7A4100]" role="note">
                We found few public reports for this role, so these are the questions {company} is likely to ask, based on the posting. They are not reported by candidates.
              </p>
            )}

            {p.pack.process.length > 0 && (
              <div className="flex flex-col gap-2">
                <h3 className="text-sm font-bold">The process</h3>
                <ol className="flex flex-col gap-2">
                  {p.pack.process.map((s, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#F4F1FF] text-xs font-bold text-[#3A20C4]">{i + 1}</span>
                      <span className="text-sm"><span className="font-semibold">{s.stage}</span>{s.note && <span className="text-muted-foreground">: {s.note}</span>}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold">Questions to prepare</h3>
              <div className="flex flex-wrap gap-1.5" role="tablist">
                {CATS.filter(([k]) => k === "all" || p.pack.questions.some((q) => q.category === k)).map(([k, label]) => (
                  <button key={k} type="button" role="tab" aria-selected={cat === k} onClick={() => { setCat(k); setOpen(null); }}
                    className={`min-h-9 rounded-full px-3 text-xs font-bold ${cat === k ? "bg-[#5B3DF5] text-white" : "bg-[#EFEFF5] text-[#3F3F4C]"}`}>{label}</button>
                ))}
              </div>
              <ul className="flex flex-col gap-2">
                {qs.map((q, i) => (
                  <li key={`${cat}-${i}`} className="rounded-xl border p-3">
                    <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)} className="flex w-full items-start justify-between gap-3 text-left">
                      <span className="text-sm font-semibold">{q.question}</span>
                      {q.reported
                        ? <span className="shrink-0 rounded-full bg-[#E3F6EE] px-2 py-0.5 text-[11px] font-bold text-[#0B6B49]">Reported</span>
                        : <span className="shrink-0 rounded-full bg-[#EEEEF2] px-2 py-0.5 text-[11px] font-bold text-[#3F3F4C]">Likely</span>}
                    </button>
                    {open === i && (
                      <div className="mt-2 flex flex-col gap-1.5 text-sm">
                        <p><span className="font-semibold">Why they ask: </span>{q.whyTheyAsk}</p>
                        <p><span className="font-semibold">How to prepare: </span>{q.prepTip}</p>
                        {q.sourceUrl && <a href={q.sourceUrl} target="_blank" rel="noopener noreferrer nofollow" className="self-start text-xs font-semibold text-[#5B3DF5]">Reported on {host(q.sourceUrl)} ↗</a>}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="text-sm font-bold">Your stories</h3>
              {p.stories.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {p.stories.map((s, i) => (
                    <li key={i} className="rounded-xl bg-[#F8F7FF] p-3 text-sm">
                      <p className="font-semibold">{s.question}</p>
                      <p className="mt-1"><span className="font-semibold text-[#3A20C4]">{s.story}</span>: {s.angle}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">{hasCv ? "We couldn't match stories from your CV this time." : "Upload your CV to see which of your experiences answer these questions."}</p>
              )}
            </div>

            {p.pack.tips.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <h3 className="text-sm font-bold">Tips for {company}</h3>
                <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">{p.pack.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
              </div>
            )}

            {p.sources.length > 0 && (
              <details className="text-sm">
                <summary className="cursor-pointer font-bold">Sources ({p.sources.length})</summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {p.sources.map((s) => <li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all text-[#5B3DF5]">{host(s.url)}</a></li>)}
                </ul>
              </details>
            )}
            <p className="text-xs text-muted-foreground">Built {new Date(p.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })} from public posts. Reports can be out of date: use them to prepare, not as a script.</p>
          </div>
        );
      })()}
    </section>
  );
}
