"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { LocalModel } from "@/lib/ai/local-models";
import { refreshOllamaAction, setOllamaHostAction, setOllamaModelsAction, testConnectionAction } from "@/app/(app)/settings/ai/actions";
import { btn, btnPrimary, CopyCommand, field, ResultLine, useAction } from "./shared";

export type InstalledModel = { name: string; sizeGb: number; detail: string };
type Props = {
  running: boolean;
  host: string;
  hostSetting: string;
  hostFromEnv: boolean;
  version: string | null;
  error: string | null;
  ramGb: number;
  tierGb: number;
  tight: boolean;
  models: (LocalModel & { installed: boolean })[];
  installed: InstalledModel[];
  fast: string;
  smart: string;
};

export function OllamaPanel(p: Props) {
  const router = useRouter();
  const refresh = useAction();
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm">
          {p.running ? (
            <span className="font-semibold text-emerald-700">
              Ollama is running{p.version ? ` (v${p.version})` : ""} at <code>{p.host}</code>.
            </span>
          ) : (
            <span className="font-semibold text-amber-700">
              Ollama isn&apos;t running at <code>{p.host}</code>.
            </span>
          )}
        </p>
        <button
          type="button"
          className={btn}
          disabled={refresh.pending}
          onClick={() =>
            refresh.run(async () => {
              await refreshOllamaAction();
              router.refresh();
              return { ok: true, message: "Checked again." };
            })
          }
        >
          {refresh.pending ? "Checking..." : "Check again"}
        </button>
      </div>

      {!p.running ? <InstallSteps /> : null}

      <div className="flex flex-col gap-2">
        <h3 className="font-bold">Pick a model for your computer</h3>
        <p className="text-sm text-muted-foreground">
          This computer has about <strong className="text-foreground">{p.ramGb} GB</strong> of memory, so we suggest the{" "}
          <strong className="text-foreground">{p.tierGb} GB</strong> row.
          {p.tight ? " That is below 8 GB, so local models will be slow; a cloud provider will work better." : ""} Bigger models write better
          but answer more slowly.
        </p>
        <ul className="flex flex-col gap-2">
          {p.models.map((m) => (
            <ModelRow key={m.tag} model={m} fits={m.minRamGb === p.tierGb} tooBig={m.minRamGb > p.ramGb} canPull={p.running} />
          ))}
        </ul>
      </div>

      {p.running ? <ModelPickers installed={p.installed} fast={p.fast} smart={p.smart} /> : null}

      <HostField host={p.hostSetting} fromEnv={p.hostFromEnv} />
    </div>
  );
}

function InstallSteps() {
  return (
    <div className="flex flex-col gap-2 rounded-[14px] bg-muted/60 p-3 text-sm">
      <p className="font-semibold">Set up Ollama (free, runs AI on your own computer):</p>
      <ol className="flex list-decimal flex-col gap-2 pl-5">
        <li>
          Download it from{" "}
          <a href="https://ollama.com/download" target="_blank" rel="noreferrer" className="font-semibold text-[#5B3DF5] underline">
            ollama.com/download
          </a>
          , or on a Mac with Homebrew:
          <div className="mt-1">
            <CopyCommand command="brew install ollama" />
          </div>
        </li>
        <li>
          Start it (the desktop app starts it for you):
          <div className="mt-1">
            <CopyCommand command="ollama serve" />
          </div>
        </li>
        <li>Press &quot;Check again&quot; above.</li>
      </ol>
    </div>
  );
}

type Pull = { state: "idle" } | { state: "pulling"; status: string; pct: number | null } | { state: "done" } | { state: "error"; error: string };

function ModelRow({ model, fits, tooBig, canPull }: { model: LocalModel & { installed: boolean }; fits: boolean; tooBig: boolean; canPull: boolean }) {
  const router = useRouter();
  const [pull, setPull] = useState<Pull>({ state: "idle" });
  const abort = useRef<AbortController | null>(null);

  async function download() {
    const ctrl = new AbortController();
    abort.current = ctrl;
    setPull({ state: "pulling", status: "Starting...", pct: null });
    try {
      const res = await fetch("/settings/ai/pull", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ tag: model.tag }),
        signal: ctrl.signal,
      });
      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error ?? "Download failed to start.");
      }
      const layers = new Map<string, { total: number; completed: number }>();
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += value;
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const ev = JSON.parse(line) as { status?: string; digest?: string; total?: number; completed?: number; error?: string };
          if (ev.error) throw new Error(ev.error);
          if (ev.digest && ev.total) layers.set(ev.digest, { total: ev.total, completed: ev.completed ?? 0 });
          let total = 0, completed = 0;
          for (const l of layers.values()) {
            total += l.total;
            completed += l.completed;
          }
          const status = ev.status?.startsWith("pulling ") && ev.digest ? "Downloading" : (ev.status ?? "");
          if (ev.status === "success") {
            setPull({ state: "done" });
            router.refresh();
            return;
          }
          setPull({ state: "pulling", status, pct: total ? Math.min(100, (completed / total) * 100) : null });
        }
      }
      throw new Error("The download stopped before it finished.");
    } catch (e) {
      if (ctrl.signal.aborted) setPull({ state: "idle" });
      else setPull({ state: "error", error: e instanceof Error ? e.message : "Download failed." });
    } finally {
      abort.current = null;
    }
  }

  const installed = model.installed || pull.state === "done";
  return (
    <li className={`flex flex-col gap-2 rounded-[14px] border-2 p-3 ${fits ? "border-[#5B3DF5] bg-[#F3F0FF]" : "border-border bg-white"}`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-bold">
            {model.label}
            <span className="rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-muted-foreground ring-1 ring-border">
              {model.minRamGb} GB+ memory
            </span>
            {model.recommended ? <span className="rounded-full bg-[#5B3DF5] px-2 py-0.5 text-xs font-semibold text-white">Recommended</span> : null}
            {fits ? <span className="text-xs font-semibold text-[#5B3DF5]">Fits this computer</span> : null}
            {tooBig ? <span className="text-xs font-semibold text-amber-700">Needs more memory than this computer has</span> : null}
          </p>
          <p className="text-sm text-muted-foreground">{model.note}</p>
          <p className="text-xs text-muted-foreground">{model.sizeGb.toFixed(1)} GB download</p>
        </div>
        <div className="shrink-0">
          {installed ? (
            <span className="inline-flex min-h-11 items-center text-sm font-bold text-emerald-700">Installed ✓</span>
          ) : pull.state === "pulling" ? (
            <button type="button" className={btn} onClick={() => abort.current?.abort()}>
              Cancel
            </button>
          ) : (
            <button type="button" className={btnPrimary} disabled={!canPull} onClick={download} title={canPull ? undefined : "Start Ollama first"}>
              Download
            </button>
          )}
        </div>
      </div>
      {pull.state === "pulling" ? (
        <div className="flex flex-col gap-1">
          <div
            role="progressbar"
            aria-label={`Downloading ${model.tag}`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pull.pct === null ? undefined : Math.round(pull.pct)}
            className="h-2 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className={`h-full rounded-full bg-[#5B3DF5] transition-all ${pull.pct === null ? "w-1/4 animate-pulse" : ""}`} style={pull.pct === null ? undefined : { width: `${pull.pct}%` }} />
          </div>
          <p className="text-xs text-muted-foreground">
            {pull.status}
            {pull.pct !== null ? ` · ${Math.floor(pull.pct)}%` : ""}
          </p>
        </div>
      ) : null}
      {pull.state === "error" ? <p role="alert" className="break-words text-sm font-semibold text-destructive">{pull.error}</p> : null}
      {!installed ? <CopyCommand command={`ollama pull ${model.tag}`} /> : null}
    </li>
  );
}

function ModelPickers({ installed, fast, smart }: { installed: InstalledModel[]; fast: string; smart: string }) {
  const [f, setF] = useState(fast);
  const [s, setS] = useState(smart);
  const save = useAction();
  const test = useAction();
  const names = installed.map((m) => m.name);
  // Keep a saved choice visible even if that model was removed from Ollama since.
  const options = (current: string) => (current && !names.includes(current) ? [current, ...names] : names);
  if (installed.length === 0) {
    return <p className="text-sm text-muted-foreground">No models installed yet. Download one above, then choose it here.</p>;
  }
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        save.run(() => setOllamaModelsAction(f, s));
      }}
    >
      <h3 className="font-bold">Models Placed uses</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Fast (tagging jobs, quick checks)
          <select value={f} onChange={(e) => setF(e.target.value)} className={field}>
            <option value="">Choose a model</option>
            {options(f).map((n) => (
              <option key={n} value={n}>
                {n}
                {names.includes(n) ? "" : " (not installed)"}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Smart (scoring and tailoring your CV)
          <select value={s} onChange={(e) => setS(e.target.value)} className={field}>
            <option value="">Same as fast</option>
            {options(s).map((n) => (
              <option key={n} value={n}>
                {n}
                {names.includes(n) ? "" : " (not installed)"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className={btnPrimary} disabled={save.pending || (!f && !s)}>
          {save.pending ? "Saving..." : "Save models"}
        </button>
        <button type="button" className={btn} disabled={test.pending || (!fast && !smart)} onClick={() => test.run(() => testConnectionAction("ollama"))}>
          {test.pending ? "Testing (local models can take a while)..." : "Test"}
        </button>
      </div>
      <ResultLine result={save.result} />
      <ResultLine result={test.result} />
    </form>
  );
}

function HostField({ host, fromEnv }: { host: string; fromEnv: boolean }) {
  const [value, setValue] = useState(host);
  const save = useAction();
  return (
    <details className="rounded-[14px] border-2 border-border p-3">
      <summary className="cursor-pointer text-sm font-semibold">Advanced: Ollama address</summary>
      <form
        className="mt-3 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          save.run(() => setOllamaHostAction(value));
        }}
      >
        {fromEnv ? <p className="text-xs text-muted-foreground">The OLLAMA_HOST environment variable is set and takes priority.</p> : null}
        <div className="flex flex-col gap-2 sm:flex-row">
          <input value={value} onChange={(e) => setValue(e.target.value)} placeholder="http://127.0.0.1:11434" className={field} spellCheck={false} aria-label="Ollama address" />
          <button type="submit" className={`${btn} shrink-0`} disabled={save.pending}>
            Save
          </button>
        </div>
        <ResultLine result={save.result} />
      </form>
    </details>
  );
}
