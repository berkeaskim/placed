"use client";
import { useState } from "react";
import { clearKeyAction, saveKeyAction, setCloudModelsAction, testConnectionAction } from "@/app/(app)/settings/ai/actions";
import { btn, btnPrimary, field, ResultLine, useAction } from "./shared";

export type KeyState = { source: "env" | "saved" | null; last4: string | null };

type Props = {
  provider: "anthropic" | "gemini";
  label: string;
  keyUrl: string;
  envVar: string;
  keyState: KeyState;
  defaults: { fast: string; smart: string };
  overrides: { fast: string; smart: string };
};

export function CloudProviderCard({ provider, label, keyUrl, envVar, keyState, defaults, overrides }: Props) {
  const [key, setKey] = useState("");
  const keyAction = useAction();
  const testAction = useAction();
  const modelAction = useAction();
  const [fast, setFast] = useState(overrides.fast);
  const [smart, setSmart] = useState(overrides.smart);
  const inputId = `${provider}-key`;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm">
        {keyState.source === "env" ? (
          <>Key set by the <code>{envVar}</code> environment variable{keyState.last4 ? ` (••••${keyState.last4})` : ""}.</>
        ) : keyState.source === "saved" ? (
          <span className="font-semibold text-emerald-700">Saved ••••{keyState.last4}</span>
        ) : (
          <span className="text-muted-foreground">
            No key yet. Get one at{" "}
            <a href={keyUrl} target="_blank" rel="noreferrer" className="font-semibold text-[#5B3DF5] underline">
              {new URL(keyUrl).host}
            </a>
            .
          </span>
        )}
      </p>
      <form
        className="flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const value = key;
          keyAction.run(async () => {
            const r = await saveKeyAction(provider, value);
            if (r.ok) setKey("");
            return r;
          });
        }}
      >
        <label htmlFor={inputId} className="text-sm font-semibold">
          {keyState.source === "saved" ? `Replace ${label} API key` : `${label} API key`}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id={inputId}
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="Paste your key"
            autoComplete="off"
            spellCheck={false}
            className={field}
          />
          <button type="submit" disabled={!key.trim() || keyAction.pending} className={`${btnPrimary} shrink-0`}>
            {keyAction.pending ? "Saving..." : "Save key"}
          </button>
        </div>
        <p className="text-xs text-muted-foreground">Stored on this computer only. It&apos;s never shown again in full.</p>
      </form>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={btn} disabled={!keyState.source || testAction.pending} onClick={() => testAction.run(() => testConnectionAction(provider))}>
          {testAction.pending ? "Testing..." : "Test connection"}
        </button>
        {keyState.source === "saved" ? (
          <button type="button" className={`${btn} text-destructive`} disabled={keyAction.pending} onClick={() => keyAction.run(() => clearKeyAction(provider))}>
            Remove saved key
          </button>
        ) : null}
      </div>
      <ResultLine result={keyAction.result} />
      <ResultLine result={testAction.result} />
      <details className="rounded-[14px] border-2 border-border p-3">
        <summary className="cursor-pointer text-sm font-semibold">Models (optional)</summary>
        <form
          className="mt-3 flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            modelAction.run(() => setCloudModelsAction(provider, fast, smart));
          }}
        >
          <p className="text-xs text-muted-foreground">Leave empty to use the defaults. &quot;Fast&quot; handles quick tagging; &quot;smart&quot; scores and tailors your CV.</p>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Fast model
            <input value={fast} onChange={(e) => setFast(e.target.value)} placeholder={defaults.fast} className={field} spellCheck={false} />
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Smart model
            <input value={smart} onChange={(e) => setSmart(e.target.value)} placeholder={defaults.smart} className={field} spellCheck={false} />
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
