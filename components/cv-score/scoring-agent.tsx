"use client";
import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AgentSteps, useAgentSteps } from "@/components/agent/agent-steps";

/** The real stages of scoreCv (lib/cv-score/run.ts), in order. */
function scoringSteps(llmRules?: number) {
  return [
    "Removing your personal details before the AI reads it",
    llmRules ? `Judging your CV against ${llmRules} recruiter rules` : "Judging your CV against recruiter rules",
    "Running the formatting checks",
    "Adding up your score",
  ] as const;
}

/**
 * Walks to the AI judge step and holds there: it is the only slow stage, and the checks and sum after it
 * take milliseconds, so the list never claims more than we know. Unmounted when the score lands.
 */
export function ScoringSteps({ llmRules }: { llmRules?: number }) {
  const { index } = useAgentSteps(2, true, { stepMs: 1400 });
  return <AgentSteps steps={scoringSteps(llmRules)} index={index} label="CV scoring agent" />;
}

const POLL_MS = 4_000;
const POLL_FOR_MS = 75_000;

/**
 * The upload's background run is scoring this CV. Re-fetches the page every few seconds so the panel replaces
 * this card as soon as the score is saved; stops after ~75s (the page scores it itself once the window ends).
 */
export function LiveScoring({ llmRules }: { llmRules?: number }) {
  const router = useRouter();
  useEffect(() => {
    const started = Date.now();
    const t = setInterval(() => {
      if (Date.now() - started > POLL_FOR_MS) return clearInterval(t);
      router.refresh();
    }, POLL_MS);
    return () => clearInterval(t);
  }, [router]);
  return (
    <div className="flex flex-col gap-3 rounded-[20px] border border-[#E6E6EF] bg-white p-5">
      <h2 className="text-base font-bold">Your CV Score</h2>
      <ScoringSteps llmRules={llmRules} />
      <p className="text-xs text-[#5B5B6B]">
        This takes up to a minute after an upload. Your score appears here when it&apos;s ready, or{" "}
        <Link href="/profile" className="font-semibold underline underline-offset-2">refresh</Link>.
      </p>
    </div>
  );
}
