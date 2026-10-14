"use client";
import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "motion/react";
import { pct, type Counts } from "@/lib/tailor/view";
import { ArrowIcon } from "./icons";

function CountUp({ to }: { to: number | null }) {
  const reduce = useReducedMotion();
  const [v, setV] = useState(0);
  const from = useRef(0);
  useEffect(() => {
    if (to === null || reduce) return;
    const c = animate(from.current, to, { duration: 1.1, ease: [0.16, 1, 0.3, 1], onUpdate: (x) => { from.current = x; setV(x); } });
    return () => c.stop();
  }, [to, reduce]);
  return <>{pct(to === null ? null : reduce ? to : v)}</>;
}

/**
 * Spec §8.1: "Keyword coverage 45% → 81%" (animated) plus must-have / nice-to-have keyword counts, labelled Findability.
 * The counts come from the same rows as "What we tailored for" (controller ruling, fix round 1).
 */
export function CoverageHero({ before, after, must, nice }: { before: number | null; after: number | null; must: Counts; nice: Counts }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-[#F4F1FF] p-4" aria-label="Findability before and after tailoring">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-bold text-[#3A20C4]">Findability</span>
        <span className="text-xs text-muted-foreground">Keyword coverage for this posting</span>
      </div>
      <div className="flex items-baseline gap-3">
        <span className="num-quest text-2xl text-muted-foreground" aria-label={`Before: ${pct(before)}`}>{pct(before)}</span>
        <ArrowIcon className="self-center text-[#5B3DF5]" size={20} />
        <span className="num-quest text-4xl text-[#5B3DF5]" aria-label={`After: ${pct(after)}`}><CountUp to={after} /></span>
      </div>
      <dl className="grid grid-cols-2 gap-2 text-sm">
        {([["Must-have keywords found", must], ["Nice-to-have keywords found", nice]] as const).map(([label, c]) => (
          <div key={label} className="rounded-xl bg-white px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="num-quest text-lg">{c.total === 0 ? "None stated" : `${c.matched}/${c.total}`}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
