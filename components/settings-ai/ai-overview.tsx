"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setProviderAction, testConnectionAction } from "@/app/(app)/settings/ai/actions";
import type { AiProvider } from "@/lib/ai/config";
import type { AiHealth } from "@/lib/ai/health";
import { AppIcon, Checkmark, Group, Row, Spinner, StatusDot, ago, btn, type Health } from "./shared";

export type ProviderOption = { id: AiProvider; label: string; subtitle: string; configured: boolean; badge?: string; health: AiHealth | null; model: string };

type Props = {
  options: ProviderOption[];
  /** The saved choice (may not be set up yet). */
  chosen: AiProvider | null;
  /** The provider calls actually go to. */
  active: AiProvider | null;
  envLocked: string | null;
};

/** The status header (does the model in use answer?) and the provider list. Picking a ready provider tests it at once. */
export function AiOverview({ options, chosen, active, envLocked }: Props) {
  const router = useRouter();
  const [checking, setChecking] = useState<AiProvider | null>(null);
  const [selecting, startSelect] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const selected = chosen ?? active;
  const activeOpt = options.find((o) => o.id === active) ?? null;
  const chosenOpt = options.find((o) => o.id === selected) ?? null;

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const check = async (id: AiProvider) => {
    setChecking(id);
    setError(null);
    try {
      await testConnectionAction(id, "smart");
    } catch {
      setError("The check didn't finish. Please try again.");
    } finally {
      setChecking(null);
      router.refresh();
    }
  };

  // The model in use was never checked (or changed since): check it once, so the header never just says "unknown".
  const autoChecked = useRef<string | null>(null);
  useEffect(() => {
    if (!activeOpt || activeOpt.health || checking) return;
    const key = `${activeOpt.id}:${activeOpt.model}`;
    if (autoChecked.current === key) return;
    autoChecked.current = key;
    void check(activeOpt.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOpt?.id, activeOpt?.model, activeOpt?.health]);

  const pick = (o: ProviderOption) => {
    if (o.id === selected && o.configured) return void check(o.id);
    startSelect(async () => {
      autoChecked.current = `${o.id}:${o.model}`; // this pick runs its own check below: the header must not start a second one
      const r = await setProviderAction(o.id);
      if (!r.ok) return setError(r.error);
      router.refresh();
      // Picking ChatGPT also turns it on (setProviderAction), so it is ready to test even if it wasn't a moment ago.
      if (o.configured || o.id === "codex") await check(o.id);
    });
  };

  const h = activeOpt?.health ?? null;
  const state: Health = !activeOpt ? "unknown" : checking === activeOpt.id ? "checking" : !h ? "unknown" : h.ok ? "ok" : "fail";

  return (
    <>
      <div className="flex flex-col gap-4 rounded-[14px] bg-white p-4 shadow-[0_0_0_0.5px_rgba(0,0,0,0.09),0_1px_3px_rgba(0,0,0,0.05)] sm:flex-row sm:items-center sm:p-5" aria-live="polite">
        <AppIcon kind={activeOpt?.id ?? "off"} size={48} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="text-[17px] font-semibold tracking-[-0.02em] text-black/90">{activeOpt ? activeOpt.label : "AI is off"}</p>
          {activeOpt ? (
            <>
              <p className="truncate font-mono text-[12px] text-black/55" title={activeOpt.model}>{activeOpt.model}</p>
              <p className="mt-1 flex items-center gap-1.5 text-[13px]">
                <StatusDot state={state} />
                {state === "checking" ? (
                  <span className="text-black/60">Checking that it answers…</span>
                ) : state === "ok" && h ? (
                  <span className="text-black/60">
                    <span className="font-medium text-[#248A3D]">Working</span> · answered in {(h.ms / 1000).toFixed(1)} s · checked {ago(h.at, now)}
                  </span>
                ) : state === "fail" && h ? (
                  <span className="min-w-0 break-words text-black/60">
                    <span className="font-medium text-[#D70015]">Not working</span> · {h.error}
                  </span>
                ) : (
                  <span className="text-black/60">Not checked yet</span>
                )}
              </p>
            </>
          ) : (
            <p className="text-[13px] text-black/55">Pick a provider below to turn on CV review, tailoring and cover letters.</p>
          )}
        </div>
        {activeOpt ? (
          <button type="button" className={`${btn} self-start sm:self-center`} disabled={checking !== null} onClick={() => check(activeOpt.id)}>
            {checking === activeOpt.id ? <Spinner /> : null}
            {checking === activeOpt.id ? "Checking" : "Check now"}
          </button>
        ) : null}
      </div>

      {envLocked ? (
        <p className="px-3 text-[12px] text-black/55">
          The <code>AI_PROVIDER</code> environment variable is set to <code>{envLocked}</code>, which overrides the choice below.
        </p>
      ) : chosenOpt && activeOpt && chosenOpt.id !== activeOpt.id ? (
        <p className="px-3 text-[12px] font-medium text-[#B25000]">
          {chosenOpt.label} isn&apos;t set up yet, so {activeOpt.label} is used for now. Finish setting it up below.
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="px-3 text-[13px] font-medium text-[#D70015]">{error}</p>
      ) : null}

      <Group title="Provider" footer="Placed tests a provider with a real request as soon as you pick it, so you know it works before you rely on it.">
        {options.map((o) => {
          const isSel = selected === o.id;
          const rowHealth: Health = checking === o.id ? "checking" : !o.configured ? "unknown" : !o.health ? "unknown" : o.health.ok ? "ok" : "fail";
          return (
            <Row
              key={o.id}
              icon={<AppIcon kind={o.id} />}
              title={
                <span className="flex items-center gap-2">
                  {o.label}
                  {o.badge ? <span className="rounded-full bg-[#5B3DF5]/10 px-1.5 py-px text-[11px] font-semibold text-[#5B3DF5]">{o.badge}</span> : null}
                </span>
              }
              subtitle={o.subtitle}
              selected={isSel}
              disabled={selecting || checking !== null}
              onClick={() => pick(o)}
              trailing={
                <>
                  {!o.configured ? (
                    <span>Set up</span>
                  ) : (
                    <span className="hidden items-center gap-1.5 sm:flex">
                      <StatusDot state={rowHealth} />
                      {rowHealth === "ok" ? "Working" : rowHealth === "fail" ? "Not working" : rowHealth === "checking" ? "Checking" : "Ready"}
                    </span>
                  )}
                  <span className="grid w-[17px] place-items-center">{isSel ? <Checkmark /> : null}</span>
                </>
              }
            />
          );
        })}
      </Group>
    </>
  );
}
