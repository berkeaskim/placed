import os from "node:os";
import Link from "next/link";
import { connection } from "next/server";
import { AI_KEYS, aiProvider, isProviderConfigured } from "@/lib/ai/config";
import { ANTHROPIC_MODELS, GEMINI_MODELS } from "@/lib/ai/models";
import { LOCAL_MODELS, bytesToGb, recommendFor } from "@/lib/ai/local-models";
import { isInstalled, ollamaStatus } from "@/lib/ai/ollama";
import { getSecret, getSetting } from "@/lib/settings/store";
import { ProviderPicker } from "@/components/settings-ai/provider-picker";
import { CloudProviderCard, type KeyState } from "@/components/settings-ai/cloud-provider-card";
import { OllamaPanel } from "@/components/settings-ai/ollama-panel";

export const metadata = { title: "AI settings" };

/** Where a cloud key comes from, plus its last 4 characters. The key itself never leaves the server. */
function keyState(envValue: string | undefined, secretKey: string): KeyState {
  const env = envValue?.trim();
  if (env) return { source: "env", last4: env.slice(-4) };
  const saved = getSecret(secretKey);
  return saved ? { source: "saved", last4: saved.slice(-4) } : { source: null, last4: null };
}

const setting = (k: string) => getSetting(k) ?? "";

export default async function AiSettings() {
  await connection(); // settings come from a synchronous DB and Ollama is probed live: always render at request time
  const status = await ollamaStatus();
  const ramGb = bytesToGb(os.totalmem());
  const rec = recommendFor(ramGb);
  const installed = status.running ? status.models : [];
  const active = aiProvider();
  const envProvider = process.env.AI_PROVIDER?.trim() || null;

  const options = [
    { id: "anthropic" as const, label: "Claude", hint: "Anthropic's models. Best quality; needs an API key.", configured: isProviderConfigured("anthropic") },
    { id: "gemini" as const, label: "Gemini", hint: "Google's models. Fast; has a free tier with an API key.", configured: isProviderConfigured("gemini") },
    { id: "ollama" as const, label: "Ollama (local)", hint: "Runs on this computer. Private and free, but slower.", configured: isProviderConfigured("ollama") },
  ];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <div className="flex flex-col gap-1">
        <Link href="/settings" className="text-sm font-semibold text-muted-foreground hover:text-foreground">
          ← Settings
        </Link>
        <h1 className="text-[28px] font-extrabold tracking-tight">AI</h1>
        <p className="text-sm text-muted-foreground">Choose which AI reads, scores and tailors your CV.</p>
      </div>

      <section className="card-quest flex flex-col gap-3 p-4 sm:p-5">
        <h2 className="font-bold">Provider</h2>
        <ProviderPicker options={options} chosen={getSetting(AI_KEYS.provider)} active={active} envLocked={envProvider} />
      </section>

      <section className="card-quest flex flex-col gap-3 p-4 sm:p-5" id="claude">
        <h2 className="font-bold">Claude</h2>
        <CloudProviderCard
          provider="anthropic"
          label="Claude"
          keyUrl="https://console.anthropic.com/settings/keys"
          envVar="ANTHROPIC_API_KEY"
          keyState={keyState(process.env.ANTHROPIC_API_KEY, AI_KEYS.anthropicKey)}
          defaults={ANTHROPIC_MODELS}
          overrides={{ fast: setting("ai.anthropic.model.fast"), smart: setting("ai.anthropic.model.smart") }}
        />
      </section>

      <section className="card-quest flex flex-col gap-3 p-4 sm:p-5" id="gemini">
        <h2 className="font-bold">Gemini</h2>
        <CloudProviderCard
          provider="gemini"
          label="Gemini"
          keyUrl="https://aistudio.google.com/apikey"
          envVar="GEMINI_API_KEY"
          keyState={keyState(process.env.GEMINI_API_KEY, AI_KEYS.geminiKey)}
          defaults={GEMINI_MODELS}
          overrides={{ fast: setting("ai.gemini.model.fast"), smart: setting("ai.gemini.model.smart") }}
        />
      </section>

      <section className="card-quest flex flex-col gap-3 p-4 sm:p-5" id="ollama">
        <h2 className="font-bold">Ollama (local)</h2>
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
      </section>
    </div>
  );
}
