import type { z } from "zod";
import { aiMode, aiProvider } from "@/lib/env";
import { loadFixture } from "./fixtures";

export type Part = { type: "text"; text: string } | { type: "pdf"; base64: string };
/** `temperature` is optional and currently never sent: Anthropic models reject it and Gemini 3 should stay at its default (gemini.ts). */
export type StructuredRequest<T> = { tier: "fast" | "smart"; system: string; parts: Part[]; schema: z.ZodType<T>; maxTokens?: number; temperature?: number };

export class AiError extends Error {}

/** User-readable messages shared by every adapter. */
export const AI_REFUSAL = "The AI declined to process this request.";
export const AI_BAD_FORMAT = "The AI returned an answer we couldn't read. Please try again.";
export const AI_UNAVAILABLE = "The AI service is unavailable right now. Please try again shortly.";

/** The only entry point business functions use to reach an LLM. Vendor SDKs load lazily, server-side. */
export async function generateStructured<T>(req: StructuredRequest<T>): Promise<T> {
  const provider = aiProvider();
  if (!provider) throw new AiError("No AI provider configured");
  if (provider === "anthropic") {
    const { anthropicStructured } = await import("./anthropic");
    return anthropicStructured(req);
  }
  const { geminiStructured } = await import("./gemini");
  return geminiStructured(req);
}

type RunAiBase<T> = {
  fn: string;
  fixtureKey?: string;
  live: () => Promise<T>;
  fallback: () => T | Promise<T>;
};

/**
 * Fixture mode: load `fixtures/ai/<fn>/<fixtureKey|default>.json`, validate with `schema`,
 * then (optionally) post-process with `fromFixture` — so a fixture recorded in the model's raw
 * output shape becomes `T` exactly like the live branch's output. No fixture -> `fallback()`.
 * Live mode: `live()` (its output is never passed through `fromFixture`).
 */
export function runAi<T>(o: RunAiBase<T> & { schema: z.ZodType<T>; fromFixture?: undefined }): Promise<T>;
export function runAi<T, S>(o: RunAiBase<T> & { schema: z.ZodType<S>; fromFixture: (raw: S) => T }): Promise<T>;
export async function runAi<T, S>(
  o: RunAiBase<T> & { schema: z.ZodType<S> | z.ZodType<T>; fromFixture?: (raw: S) => T },
): Promise<T> {
  if (aiMode() === "fixture") {
    const raw = loadFixture(o.fn, o.fixtureKey);
    if (raw == null) return o.fallback();
    const parsed = o.schema.parse(raw);
    return o.fromFixture ? o.fromFixture(parsed as S) : (parsed as T);
  }
  return o.live();
}
