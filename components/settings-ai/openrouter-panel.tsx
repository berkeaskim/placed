"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  clearKeyAction,
  listOpenRouterModelsAction,
  saveKeyAction,
  setTierModelAction,
  testConnectionAction,
  type ModelOption,
} from "@/app/(app)/settings/ai/actions";
import type { AiHealth } from "@/lib/ai/health";
import { Chevron, Group, ResultLine, Row, Spinner, StatusDot, btn, btnPrimary, field, price, useAction, type Health } from "./shared";
import type { KeyState } from "./cloud-provider-card";

type Tier = "fast" | "smart";

/** Shown first in the picker, in this order, when OpenRouter lists them. */
const RECOMMENDED: { id: string; why: string }[] = [
  { id: "anthropic/claude-sonnet-5.5", why: "Best CV judging and writing" },
  { id: "google/gemini-3.8-flash", why: "Fast and cheap, good all-rounder" },
  { id: "anthropic/claude-haiku-5.5", why: "Fast Claude, very cheap" },
  { id: "openai/gpt-5.6-luna", why: "OpenAI, low cost" },
  { id: "deepseek/deepseek-v4.1-flash", why: "Cheapest that still follows the rules" },
];

const TIERS: { tier: Tier; title: string; subtitle: string }[] = [
  { tier: "smart", title: "CV review & writing", subtitle: "Scores your CV, tailors it, drafts cover letters" },
  { tier: "fast", title: "Quick tasks", subtitle: "Tags jobs, reads posts, short answers" },
];

type Props = {
  keyState: KeyState;
  models: Record<Tier, string>;
  defaults: Record<Tier, string>;
  health: Record<Tier, AiHealth | null>;
};

export function OpenRouterPanel({ keyState, models, defaults, health }: Props) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const keyAction = useAction();
  const hasKey = keyState.source !== null;

  return (
    <>
      <Group
        title="OpenRouter account"
        footer={
          <>
            One key for Claude, Gemini, GPT and hundreds of other models. Create one at{" "}
            <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer" className="font-medium text-[#5B3DF5] hover:underline">
              openrouter.ai/keys
            </a>{" "}
            and add a little credit. You pay OpenRouter per request; prices per million tokens are shown next to each model. The key stays on this
            Mac.
          </>
        }
      >
        {keyState.source === "env" ? (
          <Row title="API key" subtitle="Set by the OPENROUTER_API_KEY environment variable" trailing={keyState.last4 ? <span className="font-mono">••••{keyState.last4}</span> : null} />
        ) : hasKey ? (
          <Row
            title="API key"
            subtitle="Checked with OpenRouter and saved"
            trailing={
              <>
                <span className="font-mono">••••{keyState.last4}</span>
                <button
                  type="button"
                  className={`${btn} text-[#D70015]`}
                  disabled={keyAction.pending}
                  onClick={() =>
                    keyAction.run(async () => {
                      const r = await clearKeyAction("openrouter");
                      router.refresh();
                      return r;
                    })
                  }
                >
                  Remove
                </button>
              </>
            }
          />
        ) : null}
        {keyState.source !== "env" ? (
          <form
            className="flex flex-col gap-2 px-4 py-3"
            onSubmit={(e) => {
              e.preventDefault();
              const value = key;
              keyAction.run(async () => {
                const r = await saveKeyAction("openrouter", value);
                if (r.ok) {
                  setKey("");
                  // A new key: prove the chosen models answer with it.
                  await testConnectionAction("openrouter", "smart");
                  router.refresh();
                  return { ok: true, message: "Key saved and checked. You're ready." };
                }
                return r;
              });
            }}
          >
            <label htmlFor="openrouter-key" className="text-[13px] font-medium text-black/70">
              {hasKey ? "Replace key" : "API key"}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="openrouter-key"
                type="password"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="sk-or-v1-…"
                autoComplete="off"
                spellCheck={false}
                className={`${field} font-mono`}
              />
              <button type="submit" disabled={!key.trim() || keyAction.pending} className={`${btnPrimary} shrink-0`}>
                {keyAction.pending ? <Spinner /> : null}
                {keyAction.pending ? "Checking key" : "Save"}
              </button>
            </div>
            <ResultLine result={keyAction.result} />
          </form>
        ) : null}
      </Group>

      <Group title="Models" footer="Every model you pick is tested with a real request right away. The dot shows the last result.">
        {TIERS.map((t) => (
          <TierRow key={t.tier} {...t} model={models[t.tier]} isDefault={models[t.tier] === defaults[t.tier]} defaultModel={defaults[t.tier]} health={health[t.tier]} enabled={hasKey} />
        ))}
      </Group>
    </>
  );
}

function TierRow({
  tier,
  title,
  subtitle,
  model,
  isDefault,
  defaultModel,
  health,
  enabled,
}: {
  tier: Tier;
  title: string;
  subtitle: string;
  model: string;
  isDefault: boolean;
  defaultModel: string;
  health: AiHealth | null;
  enabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [list, setList] = useState<ModelOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const save = useAction();
  const info = list?.find((m) => m.id === model);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next && !list) {
      const r = await listOpenRouterModelsAction();
      if (r.ok) setList(r.models);
      else setLoadError(r.error);
    }
  };

  const choose = (id: string) =>
    save.run(async () => {
      const r = await setTierModelAction("openrouter", tier, id === defaultModel ? "" : id);
      if (!r.ok) return r;
      setOpen(false);
      router.refresh();
      const t = await testConnectionAction("openrouter", tier);
      router.refresh();
      return t;
    });

  const state: Health = save.pending ? "checking" : !health ? "unknown" : health.ok ? "ok" : "fail";

  return (
    <Row
      title={title}
      subtitle={
        <>
          {subtitle}
          <span className="mt-1 flex min-w-0 items-center gap-1.5 font-mono text-[12px] text-black/70">
            {enabled ? <StatusDot state={state} /> : null}
            <span className="truncate">{model}</span>
            {isDefault ? <span className="font-sans text-black/40">(default)</span> : null}
          </span>
        </>
      }
      trailing={
        <>
          {info ? <span className="hidden tabular-nums sm:inline">{price(info.promptPerM, info.completionPerM)}</span> : null}
          <button type="button" className={btn} onClick={toggle} disabled={!enabled || save.pending} aria-expanded={open}>
            {save.pending ? <Spinner /> : null}
            {save.pending ? "Testing" : "Change"}
            <Chevron open={open} />
          </button>
        </>
      }
    >
      <div className="px-4 pb-3 empty:hidden">
        {!enabled ? null : open ? (
          list ? (
            <ModelPicker models={list} current={model} onPick={choose} />
          ) : loadError ? (
            <p role="alert" className="text-[13px] text-[#D70015]">{loadError}</p>
          ) : (
            <p className="flex items-center gap-2 text-[13px] text-black/50">
              <Spinner /> Loading models…
            </p>
          )
        ) : null}
        {save.result ? <ResultLine result={save.result} /> : !save.pending && health && !health.ok ? <p className="break-words text-[12px] text-[#D70015]">{health.error}</p> : null}
      </div>
    </Row>
  );
}

function ModelPicker({ models, current, onPick }: { models: ModelOption[]; current: string; onPick: (id: string) => void }) {
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(models.map((m) => [m.id, m])), [models]);
  const recommended = RECOMMENDED.flatMap((r) => (byId.has(r.id) ? [{ ...byId.get(r.id)!, why: r.why }] : []));
  const query = q.trim().toLowerCase();
  const matches = query ? models.filter((m) => m.id.toLowerCase().includes(query) || m.name.toLowerCase().includes(query)).slice(0, 60) : [];

  return (
    <div className="mt-1 flex flex-col gap-2 rounded-[10px] bg-black/[0.03] p-2 motion-safe:animate-[fadeIn_160ms_ease-out]">
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder={`Search ${models.length} models (claude, gemini, gpt…)`}
        aria-label="Search models"
        autoFocus
        className={field}
      />
      <ul className="flex max-h-[320px] flex-col overflow-y-auto overscroll-contain" role="listbox" aria-label="Models">
        {(query ? matches : recommended).map((m) => (
          <li key={m.id}>
            <button
              type="button"
              role="option"
              aria-selected={m.id === current}
              onClick={() => onPick(m.id)}
              className="flex w-full items-center gap-3 rounded-[8px] px-2.5 py-2 text-left transition-colors duration-75 hover:bg-black/[0.05] active:bg-black/[0.09]"
            >
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[13px] font-medium text-black/90">{m.name}</span>
                <span className="truncate font-mono text-[11px] text-black/45">
                  {"why" in m ? `${(m as { why: string }).why} · ` : ""}
                  {m.id}
                </span>
              </span>
              <span className="shrink-0 text-right text-[11px] tabular-nums text-black/50">
                {price(m.promptPerM, m.completionPerM)}
                <span className="block text-black/35">per 1M in / out</span>
              </span>
              <span className="grid w-[17px] shrink-0 place-items-center">
                {m.id === current ? (
                  <svg aria-hidden viewBox="0 0 24 24" width={15} height={15} className="text-[#5B3DF5]">
                    <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : null}
              </span>
            </button>
          </li>
        ))}
        {query && matches.length === 0 ? <li className="px-2.5 py-3 text-[13px] text-black/50">No model matches “{q}”.</li> : null}
      </ul>
      {!query ? <p className="px-2.5 text-[11px] text-black/45">Recommended for Placed. Search to see every model that supports structured answers.</p> : null}
    </div>
  );
}
