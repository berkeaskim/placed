"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AI_KEYS, AI_PROVIDERS, KEY_SECRET, aiProvider, type AiProvider } from "@/lib/ai/config";
import { AiError } from "@/lib/ai/provider";
import { clearHealth, writeHealth } from "@/lib/ai/health";
import type { Tier } from "@/lib/ai/models";
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

/** Refreshes this page and the app layout, whose "AI isn't set up" banner depends on the provider settings. */
function refresh() {
  revalidatePath(PATH);
  revalidatePath("/", "layout");
}
const CloudProvider = z.enum(["openrouter", "anthropic", "gemini"]);

export async function setProviderAction(provider: string): Promise<ActionResult> {
  if (!(AI_PROVIDERS as readonly string[]).includes(provider)) return { ok: false, error: "Unknown provider." };
  setSetting(AI_KEYS.provider, provider as AiProvider);
  if (provider === "codex") setSetting(AI_KEYS.codexEnabled, "1"); // nothing else to set up: picking it turns it on
  refresh();
  return { ok: true };
}

export async function saveKeyAction(provider: string, key: string): Promise<ActionResult> {
  const p = CloudProvider.safeParse(provider);
  if (!p.success) return { ok: false, error: "Unknown provider." };
  const k = key.trim();
  if (k.length < 10 || k.length > 400 || /\s/.test(k)) return { ok: false, error: "That doesn't look like an API key." };
  if (p.data === "openrouter") {
    // Check the key before saving it (free: no model call), so a typo never becomes the active setup.
    try {
      await (await import("@/lib/ai/openrouter")).openrouterKeyInfo(k);
    } catch (e) {
      return { ok: false, error: `OpenRouter rejected this key: ${e instanceof Error ? e.message : String(e)}` };
    }
  }
  pinProvider(p.data);
  setSecret(KEY_SECRET[p.data], k);
  clearHealth(p.data);
  refresh();
  return { ok: true, message: "Key saved." };
}

export async function clearKeyAction(provider: string): Promise<ActionResult> {
  const p = CloudProvider.safeParse(provider);
  if (!p.success) return { ok: false, error: "Unknown provider." };
  setSecret(KEY_SECRET[p.data], null);
  clearHealth(p.data);
  refresh();
  return { ok: true, message: "Key removed." };
}

/** Turns ChatGPT (Codex CLI) on or off. On: it also becomes the chosen provider when none was picked yet. */
export async function setCodexEnabledAction(on: boolean): Promise<ActionResult> {
  if (on) pinProvider("codex");
  setSetting(AI_KEYS.codexEnabled, on ? "1" : null);
  refresh();
  return { ok: true, message: on ? "ChatGPT turned on." : "ChatGPT turned off." };
}

const ModelId = z.string().trim().max(200).regex(/^[\w.:\/-]*$/);

const CloudModelProvider = z.enum(["openrouter", "anthropic", "gemini", "codex"]);

/** Per-tier model overrides for OpenRouter/Claude/Gemini/ChatGPT; an empty value goes back to the built-in default. */
export async function setCloudModelsAction(provider: string, fast: string, smart: string): Promise<ActionResult> {
  const p = CloudModelProvider.safeParse(provider);
  const f = ModelId.safeParse(fast);
  const s = ModelId.safeParse(smart);
  if (!p.success || !f.success || !s.success) return { ok: false, error: "Invalid model id." };
  setSetting(`ai.${p.data}.model.fast`, f.data || null);
  setSetting(`ai.${p.data}.model.smart`, s.data || null);
  clearHealth(p.data);
  refresh();
  return { ok: true, message: "Models saved." };
}

/** One tier's model (the OpenRouter picker). Empty = the default. The page then runs a test call on it. */
export async function setTierModelAction(provider: string, tier: string, model: string): Promise<ActionResult> {
  const p = CloudModelProvider.safeParse(provider);
  const t = z.enum(["fast", "smart"]).safeParse(tier);
  const m = ModelId.safeParse(model);
  if (!p.success || !t.success || !m.success) return { ok: false, error: "Invalid model id." };
  setSetting(`ai.${p.data}.model.${t.data}`, m.data || null);
  writeHealth(p.data, t.data, null);
  refresh();
  return { ok: true, message: "Model saved." };
}

export type ModelOption = { id: string; name: string; promptPerM: number; completionPerM: number; context: number };

/** OpenRouter models Placed can use (structured output), for the picker. */
export async function listOpenRouterModelsAction(): Promise<{ ok: true; models: ModelOption[] } | { ok: false; error: string }> {
  try {
    return { ok: true, models: await (await import("@/lib/ai/openrouter")).openrouterModels() };
  } catch (e) {
    return { ok: false, error: `Couldn't load the model list: ${e instanceof Error ? e.message : String(e)}` };
  }
}

/** Fast/smart Ollama models; also sets ai.ollama.model (the fallback) so the provider counts as configured. */
export async function setOllamaModelsAction(fast: string, smart: string): Promise<ActionResult> {
  for (const t of [fast, smart]) if (t && !OLLAMA_TAG_RE.test(t)) return { ok: false, error: "Invalid model tag." };
  if (fast || smart) pinProvider("ollama");
  setSetting("ai.ollama.model.fast", fast || null);
  setSetting("ai.ollama.model.smart", smart || null);
  setSetting(AI_KEYS.ollamaModel, fast || smart || null);
  clearHealth("ollama");
  refresh();
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
  refresh();
  return { ok: true, message: h ? "Host saved." : "Back to the default host." };
}

/** Re-renders the page so Ollama detection and the installed list run again. */
export async function refreshOllamaAction(): Promise<void> {
  refresh();
}

const Ping = z.object({ ok: z.boolean() });

function describe(e: unknown): string {
  const cause = e instanceof Error && e.cause instanceof Error ? e.cause : null;
  const base = e instanceof Error ? e.message : String(e);
  // Show the underlying reason (bad key, model missing, connection refused): this is the user's own machine and key.
  const detail = cause ? (cause.cause instanceof Error ? `${cause.message} (${cause.cause.message})` : cause.message) : "";
  return (detail ? `${base} ${detail}` : base).slice(0, 300);
}

/** The model id a tier of this provider would use, for the health record (currentModelId only covers the active one). */
async function modelFor(provider: AiProvider, tier: Tier): Promise<string> {
  const m = await import("@/lib/ai/models");
  const { ollamaModel } = await import("@/lib/ai/config");
  if (provider === "openrouter") return m.openrouterModel(tier);
  if (provider === "anthropic") return m.anthropicModel(tier);
  if (provider === "gemini") return m.geminiModel(tier);
  if (provider === "codex") return m.codexModel(tier) ?? "default";
  return ollamaModel(tier) ?? "unset";
}

/**
 * A tiny real call through the provider's adapter (whether or not it is the active provider), on the given tier's
 * model. The result is saved, so the page keeps showing whether the chosen model works.
 */
export async function testConnectionAction(provider: string, tier: string = "smart"): Promise<ActionResult> {
  if (!(AI_PROVIDERS as readonly string[]).includes(provider)) return { ok: false, error: "Unknown provider." };
  const t: Tier = tier === "fast" ? "fast" : "smart";
  const p = provider as AiProvider;
  const model = await modelFor(p, t);
  const res = await runTest(p, t);
  writeHealth(p, t, { ok: res.ok, model, ms: res.ms, at: new Date().toISOString(), ...(res.ok ? {} : { error: res.error }) });
  refresh();
  return res.ok ? { ok: true, message: `Working: ${model} answered in ${(res.ms / 1000).toFixed(1)} s.` } : { ok: false, error: res.error };
}

async function runTest(provider: AiProvider, tier: Tier): Promise<{ ok: true; ms: number } | { ok: false; ms: number; error: string }> {
  const req = {
    tier,
    system: "You are a connection test. Answer with JSON only.",
    parts: [{ type: "text" as const, text: 'Return {"ok": true}.' }],
    schema: Ping,
    maxTokens: 2000, // reasoning models spend part of the budget thinking
  };
  const t0 = Date.now();
  try {
    let out: z.infer<typeof Ping>;
    if (provider === "openrouter") out = await (await import("@/lib/ai/openrouter")).openrouterStructured(req);
    else if (provider === "anthropic") out = await (await import("@/lib/ai/anthropic")).anthropicStructured(req);
    else if (provider === "gemini") out = await (await import("@/lib/ai/gemini")).geminiStructured(req);
    else if (provider === "codex") out = await (await import("@/lib/ai/codex")).codexStructured(req);
    else out = await (await import("@/lib/ai/ollama")).ollamaStructured(req);
    void out;
    return { ok: true, ms: Date.now() - t0 };
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, error: e instanceof AiError ? describe(e) : `Test failed: ${describe(e)}` };
  }
}

