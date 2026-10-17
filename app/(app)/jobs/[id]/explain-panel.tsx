"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { motion, useReducedMotion, type Variants } from "motion/react";
import { AgentSteps, useAgentSteps } from "@/components/agent/agent-steps";
import { CountUp, Stagger, StaggerItem } from "@/components/agent/reveal";
import { AiWrittenTag } from "@/components/ai-written-tag";
import { mustHavesLabel, mustHavesMet, type RequirementRow } from "@/lib/scoring/requirements";
import type { ExplanationResult, ExplanationView } from "./actions";

/** Not a server action call: those run one at a time, and this one can take a while on first open (api/explain). */
async function fetchExplanation(jobId: string, signal?: AbortSignal): Promise<ExplanationResult> {
  const res = await fetch(`/api/explain/${encodeURIComponent(jobId)}`, { signal, cache: "no-store" });
  if (!res.ok && res.status !== 401) throw new Error(`explain ${res.status}`);
  return (await res.json()) as ExplanationResult;
}

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; e: ExplanationView };

const MATCH_LABEL: Record<RequirementRow["match"], string> = { strong: "Strong", partial: "Partial", missing: "Missing" };
const MATCH_TONE: Record<RequirementRow["match"], string> = {
  strong: "bg-[#E3F6EE] text-[#0B6B49]", partial: "bg-[#FFF1DC] text-[#7A4100]", missing: "bg-[#FDECEA] text-[#B42318]",
};
const IMPORTANCE_LABEL: Record<RequirementRow["importance"], string> = {
  critical: "Critical", high: "High", meaningful: "Meaningful", preferred: "Preferred", low_signal: "Low signal",
};

// Pops in just after its row arrives, so the verdicts land one by one down the table.
const pop: Variants = { hidden: { scale: 0.6, opacity: 0 }, show: { scale: 1, opacity: 1, transition: { type: "spring", bounce: 0, duration: 0.35, delay: 0.12 } } };
const popReduced: Variants = { hidden: { opacity: 0 }, show: { opacity: 1 } };

function MatchIcon({ match }: { match: RequirementRow["match"] }) {
  const reduce = useReducedMotion();
  const d = match === "strong" ? "M5 12.5l4.5 4.5L19 7.5" : match === "partial" ? "M6 12h12" : "M7 7l10 10M17 7L7 17";
  return (
    <motion.span variants={reduce ? popReduced : pop} className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${MATCH_TONE[match]}`} aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
    </motion.span>
  );
}

// Real stages of getExplanation: load the posting's requirements (or reuse a cached explanation), match them against
// the CV (keyword coverage + one AI call), and write why-you-fit / gaps in that same call.
const STEPS = ["Reading the posting's requirements", "Matching each one against your CV", "Writing why you fit and how to close gaps"] as const;

/**
 * Right-hand panel: "Must-haves met: X/Y" headline (B10), then `children` (the server-rendered Findability line),
 * then the requirement table, why you fit, and what's missing / how to close it. Loaded lazily on first open.
 */
export function ExplainPanel({ jobId, children }: { jobId: string; children?: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    try {
      const r = await fetchExplanation(jobId);
      setState("error" in r ? { status: "error", message: r.error } : { status: "ready", e: r });
    } catch {
      setState({ status: "error", message: "We couldn't build the explanation right now. Try again in a moment." });
    }
  }, [jobId]);

  useEffect(() => {
    let live = true;
    const ctrl = new AbortController();
    fetchExplanation(jobId, ctrl.signal)
      .then((r) => { if (live) setState("error" in r ? { status: "error", message: r.error } : { status: "ready", e: r }); })
      .catch(() => { if (live) setState({ status: "error", message: "We couldn't build the explanation right now. Try again in a moment." }); });
    return () => { live = false; ctrl.abort(); };
  }, [jobId]);

  const { index, finishing } = useAgentSteps(STEPS.length, state.status === "loading", { stepMs: 2200 });
  // Only a real result fast-forwards the checklist; an error replaces it straight away.
  if (state.status === "loading" || (finishing && state.status === "ready")) {
    return <><AgentSteps steps={STEPS} index={index} label="Fit agent" />{children}</>;
  }
  if (state.status === "error") {
    return (
      <>
        <div className="flex flex-col gap-2 rounded-xl bg-[#FFF1DC] p-3 text-sm text-[#7A4100]" role="alert">
          <p className="font-semibold">{state.message}</p>
          <button type="button" onClick={() => { setState({ status: "loading" }); void load(); }}
            className="min-h-11 self-start rounded-xl border-2 border-[#7A4100]/30 bg-white px-4 font-bold text-[#7A4100]">
            Try again
          </button>
        </div>
        {children}
      </>
    );
  }

  const { e } = state;
  const must = mustHavesMet(e.rows);
  return (
    <Stagger className="flex flex-col gap-4">
      <StaggerItem className="flex flex-col gap-1">
        <h2 className="text-xl font-extrabold tracking-tight">
          {must.total === 0 ? mustHavesLabel(must) : (
            <><span className="sr-only">{mustHavesLabel(must)}</span><span aria-hidden="true">Must-haves met: <CountUp to={must.met} duration={0.8} />/{must.total}</span></>
          )}
        </h2>
        {must.total > 0 && (
          <p className="text-xs text-muted-foreground">
            Counts the posting&apos;s critical and high requirements your CV clearly shows.
            {must.partial > 0 && ` ${must.partial} more ${must.partial === 1 ? "is" : "are"} a partial match, which doesn't count as met.`}
          </p>
        )}
      </StaggerItem>
      {children}

      {e.aiOff ? (
        <p className="rounded-xl bg-[#F6F6FA] p-3 text-xs text-[#4A4A57]" role="status">
          AI isn&apos;t set up, so this is an automatic estimate from keyword matching.{" "}
          <Link href="/settings/ai" className="font-bold underline">Set up AI</Link> for the full explanation.
        </p>
      ) : e.aiFailed && (
        <p className="rounded-xl bg-[#F6F6FA] p-3 text-xs text-[#4A4A57]" role="status">
          The AI explanation is unavailable right now, so this is an automatic estimate from keyword matching.
          Open the role again later for the full explanation.
        </p>
      )}

      {e.rows.length > 0 && (
        <section aria-labelledby="req-table">
          <h3 id="req-table" className="mb-2 font-bold">Requirements</h3>
          <ul className="flex flex-col gap-2.5 text-sm">
            {e.rows.map((r, i) => (
              <StaggerItem as="li" key={`${i}-${r.text}`} className="flex gap-2.5">
                <MatchIcon match={r.match} />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span>
                    <span className="sr-only">{MATCH_LABEL[r.match]}: </span>{r.text}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {IMPORTANCE_LABEL[r.importance]} · {MATCH_LABEL[r.match]}{r.evidenceTier === "inferred" ? " · not stated in the posting" : ""}
                  </span>
                  {r.cvEvidence && <span className="mt-0.5 text-xs italic text-[#4A4A57]">From your CV: &ldquo;{r.cvEvidence}&rdquo;</span>}
                </div>
              </StaggerItem>
            ))}
          </ul>
        </section>
      )}

      {e.whyFit.length > 0 && (
        <StaggerItem>
          <section aria-labelledby="why-fit">
            <h3 id="why-fit" className="mb-1 flex items-center gap-2 font-bold">Why you fit{e.aiWritten && <AiWrittenTag />}</h3>
            <ul className="list-disc pl-5 text-sm">{e.whyFit.map((w, i) => <li key={i}>{w}</li>)}</ul>
          </section>
        </StaggerItem>
      )}

      {e.gaps.length > 0 && (
        <section aria-labelledby="gaps">
          <h3 id="gaps" className="mb-2 flex flex-wrap items-center gap-2 font-bold">What&apos;s missing, and how to close it{e.aiWritten && <AiWrittenTag />}</h3>
          <ul className="flex flex-col gap-2 text-sm">
            {e.gaps.map((g, i) => (
              <StaggerItem as="li" key={`${i}-${g.requirement}`} className="flex flex-col gap-0.5 rounded-xl bg-[#F6F6FA] p-3">
                <span className="font-bold">
                  {g.requirement}
                  {g.blocking && <span className="ml-1.5 text-xs font-bold text-[#B42318]">· must-have</span>}
                </span>
                {g.adjacentExperience && <span className="text-muted-foreground">Closest you have: {g.adjacentExperience}</span>}
                <span>{g.howToClose}</span>
              </StaggerItem>
            ))}
          </ul>
        </section>
      )}
    </Stagger>
  );
}
