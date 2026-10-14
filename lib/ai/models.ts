import { aiMode, aiProvider } from "@/lib/env";

/** Pinned model ids per provider and tier. Single source for the adapters and for cache keys (06 R2). */
export const ANTHROPIC_MODELS = { fast: "claude-haiku-4-5", smart: "claude-sonnet-5-5" } as const;
export const GEMINI_MODELS = { fast: "gemini-3.8-flash", smart: "gemini-3.1-pro-preview" } as const;

/** The model that would answer a request of this tier right now; "fixture" in fixture mode. */
export function currentModelId(tier: "fast" | "smart"): string {
  if (aiMode() === "fixture") return "fixture";
  const p = aiProvider();
  if (!p) return "fixture";
  return `${p}:${(p === "anthropic" ? ANTHROPIC_MODELS : GEMINI_MODELS)[tier]}`;
}
