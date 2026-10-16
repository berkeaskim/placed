import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { z } from "zod";
import { ollamaStructured, ollamaStatus, ollamaPull, extractJson, isInstalled } from "@/lib/ai/ollama";
import { AiError, AI_BAD_FORMAT, AI_UNAVAILABLE } from "@/lib/ai/provider";
import { setSetting } from "@/lib/settings/store";

const schema = z.object({ a: z.number() });
const req = { tier: "fast" as const, system: "sys", parts: [{ type: "text" as const, text: "hi" }], schema };

/** An /api/chat NDJSON stream that answers `content` in two chunks. */
function chatBody(content: string, doneReason = "stop") {
  const half = Math.floor(content.length / 2);
  return [
    { message: { role: "assistant", content: content.slice(0, half) }, done: false },
    { message: { role: "assistant", content: content.slice(half) }, done: false },
    { message: { role: "assistant", content: "" }, done: true, done_reason: doneReason },
  ].map((c) => JSON.stringify(c)).join("\n") + "\n";
}

function fetchStub(bodies: (string | Error)[]) {
  return vi.fn(async (...args: [string, RequestInit?]) => {
    void args;
    const b = bodies.shift()!;
    if (b instanceof Error) throw b;
    return new Response(b, { status: 200, headers: { "content-type": "application/x-ndjson" } });
  });
}

const saved = { host: process.env.OLLAMA_HOST, model: process.env.OLLAMA_MODEL };
beforeEach(() => {
  delete process.env.OLLAMA_HOST;
  delete process.env.OLLAMA_MODEL;
  for (const k of ["ai.ollama.host", "ai.ollama.model", "ai.ollama.model.fast", "ai.ollama.model.smart"]) setSetting(k, null);
  setSetting("ai.ollama.model", "qwen3.5:9b");
});
afterEach(() => {
  for (const [k, v] of [["OLLAMA_HOST", saved.host], ["OLLAMA_MODEL", saved.model]] as const) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
});

describe("ollamaStructured", () => {
  it("posts to /api/chat with the zod JSON schema as `format` and returns the validated answer", async () => {
    const f = fetchStub([chatBody('{"a":1}')]);
    await expect(ollamaStructured(req, f)).resolves.toEqual({ a: 1 });
    expect(f).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:11434/api/chat");
    const body = JSON.parse(String(init!.body));
    expect(body.model).toBe("qwen3.5:9b");
    expect(body.format).toMatchObject({ type: "object", properties: { a: { type: "number" } }, required: ["a"] });
    expect(body.think).toBe(false);
    expect(body.messages[0]).toMatchObject({ role: "system" });
    expect(body.messages[1]).toEqual({ role: "user", content: "hi" });
    expect(body.options.num_ctx).toBeGreaterThanOrEqual(8192);
  });

  it("accepts a single non-streamed JSON object and strips <think> blocks / code fences", async () => {
    const f = fetchStub([JSON.stringify({ message: { content: '<think>hmm</think>\n```json\n{"a":5}\n```' }, done: true, done_reason: "stop" })]);
    await expect(ollamaStructured(req, f)).resolves.toEqual({ a: 5 });
  });

  it("retries once after bad JSON, telling the model what went wrong", async () => {
    const f = fetchStub([chatBody("not json at all"), chatBody('{"a":2}')]);
    await expect(ollamaStructured(req, f)).resolves.toEqual({ a: 2 });
    expect(f).toHaveBeenCalledTimes(2);
    const retry = JSON.parse(String(f.mock.calls[1][1]!.body));
    expect(retry.messages).toHaveLength(4);
    expect(retry.messages[3].content).toMatch(/not valid JSON/);
  });

  it("retries a truncated (done_reason=length) answer, then gives up with AI_BAD_FORMAT", async () => {
    const f = fetchStub([chatBody('{"a":', "length"), chatBody('{"a":"x"}')]);
    const err = await ollamaStructured(req, f).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.message).toBe(AI_BAD_FORMAT);
    expect(f).toHaveBeenCalledTimes(2);
  });

  it("maps connection refused to AI_UNAVAILABLE without retrying", async () => {
    const refused = Object.assign(new TypeError("fetch failed"), { cause: Object.assign(new Error("connect ECONNREFUSED 127.0.0.1:11434"), { code: "ECONNREFUSED" }) });
    const f = fetchStub([refused]);
    const err = await ollamaStructured(req, f).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.message).toBe(AI_UNAVAILABLE);
    expect(err.message).not.toMatch(/ECONNREFUSED/);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("maps an HTTP error (model not installed) and an in-stream error to AI_UNAVAILABLE", async () => {
    const f404 = vi.fn(async () => new Response('{"error":"model \\"x\\" not found, try pulling it first"}', { status: 404 }));
    expect((await ollamaStructured(req, f404).catch((e) => e)).message).toBe(AI_UNAVAILABLE);
    const fErr = fetchStub([JSON.stringify({ error: "out of memory" }) + "\n"]);
    expect((await ollamaStructured(req, fErr).catch((e) => e)).message).toBe(AI_UNAVAILABLE);
  });

  it("uses the per-tier model, the setting host and env OLLAMA_HOST (env wins)", async () => {
    setSetting("ai.ollama.model.smart", "qwen3.8:27b");
    setSetting("ai.ollama.host", "http://box.local:11434/");
    let f = fetchStub([chatBody('{"a":1}')]);
    await ollamaStructured({ ...req, tier: "smart" }, f);
    expect(f.mock.calls[0][0]).toBe("http://box.local:11434/api/chat");
    expect(JSON.parse(String(f.mock.calls[0][1]!.body)).model).toBe("qwen3.8:27b");
    process.env.OLLAMA_HOST = "10.0.0.5:11434";
    f = fetchStub([chatBody('{"a":1}')]);
    await ollamaStructured(req, f);
    expect(f.mock.calls[0][0]).toBe("http://10.0.0.5:11434/api/chat");
    expect(JSON.parse(String(f.mock.calls[0][1]!.body)).model).toBe("qwen3.5:9b"); // fast falls back to ai.ollama.model
  });

  it("sends PDF parts as extracted text (unpdf)", async () => {
    const base64 = readFileSync("tests/linkedin/fixtures/ayse-synthetic-export.pdf").toString("base64");
    const f = fetchStub([chatBody('{"a":1}')]);
    await ollamaStructured({ ...req, parts: [{ type: "pdf", base64 }, { type: "text", text: "Parse it." }] }, f);
    const user = JSON.parse(String(f.mock.calls[0][1]!.body)).messages[1].content as string;
    expect(user).toMatch(/^<document type="pdf">\n/);
    expect(user).toMatch(/Ay/);
    expect(user.endsWith("Parse it.")).toBe(true);
  });

  it("throws AI_UNAVAILABLE when no model is configured", async () => {
    setSetting("ai.ollama.model", null);
    const f = fetchStub([]);
    expect((await ollamaStructured(req, f).catch((e) => e)).message).toBe(AI_UNAVAILABLE);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("ollama helpers", () => {
  it("extractJson leaves plain JSON alone", () => {
    expect(extractJson('  {"a":1} ')).toBe('{"a":1}');
  });
  it("isInstalled treats a bare name as :latest", () => {
    expect(isInstalled("gemma3", [{ name: "gemma3:latest" }])).toBe(true);
    expect(isInstalled("qwen3.5:9b", [{ name: "qwen3.5:4b" }])).toBe(false);
  });
  it("ollamaStatus reports installed models, or not running when the host refuses", async () => {
    const f = vi.fn(async (url: string) =>
      url.endsWith("/api/tags")
        ? Response.json({ models: [{ name: "qwen3.5:9b", size: 6_600_000_000, details: { parameter_size: "9B", quantization_level: "Q4_K_M" } }] })
        : Response.json({ version: "0.33.2" }),
    );
    await expect(ollamaStatus(f, "http://h")).resolves.toEqual({
      running: true, host: "http://h", version: "0.33.2",
      models: [{ name: "qwen3.5:9b", sizeBytes: 6_600_000_000, parameterSize: "9B", quantization: "Q4_K_M" }],
    });
    const down = vi.fn(async () => { throw new TypeError("fetch failed"); });
    await expect(ollamaStatus(down, "http://h")).resolves.toMatchObject({ running: false });
  });
  it("ollamaPull rejects a malformed tag before calling Ollama", async () => {
    const f = vi.fn();
    await expect(ollamaPull("qwen; rm -rf /", f)).rejects.toBeInstanceOf(AiError);
    await expect(ollamaPull("../etc", f)).rejects.toBeInstanceOf(AiError);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("ollamaStructured queueing", () => {
  it("sends one request at a time to Ollama", async () => {
    let inFlight = 0;
    let peak = 0;
    const f = vi.fn(async () => {
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 10));
      inFlight--;
      return new Response(chatBody('{"a":1}'), { status: 200 });
    });
    const out = await Promise.all([1, 2, 3].map(() => ollamaStructured(req, f)));
    expect(out).toEqual([{ a: 1 }, { a: 1 }, { a: 1 }]);
    expect(f).toHaveBeenCalledTimes(3);
    expect(peak).toBe(1);
  });

  it("frees the slot when a call fails", async () => {
    const f = fetchStub([new Error("ECONNREFUSED"), chatBody('{"a":2}')]);
    await expect(ollamaStructured(req, f)).rejects.toThrow(AI_UNAVAILABLE);
    await expect(ollamaStructured(req, f)).resolves.toEqual({ a: 2 });
  });
});

describe("ollamaStructured priority", () => {
  it("serves waiting interactive calls before waiting background ones", async () => {
    const order: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const f = vi.fn(async (_u: string, init?: RequestInit) => {
      const tag = JSON.parse(String(init?.body)).messages[1].content as string;
      order.push(tag);
      if (tag === "first") await gate;
      return new Response(chatBody('{"a":1}'), { status: 200 });
    });
    const call = (text: string, background: boolean) =>
      ollamaStructured({ ...req, parts: [{ type: "text", text }], background }, f);
    const first = call("first", true);
    await new Promise((r) => setTimeout(r, 0));
    const rest = [call("bg1", true), call("bg2", true), call("user", false)];
    release();
    await Promise.all([first, ...rest]);
    expect(order).toEqual(["first", "user", "bg1", "bg2"]);
  });
});
