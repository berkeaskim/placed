import { aiMode, aiProvider, ollamaModel } from "./config";
import { getSetting } from "@/lib/settings/store";

export type Tier = "fast" | "smart";

/** Pinned default model ids per provider and tier. Single source for the adapters and for cache keys (06 R2). */
export const ANTHROPIC_MODELS = { fast: "claude-haiku-4-5", smart: "claude-sonnet-5-5" } as const;
export const GEMINI_MODELS = { fast: "gemini-3.8-flash", smart: "gemini-3.8-flash" } as const; // smart on Flash too: Pro took 130-300s per call

function override(key: string): string | null {
  try {
    return getSetting(key)?.trim() || null;
  } catch {
    return null;
  }
}

/** Claude model for a tier: setting `ai.anthropic.model.<tier>` over the pinned default. */
export const anthropicModel = (tier: Tier): string => override(`ai.anthropic.model.${tier}`) ?? ANTHROPIC_MODELS[tier];
/** Gemini model for a tier: setting `ai.gemini.model.<tier>` over the pinned default. */
export const geminiModel = (tier: Tier): string => override(`ai.gemini.model.${tier}`) ?? GEMINI_MODELS[tier];

/** ChatGPT model for a tier: setting `ai.codex.model.<tier>`; null lets the Codex CLI use its own default model. */
export const codexModel = (tier: Tier): string | null => override(`ai.codex.model.${tier}`);

/** The model that would answer a request of this tier right now; "fixture" in fixture mode, "off" with no AI set up. */
export function currentModelId(tier: Tier): string {
  if (aiMode() === "fixture") return "fixture";
  const p = aiProvider();
  if (!p) return "off";
  const model = p === "anthropic" ? anthropicModel(tier) : p === "gemini" ? geminiModel(tier) : p === "codex" ? (codexModel(tier) ?? "default") : ollamaModel(tier);
  return `${p}:${model ?? "unset"}`;
}
