"use client";
import { setProviderAction } from "@/app/(app)/settings/ai/actions";
import type { AiProvider } from "@/lib/ai/config";
import { ResultLine, useAction } from "./shared";

type Option = { id: AiProvider; label: string; hint: string; configured: boolean };

export function ProviderPicker({ options, chosen, active, envLocked }: { options: Option[]; chosen: string | null; active: string | null; envLocked: string | null }) {
  const { pending, result, run } = useAction();
  const selected = chosen ?? active;
  return (
    <fieldset className="flex flex-col gap-3" disabled={pending}>
      <legend className="sr-only">AI provider</legend>
      <div className="grid gap-2 sm:grid-cols-2">
        {options.map((o) => (
          <label
            key={o.id}
            className={`flex cursor-pointer flex-col gap-1 rounded-[14px] border-2 p-3 transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50 ${
              selected === o.id ? "border-[#5B3DF5] bg-[#F3F0FF]" : "border-border bg-white hover:bg-muted"
            }`}
          >
            <span className="flex items-center gap-2">
              <input
                type="radio"
                name="provider"
                value={o.id}
                checked={selected === o.id}
                onChange={() => run(() => setProviderAction(o.id))}
                className="accent-[#5B3DF5]"
              />
              <span className="font-bold">{o.label}</span>
            </span>
            <span className="text-xs text-muted-foreground">{o.hint}</span>
            <span className={`text-xs font-semibold ${o.configured ? "text-emerald-700" : "text-muted-foreground"}`}>
              {active === o.id ? "In use" : o.configured ? "Ready" : "Not set up yet"}
            </span>
          </label>
        ))}
      </div>
      {envLocked ? (
        <p className="text-xs text-muted-foreground">
          The <code>AI_PROVIDER</code> environment variable is set to <code>{envLocked}</code>, which overrides this choice.
        </p>
      ) : selected && active && selected !== active ? (
        <p className="text-xs font-semibold text-amber-700">
          {options.find((o) => o.id === selected)?.label} isn&apos;t set up yet, so {options.find((o) => o.id === active)?.label} is used for now.
        </p>
      ) : null}
      <ResultLine result={result && !result.ok ? result : null} />
    </fieldset>
  );
}
