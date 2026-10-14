"use client";
import { useFormStatus } from "react-dom";

export function ScoreNowButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn-quest min-h-12 px-5 py-3 disabled:opacity-60">
      {pending ? "Scoring your CV…" : "Score my CV"}
    </button>
  );
}
