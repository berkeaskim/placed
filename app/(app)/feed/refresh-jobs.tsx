"use client";
import { useState } from "react";
import { refreshFeed } from "./actions";

type Line =
  | { type: "progress"; done: number; total: number; slug: string; error: boolean }
  | { type: "done"; companies: number; failed: number; newJobs: number; aiTagging: boolean }
  | { type: "error"; error: string };

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/** "Refresh jobs": runs the ingest via /api/ingest (a route, so a long run doesn't hold up server actions) and streams progress. */
export function RefreshJobs({ lastRun, running }: { lastRun: string | null; running: boolean }) {
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(running ? "A refresh is already running. Check back in a few minutes." : null);

  async function run() {
    setBusy(true);
    setStatus("Starting…");
    try {
      const res = await fetch("/api/ingest", { method: "POST" });
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setStatus(body?.error ?? "Couldn't start the refresh. Try again.");
        return;
      }
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      let finished = false;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const parts = buf.split("\n");
        buf = parts.pop() ?? "";
        for (const p of parts.filter(Boolean)) {
          const l = JSON.parse(p) as Line;
          if (l.type === "progress") setStatus(`Checking companies… ${l.done}/${l.total} (${l.slug})`);
          else if (l.type === "error") { finished = true; setStatus(l.error); }
          else {
            finished = true;
            setStatus(`${l.newJobs ? plural(l.newJobs, "new job") : "No new jobs"} from ${plural(l.companies, "company", "companies")}`
              + `${l.failed ? ` (${l.failed} couldn't be reached)` : ""}.${l.aiTagging ? "" : " Set up an AI provider for sharper tags."}`);
            await refreshFeed();
          }
        }
      }
      if (!finished) setStatus("The refresh stopped early. Try again.");
    } catch {
      setStatus("The refresh stopped early. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <button type="button" onClick={run} disabled={busy || running}
        className="min-h-11 rounded-full border bg-white px-4 font-semibold hover:bg-[#EFEBFF] disabled:opacity-60">
        {busy ? "Refreshing…" : "Refresh jobs"}
      </button>
      <span role="status" aria-live="polite" className="text-muted-foreground">
        {status ?? (lastRun ? `Last refreshed ${lastRun}.` : "Not refreshed yet.")}
      </span>
    </div>
  );
}
