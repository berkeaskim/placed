/**
 * Shared instrumentation for the live AI suite (not a test file).
 * Wraps the real Gemini client so each attempt records latency, finishReason, token usage and the raw
 * text, without changing what lib/ai/gemini.ts does with the response.
 */
import { GoogleGenAI } from "@google/genai";
import { appendFileSync } from "node:fs";

export const LIVE = Boolean(process.env.LIVE_AI);

export type AttemptLog = {
  label: string;
  model: string;
  ms: number;
  finishReason?: string;
  blockReason?: string;
  promptTokens?: number;
  outputTokens?: number;
  thoughtTokens?: number;
  text?: string;
  error?: string;
};

export const attempts: AttemptLog[] = [];
let label = "unlabelled";
export function setLabel(l: string) { label = l; }

type ModelsClient = Pick<GoogleGenAI, "models">;
let real: GoogleGenAI | null = null;

export function instrumentedGemini(): ModelsClient {
  real ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const r = real;
  const generateContent = async (args: Parameters<GoogleGenAI["models"]["generateContent"]>[0]) => {
    const t0 = performance.now();
    try {
      const res = await r.models.generateContent(args);
      const log: AttemptLog = {
        label, model: args.model, ms: Math.round(performance.now() - t0),
        finishReason: res.candidates?.[0]?.finishReason,
        blockReason: res.promptFeedback?.blockReason,
        promptTokens: res.usageMetadata?.promptTokenCount,
        outputTokens: res.usageMetadata?.candidatesTokenCount,
        thoughtTokens: res.usageMetadata?.thoughtsTokenCount,
        text: res.text,
      };
      attempts.push(log);
      dump(log);
      return res;
    } catch (e) {
      const log: AttemptLog = { label, model: args.model, ms: Math.round(performance.now() - t0), error: String((e as Error)?.message ?? e).slice(0, 500) };
      attempts.push(log);
      dump(log);
      throw e;
    }
  };
  return { models: { generateContent } as unknown as GoogleGenAI["models"] };
}

function dump(log: AttemptLog) {
  const file = process.env.LIVE_AI_DUMP;
  if (file) appendFileSync(file, JSON.stringify(log) + "\n");
}

/** End-to-end latencies per business function (ms). */
export const latencies: Record<string, number[]> = {};
export async function timed<T>(fn: string, run: () => Promise<T>): Promise<T> {
  const t0 = performance.now();
  try {
    return await run();
  } finally {
    (latencies[fn] ??= []).push(Math.round(performance.now() - t0));
  }
}

export function stats(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b);
  const pct = (p: number) => s[Math.min(s.length - 1, Math.floor(p * s.length))];
  return { n: s.length, p50: pct(0.5), max: s[s.length - 1], min: s[0] };
}

export function printLatency(title: string) {
  const rows = Object.entries(latencies).map(([fn, xs]) => ({ fn, ...stats(xs) }));
  const perAttempt = stats(attempts.filter((a) => !a.error).map((a) => a.ms));
  console.log(`\n[live latency] ${title}\n` + JSON.stringify({ endToEnd: rows, apiAttempts: { ...perAttempt, total: attempts.length } }, null, 2));
}

/** Lowercase, collapse whitespace, drop punctuation: for "does this appear in the source" checks. */
export function norm(s: string) {
  return s.toLowerCase().normalize("NFKC").replace(/[‐-―]/g, "-").replace(/[^\p{L}\p{N}%£$&+#.]+/gu, " ").replace(/\s+/g, " ").trim();
}
