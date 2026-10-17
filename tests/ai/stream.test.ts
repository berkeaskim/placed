import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { anthropicStream } from "@/lib/ai/anthropic";
import { geminiStream } from "@/lib/ai/gemini";
import { ollamaStream } from "@/lib/ai/ollama";
import { AiError, AI_UNAVAILABLE, streamText } from "@/lib/ai/provider";

const req = { tier: "fast" as const, system: "sys", prompt: "write" };
const CHUNKS = ["Dear ", "Hiring ", "Manager,"];

async function collect(it: AsyncIterable<string>): Promise<string[]> {
  const out: string[] = [];
  for await (const c of it) out.push(c);
  return out;
}

const textDelta = (text: string) => ({ type: "content_block_delta", delta: { type: "text_delta", text } });
function anthropicClient(events: unknown[]) {
  const stream = vi.fn(() => (async function* () { for (const e of events) yield e; })());
  return { client: { messages: { stream } } as never, stream };
}
function geminiClient(chunks: { text?: string; finishReason?: string }[]) {
  const generateContentStream = vi.fn(async () =>
    (async function* () { for (const c of chunks) yield { text: c.text, candidates: [{ finishReason: c.finishReason ?? "STOP" }] }; })());
  return { client: { models: { generateContentStream } } as never, generateContentStream };
}
function ollamaFetch(pieces: string[]) {
  return vi.fn(async () => {
    const enc = new TextEncoder();
    return new Response(new ReadableStream({ start(c) { for (const p of pieces) c.enqueue(enc.encode(p)); c.close(); } }), { status: 200 });
  });
}
const ndjson = (...c: string[]) => c.map((t) => JSON.stringify({ message: { content: t }, done: false }) + "\n");

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe("anthropicStream", () => {
  it("yields each text delta", async () => {
    const { client, stream } = anthropicClient([{ type: "message_start" }, ...CHUNKS.map(textDelta), { type: "message_delta", delta: { stop_reason: "end_turn" } }]);
    expect(await collect(anthropicStream(req, client))).toEqual(CHUNKS);
    expect(stream).toHaveBeenCalledTimes(1);
  });
  it("stops when the signal is aborted", async () => {
    const ac = new AbortController();
    const { client } = anthropicClient(CHUNKS.map(textDelta));
    const got: string[] = [];
    for await (const c of anthropicStream({ ...req, signal: ac.signal }, client)) { got.push(c); ac.abort(); }
    expect(got).toEqual(["Dear "]);
  });
  it("maps a refusal and transport errors to AiError", async () => {
    const { client } = anthropicClient([{ type: "message_delta", delta: { stop_reason: "refusal" } }]);
    await expect(collect(anthropicStream(req, client))).rejects.toBeInstanceOf(AiError);
    const bad = { messages: { stream: () => { throw new Error("ECONNRESET"); } } } as never;
    await expect(collect(anthropicStream(req, bad))).rejects.toThrow(AI_UNAVAILABLE);
  });
});

describe("geminiStream", () => {
  it("yields each chunk's text", async () => {
    const { client, generateContentStream } = geminiClient(CHUNKS.map((text) => ({ text })));
    expect(await collect(geminiStream(req, client))).toEqual(CHUNKS);
    expect(JSON.stringify(generateContentStream.mock.calls[0])).toContain("LOW");
  });
  it("stops when the signal is aborted", async () => {
    const ac = new AbortController();
    const { client } = geminiClient(CHUNKS.map((text) => ({ text })));
    const got: string[] = [];
    for await (const c of geminiStream({ ...req, signal: ac.signal }, client)) { got.push(c); ac.abort(); }
    expect(got).toEqual(["Dear "]);
  });
  it("treats a SAFETY finish as a refusal", async () => {
    const { client } = geminiClient([{ text: "", finishReason: "SAFETY" }]);
    await expect(collect(geminiStream(req, client))).rejects.toBeInstanceOf(AiError);
  });
});

describe("ollamaStream", () => {
  it("yields message.content per NDJSON line, even when lines split across reads", async () => {
    vi.stubEnv("OLLAMA_MODEL", "test-model");
    const lines = ndjson(...CHUNKS);
    const joined = lines.join("");
    const cut = Math.floor(joined.length / 2);
    const f = ollamaFetch([joined.slice(0, cut), joined.slice(cut)]);
    expect(await collect(ollamaStream(req, f))).toEqual(CHUNKS);
    const body = JSON.parse((f.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.stream).toBe(true);
  });
  it("stops when the signal is aborted", async () => {
    vi.stubEnv("OLLAMA_MODEL", "test-model");
    const ac = new AbortController();
    const got: string[] = [];
    for await (const c of ollamaStream({ ...req, signal: ac.signal }, ollamaFetch(ndjson(...CHUNKS)))) { got.push(c); ac.abort(); }
    expect(got).toEqual(["Dear "]);
  });
  it("wraps an HTTP failure in AiError", async () => {
    vi.stubEnv("OLLAMA_MODEL", "test-model");
    const f = vi.fn(async () => new Response("boom", { status: 500 }));
    await expect(collect(ollamaStream(req, f))).rejects.toThrow(AI_UNAVAILABLE);
  });
});

describe("ollamaStream slot release", () => {
  // Default OLLAMA_PARALLEL=1: a leaked slot would make the follow-up call wait forever, so it is raced against a timer.
  async function followUpCompletes() {
    const next = collect(ollamaStream(req, ollamaFetch(ndjson("ok"))));
    const timer = new Promise<string>((r) => setTimeout(() => r("LEAKED"), 1000));
    expect(await Promise.race([next, timer])).toEqual(["ok"]);
  }
  it("frees the slot when the consumer breaks early", async () => {
    vi.stubEnv("OLLAMA_MODEL", "test-model");
    for await (const _ of ollamaStream(req, ollamaFetch(ndjson(...CHUNKS)))) break;
    await followUpCompletes();
  });
  it("frees the slot when aborted mid-stream", async () => {
    vi.stubEnv("OLLAMA_MODEL", "test-model");
    const ac = new AbortController();
    for await (const _ of ollamaStream({ ...req, signal: ac.signal }, ollamaFetch(ndjson(...CHUNKS)))) ac.abort();
    await followUpCompletes();
  });
  it("frees the slot when the fetch throws", async () => {
    vi.stubEnv("OLLAMA_MODEL", "test-model");
    const f = vi.fn(async () => { throw new Error("down"); });
    await expect(collect(ollamaStream(req, f))).rejects.toThrow(AI_UNAVAILABLE);
    await followUpCompletes();
  });
  it("does not send a request when already aborted", async () => {
    vi.stubEnv("OLLAMA_MODEL", "test-model");
    const f = ollamaFetch(ndjson("x"));
    expect(await collect(ollamaStream({ ...req, signal: AbortSignal.abort() }, f))).toEqual([]);
    expect(f).not.toHaveBeenCalled();
    await followUpCompletes();
  });
});

describe("streamText fixture mode", () => {
  function withFixture(fn: string, key: string, text: string) {
    const root = mkdtempSync(path.join(os.tmpdir(), "stream-fixture-"));
    mkdirSync(path.join(root, "fixtures", "ai", fn), { recursive: true });
    writeFileSync(path.join(root, "fixtures", "ai", fn, `${key}.txt`), text);
    vi.spyOn(process, "cwd").mockReturnValue(root);
  }
  it("replays the file in 1-3 word chunks that join back to the full text", async () => {
    vi.stubEnv("AI_MODE", "fixture");
    const text = "Dear team,\n\nI am writing to apply for the analyst role at your firm. Yours sincerely, Sam";
    withFixture("letter", "default", text);
    const chunks = await collect(streamText(req, { fn: "letter" }));
    expect(chunks.join("")).toBe(text);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) expect(c.trim().split(/\s+/).length).toBeLessThanOrEqual(3);
  });
  it("prefers the keyed fixture and yields nothing without one", async () => {
    vi.stubEnv("AI_MODE", "fixture");
    withFixture("letter", "short", "Hi there");
    expect((await collect(streamText(req, { fn: "letter", fixtureKey: "short" }))).join("")).toBe("Hi there");
    expect(await collect(streamText(req, { fn: "missing" }))).toEqual([]);
  });
  it("stops replaying when aborted", async () => {
    vi.stubEnv("AI_MODE", "fixture");
    withFixture("letter", "default", "one two three four five six seven eight nine");
    const ac = new AbortController();
    const got: string[] = [];
    for await (const c of streamText({ ...req, signal: ac.signal }, { fn: "letter" })) { got.push(c); ac.abort(); }
    expect(got).toHaveLength(1);
  });
});
