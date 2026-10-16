"use client";
import { useState, useTransition } from "react";
import type { ActionResult } from "@/app/(app)/settings/ai/actions";

export const btn =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-[14px] border-2 border-border bg-white px-4 text-sm font-bold transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";
export const btnPrimary = "btn-quest inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm disabled:cursor-not-allowed disabled:opacity-50";
export const field = "min-h-11 w-full rounded-[14px] border-2 border-border bg-background px-3 py-2 text-base sm:text-sm";

/** Runs a server action in a transition and keeps its last result for display. */
export function useAction() {
  const [pending, start] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);
  const run = (fn: () => Promise<ActionResult>) =>
    start(async () => {
      setResult(null);
      try {
        setResult(await fn());
      } catch {
        setResult({ ok: false, error: "Something went wrong. Please try again." });
      }
    });
  return { pending, result, run, clear: () => setResult(null) };
}

export function ResultLine({ result }: { result: ActionResult | null }) {
  if (!result) return null;
  return result.ok ? (
    <p role="status" className="text-sm font-semibold text-emerald-700">{result.message ?? "Done."}</p>
  ) : (
    <p role="alert" className="break-words text-sm font-semibold text-destructive">{result.error}</p>
  );
}

export function CopyCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-[10px] bg-muted px-3 py-1.5">
      <code className="min-w-0 flex-1 truncate font-mono text-xs">{command}</code>
      <button
        type="button"
        className="shrink-0 text-xs font-bold text-[#5B3DF5] hover:underline"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(command);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // clipboard blocked (e.g. non-secure context): the command stays visible to copy by hand
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
