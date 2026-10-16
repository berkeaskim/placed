"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AI_KEYS, AI_PROVIDERS, aiProvider, type AiProvider } from "@/lib/ai/config";
import { AiError } from "@/lib/ai/provider";
import { OLLAMA_TAG_RE } from "@/lib/ai/ollama";
import { getSetting, setSecret, setSetting } from "@/lib/settings/store";

/**
 * Before configuring a provider: if no provider was ever chosen, pin the one in use now (or, if none, the one being set
 * up), so adding e.g. a Claude key doesn't silently switch someone away from a working Ollama setup.
 */
function pinProvider(configuring: AiProvider) {
  if (getSetting(AI_KEYS.provider)) return;
  setSetting(AI_KEYS.provider, aiProvider() ?? configuring);
}

// Single-user local app: no auth checks. These run server-side only; secrets never travel back to the client.

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

const PATH = "/settings/ai";
const CloudProvider = z.enum(["anthropic", "gemini"]);

export async function setProviderAction(provider: string): Promise<ActionResult> {
  if (!(AI_PROVIDERS as readonly string[]).includes(provider)) return { ok: false, error: "Unknown provider." };
  setSetting(AI_KEYS.provider, provider as AiProvider);
  revalidatePath(PATH);
  return { ok: true };
}

export async function saveKeyAction(provider: string, key: string): Promise<ActionResult> {
  const p = CloudProvider.safeParse(provider);
  if (!p.success) return { ok: false, error: "Unknown provider." };
  const k = key.trim();
  if (k.length < 10 || k.length > 400 || /\s/.test(k)) return { ok: false, error: "That doesn't look like an API key." };
  pinProvider(p.data);
  setSecret(p.data === "anthropic" ? AI_KEYS.anthropicKey : AI_KEYS.geminiKey, k);
  revalidatePath(PATH);
  return { ok: true, message: "Key saved." };
}

export async function clearKeyAction(provider: string): Promise<ActionResult> {
  const p = CloudProvider.safeParse(provider);
  if (!p.success) return { ok: false, error: "Unknown provider." };
  setSecret(p.data === "anthropic" ? AI_KEYS.anthropicKey : AI_KEYS.geminiKey, null);
  revalidatePath(PATH);
  return { ok: true, message: "Key removed." };
}

const ModelId = z.string().trim().max(200).regex(/^[\w.:\/-]*$/);

/** Per-tier model overrides for Claude/Gemini; an empty value goes back to the built-in default. */
export async function setCloudModelsAction(provider: string, fast: string, smart: string): Promise<ActionResult> {
  const p = CloudProvider.safeParse(provider);
  const f = ModelId.safeParse(fast);
  const s = ModelId.safeParse(smart);
  if (!p.success || !f.success || !s.success) return { ok: false, error: "Invalid model id." };
  setSetting(`ai.${p.data}.model.fast`, f.data || null);
  setSetting(`ai.${p.data}.model.smart`, s.data || null);
  revalidatePath(PATH);
  return { ok: true, message: "Models saved." };
}

/** Fast/smart Ollama models; also sets ai.ollama.model (the fallback) so the provider counts as configured. */
export async function setOllamaModelsAction(fast: string, smart: string): Promise<ActionResult> {
  for (const t of [fast, smart]) if (t && !OLLAMA_TAG_RE.test(t)) return { ok: false, error: "Invalid model tag." };
  if (fast || smart) pinProvider("ollama");
  setSetting("ai.ollama.model.fast", fast || null);
  setSetting("ai.ollama.model.smart", smart || null);
  setSetting(AI_KEYS.ollamaModel, fast || smart || null);
  revalidatePath(PATH);
  return { ok: true, message: "Models saved." };
}

export async function setOllamaHostAction(host: string): Promise<ActionResult> {
  const h = host.trim();
  if (h) {
    try {
      if (h.includes("://") && !/^https?:\/\//i.test(h)) throw new Error("scheme");
      const u = new URL(/^https?:\/\//i.test(h) ? h : `http://${h}`);
      if (!u.hostname) throw new Error("host");
    } catch {
      return { ok: false, error: "Enter a URL like http://127.0.0.1:11434" };
    }
  }
  setSetting(AI_KEYS.ollamaHost, h || null);
  revalidatePath(PATH);
  return { ok: true, message: h ? "Host saved." : "Back to the default host." };
}

/** Re-renders the page so Ollama detection and the installed list run again. */
export async function refreshOllamaAction(): Promise<void> {
  revalidatePath(PATH);
}

const Ping = z.object({ ok: z.boolean() });

function describe(e: unknown): string {
  const cause = e instanceof Error && e.cause instanceof Error ? e.cause : null;
  const base = e instanceof Error ? e.message : String(e);
  // Show the underlying reason (bad key, model missing, connection refused): this is the user's own machine and key.
  const detail = cause ? (cause.cause instanceof Error ? `${cause.message} (${cause.cause.message})` : cause.message) : "";
  return (detail ? `${base} ${detail}` : base).slice(0, 300);
}

/** A tiny real call through the provider's adapter (whether or not it is the active provider). */
export async function testConnectionAction(provider: string): Promise<ActionResult> {
  if (!(AI_PROVIDERS as readonly string[]).includes(provider)) return { ok: false, error: "Unknown provider." };
  const req = {
    tier: "fast" as const,
    system: "You are a connection test. Answer with JSON only.",
    parts: [{ type: "text" as const, text: 'Return {"ok": true}.' }],
    schema: Ping,
    maxTokens: 200,
  };
  const t0 = Date.now();
  try {
    let out: z.infer<typeof Ping>;
    if (provider === "anthropic") out = await (await import("@/lib/ai/anthropic")).anthropicStructured(req);
    else if (provider === "gemini") out = await (await import("@/lib/ai/gemini")).geminiStructured(req);
    else out = await (await import("@/lib/ai/ollama")).ollamaStructured(req);
    return { ok: true, message: `Connected: got a valid answer in ${((Date.now() - t0) / 1000).toFixed(1)} s${out.ok ? "" : " (model said ok=false)"}.` };
  } catch (e) {
    return { ok: false, error: e instanceof AiError ? describe(e) : `Test failed: ${describe(e)}` };
  }
}
