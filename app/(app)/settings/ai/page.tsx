import os from "node:os";
import Link from "next/link";
import { connection } from "next/server";
import { AI_KEYS, KEY_ENV, KEY_SECRET, aiProvider, isProviderConfigured, ollamaModel, type AiProvider, type KeyProvider } from "@/lib/ai/config";
import { ANTHROPIC_MODELS, GEMINI_MODELS, OPENROUTER_MODELS, anthropicModel, codexModel, geminiModel, openrouterModel, type Tier } from "@/lib/ai/models";
import { readHealth, type AiHealth } from "@/lib/ai/health";
import { PROVIDER_LABEL } from "@/lib/ai/labels";
import { LOCAL_MODELS, bytesToGb, recommendFor } from "@/lib/ai/local-models";
import { isInstalled, ollamaStatus } from "@/lib/ai/ollama";
import { codexStatus } from "@/lib/ai/codex";
import { getSecret, getSetting } from "@/lib/settings/store";
import { AiOverview, type ProviderOption } from "@/components/settings-ai/ai-overview";
import { CloudProviderCard, type KeyState } from "@/components/settings-ai/cloud-provider-card";
import { OllamaPanel } from "@/components/settings-ai/ollama-panel";
import { CodexPanel } from "@/components/settings-ai/codex-panel";
import { OpenRouterPanel } from "@/components/settings-ai/openrouter-panel";
import { Group } from "@/components/settings-ai/shared";

export const metadata = { title: "AI settings" };

/** Where a key comes from, plus its last 4 characters. The key itself never leaves the server. */
function keyState(p: KeyProvider): KeyState {
  const env = process.env[KEY_ENV[p]]?.trim();
  if (env) return { source: "env", last4: env.slice(-4) };
  const saved = getSecret(KEY_SECRET[p]);
  return saved ? { source: "saved", last4: saved.slice(-4) } : { source: null, last4: null };
}

const setting = (k: string) => getSetting(k) ?? "";

function modelOf(p: AiProvider, tier: Tier): string {
  if (p === "openrouter") return openrouterModel(tier);
  if (p === "anthropic") return anthropicModel(tier);
  if (p === "gemini") return geminiModel(tier);
  if (p === "codex") return codexModel(tier) ?? "Codex default model";
  return ollamaModel(tier) ?? "no model chosen";
}

/** The saved check, only if it was for the model this tier uses now (a changed model needs a new check). */
function healthOf(p: AiProvider, tier: Tier): AiHealth | null {
  const h = readHealth(p, tier);
  if (!h) return null;
  const now = p === "codex" ? (codexModel(tier) ?? "default") : modelOf(p, tier);
  return h.model === now ? h : null;
}

const SUBTITLE: Record<AiProvider, string> = {
  openrouter: "One key for Claude, Gemini, GPT and more",
  codex: "Your ChatGPT plan through the Codex CLI, no key",
  ollama: "Runs privately on this Mac, free but slower",
  anthropic: "Direct Anthropic API key",
  gemini: "Direct Google AI Studio key",
};

export default async function AiSettings() {
  await connection(); // settings come from a synchronous DB and Ollama/Codex are probed live: always render at request time
  const [status, codex] = await Promise.all([ollamaStatus(), codexStatus()]);
  const ramGb = bytesToGb(os.totalmem());
  const rec = recommendFor(ramGb);
  const installed = status.running ? status.models : [];
  const active = aiProvider();
  const chosen = (getSetting(AI_KEYS.provider) as AiProvider | null) ?? null;
  const selected = chosen ?? active ?? "openrouter";
  const envProvider = process.env.AI_PROVIDER?.trim() || null;

  // Direct Claude/Gemini keys are an advanced path now: listed only once one is set up or chosen.
  const ids: AiProvider[] = ["openrouter", "codex", "ollama"];
  for (const p of ["anthropic", "gemini"] as const) if (isProviderConfigured(p) || chosen === p || active === p) ids.push(p);
  const options: ProviderOption[] = ids.map((id) => ({
    id,
    label: PROVIDER_LABEL[id],
    subtitle: SUBTITLE[id],
    configured: isProviderConfigured(id),
    badge: id === "openrouter" ? "Recommended" : undefined,
    health: healthOf(id, "smart"),
    model: id === "ollama" ? (ollamaModel("smart") ?? "no model chosen") : modelOf(id, "smart"),
  }));

  return (
    <div className="mx-auto flex max-w-[680px] flex-col gap-6 pb-10 [font-family:-apple-system,BlinkMacSystemFont,'SF_Pro_Text',system-ui,sans-serif] antialiased">
      <header className="flex flex-col gap-1">
        <Link href="/settings" className="-ml-1 flex w-fit items-center gap-0.5 rounded-md px-1 text-[13px] font-medium text-[#5B3DF5] hover:bg-[#5B3DF5]/[0.07]">
          <svg aria-hidden viewBox="0 0 24 24" width={14} height={14}><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
          Settings
        </Link>
        <h1 className="text-[28px] font-bold leading-[1.1] tracking-[-0.025em] text-black/90">AI</h1>
        <p className="text-[13px] text-black/55">Choose the model that reads, scores and tailors your CV.</p>
      </header>

      <AiOverview options={options} chosen={chosen} active={active} envLocked={envProvider} />

      {selected === "openrouter" ? (
        <OpenRouterPanel
          keyState={keyState("openrouter")}
          models={{ fast: openrouterModel("fast"), smart: openrouterModel("smart") }}
          defaults={OPENROUTER_MODELS}
          health={{ fast: healthOf("openrouter", "fast"), smart: healthOf("openrouter", "smart") }}
        />
      ) : null}

      {selected === "codex" ? (
        <CodexPanel
          installed={codex.installed}
          bin={codex.bin}
          version={codex.installed ? codex.version : null}
          loggedIn={codex.installed && codex.loggedIn}
          account={codex.installed ? codex.account : null}
          error={codex.installed ? null : codex.error}
          enabled={getSetting(AI_KEYS.codexEnabled) === "1"}
          overrides={{ fast: setting("ai.codex.model.fast"), smart: setting("ai.codex.model.smart") }}
        />
      ) : null}

      {selected === "ollama" ? (
        <Group title="Ollama on this Mac" id="ollama">
          <div className="px-4 py-4">
            <OllamaPanel
              running={status.running}
              host={status.host}
              hostSetting={setting(AI_KEYS.ollamaHost)}
              hostFromEnv={Boolean(process.env.OLLAMA_HOST?.trim())}
              version={status.running ? (status.version ?? null) : null}
              error={status.running ? null : status.error}
              ramGb={ramGb}
              tierGb={rec.tierGb}
              tight={rec.tight}
              models={LOCAL_MODELS.map((m) => ({ ...m, installed: isInstalled(m.tag, installed) }))}
              installed={installed.map((m) => ({ name: m.name, sizeGb: m.sizeBytes / 1e9, detail: [m.parameterSize, m.quantization].filter(Boolean).join(" ") }))}
              fast={setting("ai.ollama.model.fast") || setting(AI_KEYS.ollamaModel)}
              smart={setting("ai.ollama.model.smart")}
            />
          </div>
        </Group>
      ) : null}

      <details className="group flex flex-col gap-3" open={selected === "anthropic" || selected === "gemini"}>
        <summary className="flex w-fit cursor-pointer list-none items-center gap-1 rounded-md px-3 text-[13px] font-medium text-black/55 hover:text-black/80 [&::-webkit-details-marker]:hidden">
          <svg aria-hidden viewBox="0 0 24 24" width={12} height={12} className="transition-transform duration-200 group-open:rotate-90 motion-reduce:transition-none"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" /></svg>
          Advanced: direct Claude or Gemini keys
        </summary>
        <div className="mt-3 flex flex-col gap-6">
          <Group title="Claude (Anthropic key)" id="claude" footer="Only if you already have an Anthropic key. OpenRouter reaches the same models with one key.">
            <div className="px-4 py-4">
              <CloudProviderCard
                provider="anthropic"
                label="Claude"
                keyUrl="https://console.anthropic.com/settings/keys"
                envVar="ANTHROPIC_API_KEY"
                keyState={keyState("anthropic")}
                defaults={ANTHROPIC_MODELS}
                overrides={{ fast: setting("ai.anthropic.model.fast"), smart: setting("ai.anthropic.model.smart") }}
              />
            </div>
          </Group>
          <Group title="Gemini (Google key)" id="gemini" footer="Google AI Studio has a rate-limited free tier.">
            <div className="px-4 py-4">
              <CloudProviderCard
                provider="gemini"
                label="Gemini"
                keyUrl="https://aistudio.google.com/apikey"
                envVar="GEMINI_API_KEY"
                keyState={keyState("gemini")}
                defaults={GEMINI_MODELS}
                overrides={{ fast: setting("ai.gemini.model.fast"), smart: setting("ai.gemini.model.smart") }}
              />
            </div>
          </Group>
        </div>
      </details>
    </div>
  );
}
