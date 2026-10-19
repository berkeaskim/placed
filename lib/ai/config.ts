/**
 * AI configuration: provider resolution, API keys and Ollama host/models. Server-side only: it reads the settings
 * store (SQLite). Never import it from a client component. Kept out of lib/env.ts because a client component imports
 * that file for its NEXT_PUBLIC values. (No `import "server-only"`: tsx scripts such as scripts/reliability.ts use it.)
 */
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { getSecret, getSetting } from "@/lib/settings/store";

export type AiProvider = "anthropic" | "gemini" | "ollama" | "codex";
export const AI_PROVIDERS: readonly AiProvider[] = ["anthropic", "gemini", "ollama", "codex"];

/** Setting / secret keys for the AI configuration (lib/settings/store). */
export const AI_KEYS = {
  provider: "ai.provider",
  anthropicKey: "ai.anthropic.key",
  geminiKey: "ai.gemini.key",
  ollamaHost: "ai.ollama.host",
  ollamaModel: "ai.ollama.model",
  /** "1" once the user turns on ChatGPT (Codex CLI) in Settings → AI. */
  codexEnabled: "ai.codex.enabled",
  codexBin: "ai.codex.bin",
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

/**
 * The Codex CLI binary: env CODEX_BIN, then setting ai.codex.bin, then the first `codex` on PATH or in a common install
 * folder (a server started by the LaunchAgent has no shell PATH), else plain "codex".
 */
export function codexBin(home = os.homedir(), exists: (p: string) => boolean = existsSync): string {
  const set = process.env.CODEX_BIN?.trim() || safe(() => getSetting(AI_KEYS.codexBin));
  if (set) return set;
  const dirs = [...(process.env.PATH ?? "").split(path.delimiter), path.join(home, ".npm-global/bin"), path.join(home, ".local/bin"), "/opt/homebrew/bin", "/usr/local/bin"];
  for (const d of dirs) {
    if (d && exists(path.join(d, "codex"))) return path.join(d, "codex");
  }
  return "codex";
}

/**
 * ChatGPT (Codex CLI) needs no key, so it counts as configured only once turned on in Settings → AI (or AI_PROVIDER=codex):
 * having the CLI installed must not switch AI on by itself.
 */
export function isProviderConfigured(p: AiProvider): boolean {
  if (p === "codex") return safe(() => getSetting(AI_KEYS.codexEnabled)) === "1" || asProvider(process.env.AI_PROVIDER) === "codex";
  if (p === "ollama") return Boolean(ollamaModel("fast") || ollamaModel("smart"));
  return Boolean(aiApiKey(p));
}

/**
 * Active provider. Order: env AI_PROVIDER, then setting ai.provider, then the first configured provider
 * (anthropic, gemini, ollama, codex). A chosen provider that is not configured falls through to the first configured one.
 * Synchronous: the settings store is synchronous (better-sqlite3).
 */
export function aiProvider(): AiProvider | null {
  const wanted = asProvider(process.env.AI_PROVIDER) ?? asProvider(safe(() => getSetting(AI_KEYS.provider)));
  if (wanted && isProviderConfigured(wanted)) return wanted;
  return AI_PROVIDERS.find(isProviderConfigured) ?? null;
}

/**
 * "fixture" only when AI_MODE=fixture (tests, e2e, offline demos): replays recorded answers. With no provider set up the
 * mode is "off", never fixture: AI calls throw AiError(AI_NOT_SET_UP) so the user sees a setup prompt, not sample text.
 */
export type AiMode = "live" | "fixture" | "off";

export function aiMode(): AiMode {
  if (process.env.AI_MODE === "fixture") return "fixture";
  return aiProvider() ? "live" : "off";
}

/** Budget for callers that race an AI call against a deadline (CV parse, judge batches). */
export const LOCAL_AI_DEADLINE_MS = 20 * 60_000;

/** Budget for the Codex CLI: each call starts a process and an agent turn, so it is slower than the cloud APIs. */
export const CODEX_AI_DEADLINE_MS = 5 * 60_000;

/**
 * A caller's deadline for the active provider. Cloud deadlines are tuned to cloud latency; a local model answers one
 * call at a time (ollama.ts queues them) and can take minutes per call, so it gets LOCAL_AI_DEADLINE_MS instead.
 */
export function aiDeadline(cloudMs: number): number {
  const p = aiProvider();
  if (p === "ollama") return Math.max(cloudMs, LOCAL_AI_DEADLINE_MS);
  if (p === "codex") return Math.max(cloudMs, CODEX_AI_DEADLINE_MS);
  return cloudMs;
}
