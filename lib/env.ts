import { getSecret, getSetting } from "@/lib/settings/store";

export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  anthropicKey: process.env.ANTHROPIC_API_KEY ?? "",
  geminiKey: process.env.GEMINI_API_KEY ?? "",
  cronSecret: process.env.CRON_SECRET ?? "",
  googleClientId: process.env.GOOGLE_CLIENT_ID ?? "",
  googleClientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
  gmailTokenKey: process.env.GMAIL_TOKEN_KEY ?? "",
  demoMode: process.env.NEXT_PUBLIC_DEMO_MODE === "1",
  autopilot: process.env.NEXT_PUBLIC_AUTOPILOT === "1",
  // Chrome Web Store listing for the Autopilot extension; until it is set, the site offers the packed zip instead.
  autopilotStoreUrl: process.env.NEXT_PUBLIC_AUTOPILOT_STORE_URL ?? "",
};

export type AiProvider = "anthropic" | "gemini" | "ollama";
export const AI_PROVIDERS: readonly AiProvider[] = ["anthropic", "gemini", "ollama"];

/** Setting / secret keys for the AI configuration (lib/settings/store). */
export const AI_KEYS = {
  provider: "ai.provider",
  anthropicKey: "ai.anthropic.key",
  geminiKey: "ai.gemini.key",
  ollamaHost: "ai.ollama.host",
  ollamaModel: "ai.ollama.model",
} as const;

const DEFAULT_OLLAMA_HOST = "http://127.0.0.1:11434";

/** Settings store reads must never take the app down (e.g. DB not migrated yet): treat a failure as "unset". */
function safe(read: () => string | null): string | null {
  try {
    return read()?.trim() || null;
  } catch {
    return null;
  }
}

function asProvider(v: string | null | undefined): AiProvider | null {
  const p = (v ?? "").trim().toLowerCase();
  return (AI_PROVIDERS as readonly string[]).includes(p) ? (p as AiProvider) : null;
}

/** API key for a cloud provider: env first, then the key saved in Settings → AI. Read per call, so UI edits apply without a restart. */
export function aiApiKey(p: "anthropic" | "gemini"): string | null {
  const fromEnv = (p === "anthropic" ? process.env.ANTHROPIC_API_KEY : process.env.GEMINI_API_KEY)?.trim();
  if (fromEnv) return fromEnv;
  return safe(() => getSecret(p === "anthropic" ? AI_KEYS.anthropicKey : AI_KEYS.geminiKey));
}

/** Ollama base URL: env OLLAMA_HOST, then setting ai.ollama.host, then the local default. Bare "host:port" gets http://. */
export function ollamaHost(): string {
  const raw = process.env.OLLAMA_HOST?.trim() || safe(() => getSetting(AI_KEYS.ollamaHost)) || DEFAULT_OLLAMA_HOST;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  return withScheme.replace(/\/+$/, "");
}

/** Ollama model for a tier: ai.ollama.model.<tier>, then ai.ollama.model, then env OLLAMA_MODEL. */
export function ollamaModel(tier: "fast" | "smart"): string | null {
  return safe(() => getSetting(`${AI_KEYS.ollamaModel}.${tier}`)) ?? safe(() => getSetting(AI_KEYS.ollamaModel)) ?? (process.env.OLLAMA_MODEL?.trim() || null);
}

export function isProviderConfigured(p: AiProvider): boolean {
  if (p === "ollama") return Boolean(ollamaModel("fast") || ollamaModel("smart"));
  return Boolean(aiApiKey(p));
}

/**
 * Active provider. Order: env AI_PROVIDER, then setting ai.provider, then the first configured provider
 * (anthropic, gemini, ollama). A chosen provider that is not configured falls through to the first configured one.
 * Synchronous: the settings store is synchronous (better-sqlite3).
 */
export function aiProvider(): AiProvider | null {
  const wanted = asProvider(process.env.AI_PROVIDER) ?? asProvider(safe(() => getSetting(AI_KEYS.provider)));
  if (wanted && isProviderConfigured(wanted)) return wanted;
  return AI_PROVIDERS.find(isProviderConfigured) ?? null;
}

export function aiMode(): "live" | "fixture" {
  if (process.env.AI_MODE === "fixture") return "fixture";
  return aiProvider() ? "live" : "fixture";
}
