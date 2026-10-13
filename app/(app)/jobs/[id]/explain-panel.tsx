"use client";
import { useCallback, useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { mustHavesLabel, mustHavesMet, type Explanation, type RequirementRow } from "@/lib/scoring/requirements";
import { getExplanation } from "./actions";

type State = { status: "loading" } | { status: "error"; message: string } | { status: "ready"; e: Explanation };

const MATCH_LABEL: Record<RequirementRow["match"], string> = { strong: "Strong", partial: "Partial", missing: "Missing" };
const MATCH_TONE: Record<RequirementRow["match"], string> = {
  strong: "bg-[#E3F6EE] text-[#0B6B49]", partial: "bg-[#FFF1DC] text-[#7A4100]", missing: "bg-[#FDECEA] text-[#B42318]",
};
const IMPORTANCE_LABEL: Record<RequirementRow["importance"], string> = {
  critical: "Critical", high: "High", meaningful: "Meaningful", preferred: "Preferred", low_signal: "Low signal",
};

function MatchIcon({ match }: { match: RequirementRow["match"] }) {
  const d = match === "strong" ? "M5 12.5l4.5 4.5L19 7.5" : match === "partial" ? "M6 12h12" : "M7 7l10 10M17 7L7 17";
  return (
    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${MATCH_TONE[match]}`} aria-hidden="true">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
    </span>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-2.5" role="status" aria-label="Loading how you match this role">
      <Skeleton className="h-7 w-1/2" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-5 w-5/6" />
      <Skeleton className="h-5 w-4/6" />
      <span className="text-xs text-muted-foreground">Reading the requirements against your CV…</span>
    </div>
  );
}

/**
 * Right-hand panel: "Must-haves met: X/Y" headline (B10), then `children` (the server-rendered Findability line),
 * then the requirement table, why you fit, and what's missing / how to close it. Loaded lazily on first open.
 */
export function ExplainPanel({ jobId, children }: { jobId: string; children?: React.ReactNode }) {
  const [state, setState] = useState<State>({ status: "loading" });

  const load = useCallback(async () => {
    try {
      const r = await getExplanation(jobId);
      setState("error" in r ? { status: "error", message: r.error } : { status: "ready", e: r });
    } catch {
      setState({ status: "error", message: "We couldn't build the explanation right now. Try again in a moment." });
    }
  }, [jobId]);

  useEffect(() => {
    let live = true;
    getExplanation(jobId)
      .then((r) => { if (live) setState("error" in r ? { status: "error", message: r.error } : { status: "ready", e: r }); })
      .catch(() => { if (live) setState({ status: "error", message: "We couldn't build the explanation right now. Try again in a moment." }); });
    return () => { live = false; };
  }, [jobId]);

  if (state.status === "loading") return <><LoadingState />{children}</>;
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
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-extrabold tracking-tight">{mustHavesLabel(must)}</h2>
        {must.total > 0 && (
          <p className="text-xs text-muted-foreground">
            Counts the posting&apos;s critical and high requirements your CV clearly shows.
            {must.partial > 0 && ` ${must.partial} more ${must.partial === 1 ? "is" : "are"} a partial match, which doesn't count as met.`}
          </p>
        )}
      </div>
      {children}

      {e.rows.length > 0 && (
        <section aria-labelledby="req-table">
          <h3 id="req-table" className="mb-2 font-bold">Requirements</h3>
          <ul className="flex flex-col gap-2.5 text-sm">
            {e.rows.map((r, i) => (
              <li key={`${i}-${r.text}`} className="flex gap-2.5">
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
              </li>
            ))}
          </ul>
        </section>
      )}

      {e.whyFit.length > 0 && (
        <section aria-labelledby="why-fit">
          <h3 id="why-fit" className="mb-1 font-bold">Why you fit</h3>
          <ul className="list-disc pl-5 text-sm">{e.whyFit.map((w, i) => <li key={i}>{w}</li>)}</ul>
        </section>
      )}

      {e.gaps.length > 0 && (
        <section aria-labelledby="gaps">
          <h3 id="gaps" className="mb-2 font-bold">What&apos;s missing, and how to close it</h3>
          <ul className="flex flex-col gap-2 text-sm">
            {e.gaps.map((g, i) => (
              <li key={`${i}-${g.requirement}`} className="flex flex-col gap-0.5 rounded-xl bg-[#F6F6FA] p-3">
                <span className="font-bold">
                  {g.requirement}
                  {g.blocking && <span className="ml-1.5 text-xs font-bold text-[#B42318]">· must-have</span>}
                </span>
                {g.adjacentExperience && <span className="text-muted-foreground">Closest you have: {g.adjacentExperience}</span>}
                <span>{g.howToClose}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
