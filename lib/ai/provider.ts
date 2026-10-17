import type { z } from "zod";
import { aiMode, aiProvider } from "@/lib/ai/config";
import { loadFixture, loadTextFixture } from "./fixtures";

export type Part = { type: "text"; text: string } | { type: "pdf"; base64: string };
/** `temperature` is optional and currently never sent: Anthropic models reject it and Gemini 3 should stay at its default (gemini.ts). */
/** Gemini runs every call at a LOW thinking level (Flash at its default HIGH level took ~2x as long); `thinking: "high"` opts back in. Adapters without the knob ignore it. */
/** `background`: batch work (job tagging during ingest). A local model serves every interactive call before it. */
export type StructuredRequest<T> = { tier: "fast" | "smart"; system: string; parts: Part[]; schema: z.ZodType<T>; maxTokens?: number; temperature?: number; thinking?: "low" | "high"; background?: boolean };

export type GroundedChunk = { uri: string; title: string };
export type GroundedResult = { text: string; chunks: GroundedChunk[] };
export type GroundedRequest = { system: string; prompt: string };

/** Streamed prose (cover letters). `signal` aborts the stream; the iteration then ends quietly. */
export type StreamRequest = { tier: "fast" | "smart"; system: string; prompt: string; signal?: AbortSignal; maxTokens?: number };

export class AiError extends Error {}

/** User-readable messages shared by every adapter. */
export const AI_REFUSAL = "The AI declined to process this request.";
export const AI_BAD_FORMAT = "The AI returned an answer we couldn't read. Please try again.";
export const AI_UNAVAILABLE = "The AI service is unavailable right now. Please try again shortly.";
export const AI_NOT_SET_UP = "AI isn't set up yet. Choose Claude, Gemini or a local model in Settings → AI.";

// One shared import promise per adapter: parallel first calls (judgeLinkedIn batches) must not race the module's
// evaluation ("Cannot access 'ai' before initialization" under jiti).
let anthropicMod: Promise<typeof import("./anthropic")> | null = null;
let geminiMod: Promise<typeof import("./gemini")> | null = null;
let ollamaMod: Promise<typeof import("./ollama")> | null = null;

/** The only entry point business functions use to reach an LLM. Vendor SDKs load lazily, server-side. */
export async function generateStructured<T>(req: StructuredRequest<T>): Promise<T> {
  const provider = aiProvider();
  if (!provider) throw new AiError(AI_NOT_SET_UP);
  if (provider === "anthropic") {
    const { anthropicStructured } = await (anthropicMod ??= import("./anthropic"));
    return anthropicStructured(req);
  }
  if (provider === "ollama") {
    const { ollamaStructured } = await (ollamaMod ??= import("./ollama"));
    return ollamaStructured(req);
  }
  const { geminiStructured } = await (geminiMod ??= import("./gemini"));
  return geminiStructured(req);
}

/**
 * Free-text answer researched with web search. Gemini only (Google Search grounding); returns null for a provider
 * without search (Anthropic, Ollama), so callers fall back to an inferred, unsourced answer.
 */
export async function generateGrounded(req: GroundedRequest): Promise<GroundedResult | null> {
  const provider = aiProvider();
  if (!provider) throw new AiError(AI_NOT_SET_UP);
  if (provider !== "gemini") return null;
  const { geminiGrounded } = await (geminiMod ??= import("./gemini"));
  return geminiGrounded(req);
}

/**
 * Fixture replay pace: 1-3 words per chunk, 15 ms apart, so the UI animates the same way every run.
 * AI_FIXTURE_CHUNK_MS overrides the gap; unit tests set it to 0 (vitest.config.ts) so they don't wait on the pace.
 */
async function* replayFixture(text: string, signal?: AbortSignal): AsyncGenerator<string> {
  const gap = Number(process.env.AI_FIXTURE_CHUNK_MS ?? 15);
  const words = text.match(/\S+\s*/g) ?? [];
  for (let i = 0, k = 0; i < words.length; k++) {
    if (signal?.aborted) return;
    const n = (k % 3) + 1; // deterministic 1-3 word chunks
    yield words.slice(i, i + n).join("");
    i += n;
    await new Promise((r) => setTimeout(r, Number.isFinite(gap) && gap >= 0 ? gap : 15));
  }
}

/**
 * Streams free text as deltas. Fixture mode replays `fixtures/ai/<fn>/<fixtureKey|default>.txt` (nothing if absent).
 * Joining the deltas gives the full text; adapters throw AiError with the shared messages.
 */
export async function* streamText(req: StreamRequest, o: { fn: string; fixtureKey?: string }): AsyncGenerator<string> {
  if (aiMode() === "fixture") {
    const text = loadTextFixture(o.fn, o.fixtureKey);
    if (text != null) yield* replayFixture(text, req.signal);
    return;
  }
  const provider = aiProvider();
  if (!provider) throw new AiError(AI_NOT_SET_UP);
  if (provider === "anthropic") {
    const { anthropicStream } = await (anthropicMod ??= import("./anthropic"));
    yield* anthropicStream(req);
  } else if (provider === "ollama") {
    const { ollamaStream } = await (ollamaMod ??= import("./ollama"));
    yield* ollamaStream(req);
  } else {
    const { geminiStream } = await (geminiMod ??= import("./gemini"));
    yield* geminiStream(req);
  }
}

type RunAiBase<T> = {
  fn: string;
  fixtureKey?: string;
  live: () => Promise<T>;
  fallback: () => T | Promise<T>;
};

/**
 * Fixture mode: load `fixtures/ai/<fn>/<fixtureKey|default>.json` (waiting its optional `delayMs`), validate with `schema`,
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
    // An optional numeric `delayMs` in the fixture holds the reply back, so the e2e test can see a slow step.
    const delay = (raw as { delayMs?: unknown }).delayMs;
    if (typeof delay === "number" && delay > 0) await new Promise((r) => setTimeout(r, Math.min(delay, 30_000)));
    const parsed = o.schema.parse(raw);
    return o.fromFixture ? o.fromFixture(parsed as S) : (parsed as T);
  }
  return o.live();
}
