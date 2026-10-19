"use client";
import { useState } from "react";
import { setCloudModelsAction, setCodexEnabledAction, testConnectionAction } from "@/app/(app)/settings/ai/actions";
import { btn, btnPrimary, CopyCommand, field, ResultLine, useAction } from "./shared";

type Props = {
  installed: boolean;
  bin: string;
  version: string | null;
  loggedIn: boolean;
  account: string | null;
  error: string | null;
  enabled: boolean;
  overrides: { fast: string; smart: string };
};

export function CodexPanel({ installed, bin, version, loggedIn, account, error, enabled, overrides }: Props) {
  const toggle = useAction();
  const testAction = useAction();
  const modelAction = useAction();
  const [fast, setFast] = useState(overrides.fast);
  const [smart, setSmart] = useState(overrides.smart);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-muted-foreground">
        Uses your ChatGPT plan through OpenAI&apos;s Codex CLI, signed in with your ChatGPT account. No API key needed. Each call starts the CLI, so
        it is a little slower than Claude or Gemini.
      </p>
      {!installed ? (
        <div className="flex flex-col gap-2 text-sm">
          <p className="font-semibold text-amber-700">Codex CLI not found{error ? ` (${error})` : ""}.</p>
          <p>Install it, then sign in with your ChatGPT account:</p>
          <CopyCommand command="npm install -g @openai/codex" />
          <CopyCommand command="codex login" />
        </div>
      ) : (
        <div className="flex flex-col gap-2 text-sm">
          <p>
            <span className="font-semibold">Codex CLI {version}</span> <span className="text-muted-foreground">at {bin}</span>
          </p>
          {loggedIn ? (
            <p className="font-semibold text-emerald-700">{account}</p>
          ) : (
            <>
              <p className="font-semibold text-amber-700">Not signed in. Run this in a terminal and choose &quot;Sign in with ChatGPT&quot;:</p>
              <CopyCommand command="codex login" />
            </>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        {enabled ? (
          <button type="button" className={btn} disabled={toggle.pending} onClick={() => toggle.run(() => setCodexEnabledAction(false))}>
            Turn off ChatGPT
          </button>
        ) : (
          <button type="button" className={btnPrimary} disabled={!installed || toggle.pending} onClick={() => toggle.run(() => setCodexEnabledAction(true))}>
            Use ChatGPT
          </button>
        )}
        <button type="button" className={btn} disabled={!installed || testAction.pending} onClick={() => testAction.run(() => testConnectionAction("codex"))}>
          {testAction.pending ? "Testing..." : "Test connection"}
        </button>
      </div>
      <ResultLine result={toggle.result} />
      <ResultLine result={testAction.result} />
      <details className="rounded-[14px] border-2 border-border p-3">
        <summary className="cursor-pointer text-sm font-semibold">Models (optional)</summary>
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            modelAction.run(() => setCloudModelsAction("codex", fast, smart));
          }}
        >
          <p className="text-xs text-muted-foreground">Leave empty to use the Codex CLI&apos;s default model. &quot;Fast&quot; handles quick tagging; &quot;smart&quot; scores and tailors your CV.</p>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Fast model
            <input value={fast} onChange={(e) => setFast(e.target.value)} placeholder="Codex default" className={field} spellCheck={false} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Smart model
            <input value={smart} onChange={(e) => setSmart(e.target.value)} placeholder="Codex default" className={field} spellCheck={false} />
          </label>
          <button type="submit" className={`${btn} self-start`} disabled={modelAction.pending}>
            Save models
          </button>
          <ResultLine result={modelAction.result} />
        </form>
      </details>
    </div>
  );
}
