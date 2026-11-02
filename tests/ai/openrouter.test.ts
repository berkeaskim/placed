import { describe, it, expect, vi, beforeEach } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { z } from "zod";
import { openrouterGrounded, openrouterKeyInfo, openrouterStream, openrouterStructured, type Fetch } from "@/lib/ai/openrouter";
import { aiProvider } from "@/lib/ai/config";
import { currentModelId, OPENROUTER_MODELS } from "@/lib/ai/models";
import { AI_BAD_FORMAT, AI_UNAVAILABLE } from "@/lib/ai/provider";
import { saveKeyAction, setTierModelAction, testConnectionAction } from "@/app/(app)/settings/ai/actions";
import { readHealth, writeHealth } from "@/lib/ai/health";
import { getSecret, getSetting, setSecret, setSetting } from "@/lib/settings/store";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const answer = (content: string, finish = "stop") => json({ choices: [{ message: { content }, finish_reason: finish }] });

/** A fake fetch that records request bodies and replies in order. */
function fakeFetch(replies: Response[]) {
  const calls: { url: string; body: Record<string, unknown>; auth: string | null }[] = [];
  const f = (async (url: string | URL, init?: RequestInit) => {
    calls.push({ url: String(url), body: init?.body ? JSON.parse(String(init.body)) : {}, auth: new Headers(init?.headers).get("authorization") });
    return replies.shift()!;
  }) as unknown as Fetch;
  return { f, calls };
}

beforeEach(() => {
  for (const k of ["AI_PROVIDER", "OPENROUTER_API_KEY", "ANTHROPIC_API_KEY", "GEMINI_API_KEY", "OLLAMA_MODEL"]) delete process.env[k];
  for (const k of ["ai.provider", "ai.openrouter.model.fast", "ai.openrouter.model.smart", "ai.codex.enabled", "ai.ollama.model"]) setSetting(k, null);
  setSecret("ai.openrouter.key", "sk-or-v1-test");
  setSecret("ai.anthropic.key", null);
  setSecret("ai.gemini.key", null);
});

describe("openrouterStructured", () => {
  const schema = z.object({ ok: z.boolean(), note: z.string().optional() });
  const req = { tier: "smart" as const, system: "sys", parts: [{ type: "text" as const, text: "hi" }], schema };

  it("asks for strict JSON-schema output on the tier's model and parses it", async () => {
    const { f, calls } = fakeFetch([answer('{"ok":true,"note":null}')]);
    expect(await openrouterStructured(req, f)).toEqual({ ok: true });
    expect(calls[0].url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(calls[0].auth).toBe("Bearer sk-or-v1-test");
    expect(calls[0].body.model).toBe(OPENROUTER_MODELS.smart);
    expect(calls[0].body.response_format).toMatchObject({ type: "json_schema", json_schema: { strict: true, schema: { required: ["ok", "note"] } } });
    expect(calls[0].body.provider).toEqual({ require_parameters: true });
  });

  it("uses the model picked in settings", async () => {
    setSetting("ai.openrouter.model.smart", "openai/gpt-5.6-luna");
    const { f, calls } = fakeFetch([answer('{"ok":true}')]);
    await openrouterStructured(req, f);
    expect(calls[0].body.model).toBe("openai/gpt-5.6-luna");
    const mode = process.env.AI_MODE;
    delete process.env.AI_MODE; // vitest runs in fixture mode
    expect(currentModelId("smart")).toBe("openrouter:openai/gpt-5.6-luna");
    process.env.AI_MODE = mode;
  });

  it("falls back to JSON mode with the schema in the prompt when the model can't do structured output", async () => {
    const { f, calls } = fakeFetch([json({ error: { message: "No endpoints found that support response_format" } }, 404), answer('```json\n{"ok":false}\n```')]);
    expect(await openrouterStructured(req, f)).toEqual({ ok: false });
    expect(calls[1].body.response_format).toEqual({ type: "json_object" });
    expect(String((calls[1].body.messages as { content: string }[])[0].content)).toContain('"required"');
  });

  it("retries once on a truncated or invalid answer, then gives AI_BAD_FORMAT", async () => {
    const { f, calls } = fakeFetch([answer('{"ok":', "length"), answer("nope")]);
    await expect(openrouterStructured(req, f)).rejects.toThrow(AI_BAD_FORMAT);
    expect(calls).toHaveLength(2);
  });

  it("an HTTP error (bad key, no credit) is AI_UNAVAILABLE with OpenRouter's reason as the cause", async () => {
    const { f } = fakeFetch([json({ error: { message: "Insufficient credits" } }, 402)]);
    const err = (await openrouterStructured(req, f).catch((e) => e)) as Error;
    expect(err.message).toBe(AI_UNAVAILABLE);
    expect((err.cause as Error).message).toContain("Insufficient credits");
  });
});

describe("openrouterStream / grounded / key", () => {
  it("streams content deltas from server-sent events, skipping keep-alives", async () => {
    const sse = [": OPENROUTER PROCESSING", 'data: {"choices":[{"delta":{"content":"Dear "}}]}', 'data: {"choices":[{"delta":{"content":"team"}}]}', "data: [DONE]", ""].join("\n");
    const { f, calls } = fakeFetch([new Response(sse, { status: 200 })]);
    let out = "";
    for await (const d of openrouterStream({ tier: "smart", system: "s", prompt: "p" }, f)) out += d;
    expect(out).toBe("Dear team");
    expect(calls[0].body.stream).toBe(true);
  });

  it("grounded answers use the web plugin and return de-duplicated citations", async () => {
    const { f, calls } = fakeFetch([
      json({ choices: [{ message: { content: "Acme makes rockets.", annotations: [
        { type: "url_citation", url_citation: { url: "https://acme.com", title: "Acme" } },
        { type: "url_citation", url_citation: { url: "https://acme.com", title: "Acme" } },
      ] } }] }),
    ]);
    expect(await openrouterGrounded({ system: "s", prompt: "Acme?" }, f)).toEqual({ text: "Acme makes rockets.", chunks: [{ uri: "https://acme.com", title: "Acme" }] });
    expect(calls[0].body.plugins).toEqual([{ id: "web", max_results: 5 }]);
  });

  it("checks a key without a model call", async () => {
    const { f, calls } = fakeFetch([json({ data: { label: "sk-or…", usage: 1.5, limit_remaining: null } })]);
    expect(await openrouterKeyInfo("sk-or-v1-abc", f)).toEqual({ label: "sk-or…", usage: 1.5, limitRemaining: null });
    expect(calls[0].url).toBe("https://openrouter.ai/api/v1/key");
  });
});

describe("OpenRouter in settings", () => {
  it("a saved key makes OpenRouter the provider", () => {
    expect(aiProvider()).toBe("openrouter");
    setSecret("ai.openrouter.key", null);
    expect(aiProvider()).toBeNull();
  });

  it("an OpenRouter key is checked with OpenRouter before it is saved", async () => {
    setSecret("ai.openrouter.key", null);
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(json({ error: { message: "User not found." } }, 401));
    const r = await saveKeyAction("openrouter", "sk-or-v1-wrong-key-000");
    expect(r.ok).toBe(false);
    expect(getSecret("ai.openrouter.key")).toBeNull();
    spy.mockResolvedValueOnce(json({ data: { usage: 0 } }));
    expect((await saveKeyAction("openrouter", "sk-or-v1-good-key-000")).ok).toBe(true);
    expect(getSecret("ai.openrouter.key")).toBe("sk-or-v1-good-key-000");
    expect(getSetting("ai.provider")).toBe("openrouter");
    spy.mockRestore();
  });

  it("the connection test records whether the chosen model answers; changing the model clears it", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(answer('{"ok":true}'));
    const r = await testConnectionAction("openrouter", "smart");
    expect(r.ok).toBe(true);
    expect(readHealth("openrouter", "smart")).toMatchObject({ ok: true, model: OPENROUTER_MODELS.smart });
    spy.mockResolvedValueOnce(json({ error: { message: "Model not found" } }, 400));
    expect((await testConnectionAction("openrouter", "smart")).ok).toBe(false);
    expect(readHealth("openrouter", "smart")).toMatchObject({ ok: false });
    expect(readHealth("openrouter", "smart")?.error).toContain("Model not found");
    await setTierModelAction("openrouter", "smart", "openai/gpt-5.6-luna");
    expect(readHealth("openrouter", "smart")).toBeNull();
    expect(getSetting("ai.openrouter.model.smart")).toBe("openai/gpt-5.6-luna");
    spy.mockRestore();
    writeHealth("openrouter", "smart", null);
  });
});
