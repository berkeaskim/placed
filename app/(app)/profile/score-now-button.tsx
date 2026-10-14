"use client";
import { useFormStatus } from "react-dom";
import { AgentDot } from "@/components/agent/agent-steps";

/** Pending state reads as the agent working: live dot plus a white sheen (agent-shimmer is purple, invisible on the button). */
export function ScoreNowButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className="btn-quest inline-flex min-h-12 items-center justify-center gap-2 px-5 py-3 disabled:opacity-80">
      {pending ? <><AgentDot className="[&>span]:bg-white" /><span className="bg-[linear-gradient(90deg,#fff_0%,#fff_40%,#C9BEFF_50%,#fff_60%,#fff_100%)] bg-[length:250%_100%] bg-clip-text text-transparent [animation:agent-shimmer_2.2s_linear_infinite] motion-reduce:bg-none motion-reduce:text-white motion-reduce:[animation:none]">Scoring your CV…</span></> : "Score my CV"}
    </button>
  );
}
