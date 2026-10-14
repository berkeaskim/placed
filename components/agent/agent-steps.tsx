"use client";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";

/**
 * Drives a step list for one server action that has no streaming. While `active`, it walks forward every
 * `stepMs` and holds on the last step (never claims to be done early). When `active` turns false it
 * fast-forwards the remaining steps so fixture mode still reads as work, then reports `finishing: false`.
 * Render the steps while `active || finishing`, and the result after.
 */
export function useAgentSteps(count: number, active: boolean, { stepMs = 1600, tickMs = 160 } = {}) {
  const reduce = useReducedMotion();
  const [run, setRun] = useState({ active, index: 0, finishing: false });
  // Adjust state while rendering when `active` flips (no effect round-trip).
  if (run.active !== active) {
    setRun(active ? { active, index: 0, finishing: false } : { active, index: reduce ? count : run.index, finishing: !reduce });
  }

  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setRun((r) => ({ ...r, index: Math.min(r.index + 1, count - 1) })), stepMs);
    return () => clearInterval(t);
  }, [active, count, stepMs]);

  useEffect(() => {
    if (!run.finishing) return;
    // Tick the remaining steps off, hold one beat on "all done", then hand over to the result.
    const t = setInterval(() => setRun((r) => (r.index >= count ? { ...r, finishing: false } : { ...r, index: r.index + 1 })), tickMs);
    return () => clearInterval(t);
  }, [run.finishing, count, tickMs]);

  return { index: run.index, finishing: run.finishing };
}

/** The pulsing "agent is live" dot. */
export function AgentDot({ className = "" }: { className?: string }) {
  return (
    <span aria-hidden="true" className={`relative inline-flex h-2 w-2 ${className}`}>
      <span className="agent-motion-ping absolute inset-0 rounded-full bg-[#5B3DF5] [animation:agent-ping_1.4s_cubic-bezier(0,0,0.2,1)_infinite]" />
      <span className="relative inline-flex h-2 w-2 rounded-full bg-[#5B3DF5]" />
    </span>
  );
}

function StepIcon({ state }: { state: "done" | "active" | "todo" }) {
  if (state === "done") {
    return (
      <motion.span
        initial={{ scale: 0.4, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", bounce: 0, duration: 0.35 }}
        className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#5B3DF5] text-white"
      >
        <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
          <motion.path
            d="M3.5 8.5l3 3 6-7"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.3, ease: "easeOut", delay: 0.05 }}
          />
        </svg>
      </motion.span>
    );
  }
  if (state === "active") {
    return (
      <span className="relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[#5B3DF5]/30">
        <span className="agent-motion-ping absolute inset-0 rounded-full border-2 border-[#5B3DF5] [animation:agent-ping_1.6s_cubic-bezier(0,0,0.2,1)_infinite]" />
        <span className="h-2 w-2 rounded-full bg-[#5B3DF5]" />
      </span>
    );
  }
  return <span className="flex h-5 w-5 shrink-0 items-center justify-center"><span className="h-2 w-2 rounded-full bg-[#D4D4E0]" /></span>;
}

/**
 * A vertical checklist of what the agent is doing right now. Steps must describe real stages of the
 * server work (see the caller), in order. `label` names the agent's job for screen readers and the header.
 */
export function AgentSteps({ steps, index, label, className = "" }: { steps: readonly string[]; index: number; label: string; className?: string }) {
  const current = steps[Math.min(index, steps.length - 1)];
  return (
    <div className={`flex flex-col gap-3 rounded-2xl border border-[#E6E6EF] bg-[#F8F7FF] p-4 ${className}`} role="status" aria-live="polite" aria-label={label}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-[#3A20C4]">
        <AgentDot />
        <span>{label}</span>
      </div>
      <ol className="relative flex flex-col gap-2.5">
        <span aria-hidden="true" className="absolute top-2.5 bottom-2.5 left-[9px] w-0.5 rounded-full bg-[#E6E6EF]" />
        <motion.span
          aria-hidden="true"
          className="absolute top-2.5 bottom-2.5 left-[9px] w-0.5 origin-top rounded-full bg-[#5B3DF5]"
          initial={false}
          animate={{ scaleY: Math.min(index, steps.length - 1) / Math.max(steps.length - 1, 1) }}
          transition={{ type: "spring", bounce: 0, duration: 0.5 }}
        />
        {steps.map((s, i) => {
          const state = i < index ? "done" : i === index ? "active" : "todo";
          return (
            <li key={s} className="relative flex items-center gap-3 text-sm">
              <StepIcon state={state} />
              <span className={state === "active" ? "agent-shimmer font-semibold" : state === "done" ? "text-foreground" : "text-muted-foreground"}>{s}</span>
            </li>
          );
        })}
      </ol>
      <span className="sr-only">{current}</span>
    </div>
  );
}

/** Single-line status for small waits ("Rescoring your CV…"): live dot plus shimmering text. */
export function AgentStatus({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <span role="status" aria-live="polite" className={`inline-flex items-center gap-2 text-sm font-semibold ${className}`}>
      <AgentDot />
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={typeof children === "string" ? children : undefined}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.2 }}
          className="agent-shimmer"
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
