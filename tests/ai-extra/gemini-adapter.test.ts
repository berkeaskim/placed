import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { geminiStructured } from "@/lib/ai/gemini";
import { AiError, AI_BAD_FORMAT, AI_REFUSAL, AI_UNAVAILABLE, type StructuredRequest } from "@/lib/ai/provider";

const schema = z.object({ a: z.number(), tag: z.enum(["x", "y"]) });
const req: StructuredRequest<z.infer<typeof schema>> = { tier: "fast", system: "sys", parts: [{ type: "text", text: "hi" }], schema };

type Fake = { text?: string; finishReason?: string; blockReason?: string; candidates?: null; throws?: unknown };

function stub(responses: Fake[]) {
  const generateContent = vi.fn(async (_args: unknown) => {
    const r = responses.shift();
    if (!r) throw new Error("unexpected extra call");
    if (r.throws) throw r.throws;
    return {
      text: r.text,
      candidates: r.candidates === null ? undefined : [{ finishReason: r.finishReason ?? "STOP" }],
      promptFeedback: r.blockReason ? { blockReason: r.blockReason } : undefined,
    };
  });
  return { client: { models: { generateContent } } as never, generateContent };
}

const fail = (p: Promise<unknown>) => p.then(() => { throw new Error("expected rejection"); }, (e) => e as AiError);

describe("geminiStructured: error paths", () => {
  it("SDK throws -> AI_UNAVAILABLE, cause kept, raw message hidden, no retry", async () => {
    const boom = new Error("429 RESOURCE_EXHAUSTED key=abc");
    const { client, generateContent } = stub([{ throws: boom }]);
    const err = await fail(geminiStructured(req, client));
    expect(err).toBeInstanceOf(AiError);
    expect(err.message).toBe(AI_UNAVAILABLE);
    expect(err.message).not.toMatch(/429|key=/);
    expect((err as Error & { cause?: unknown }).cause).toBe(boom);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("SDK throws on the retry (after a bad first answer) -> AI_UNAVAILABLE", async () => {
    const { client, generateContent } = stub([{ text: "nope" }, { throws: new Error("socket hang up") }]);
    const err = await fail(geminiStructured(req, client));
    expect(err.message).toBe(AI_UNAVAILABLE);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it.each(["SAFETY", "RECITATION", "BLOCKLIST", "PROHIBITED_CONTENT", "SPII", "IMAGE_SAFETY"])(
    "finishReason %s -> AI_REFUSAL without retry, even if text looks valid", async (finishReason) => {
      const { client, generateContent } = stub([{ text: '{"a":1,"tag":"x"}', finishReason }]);
      const err = await fail(geminiStructured(req, client));
      expect(err).toBeInstanceOf(AiError);
      expect(err.message).toBe(AI_REFUSAL);
      expect(generateContent).toHaveBeenCalledTimes(1);
    });

  it.each(["SAFETY", "OTHER", "BLOCKLIST", "PROHIBITED_CONTENT"])("promptFeedback.blockReason %s -> AI_REFUSAL", async (blockReason) => {
    const { client, generateContent } = stub([{ blockReason, candidates: null }]);
    const err = await fail(geminiStructured(req, client));
    expect(err.message).toBe(AI_REFUSAL);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });

  it("refusal on the retry still surfaces as AI_REFUSAL", async () => {
    const { client } = stub([{ text: "{bad" }, { text: "", finishReason: "SAFETY" }]);
    expect((await fail(geminiStructured(req, client))).message).toBe(AI_REFUSAL);
  });

  it("invalid JSON twice -> AI_BAD_FORMAT after exactly 2 calls", async () => {
    const { client, generateContent } = stub([{ text: "{oops" }, { text: "Here is your JSON: {" }]);
    const err = await fail(geminiStructured(req, client));
    expect(err.message).toBe(AI_BAD_FORMAT);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("invalid then valid -> success after one retry", async () => {
    const { client, generateContent } = stub([{ text: "{oops" }, { text: '{"a":3,"tag":"y"}' }]);
    await expect(geminiStructured(req, client)).resolves.toEqual({ a: 3, tag: "y" });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("schema-mismatch JSON twice -> AI_BAD_FORMAT", async () => {
    const { client, generateContent } = stub([{ text: '{"a":"3","tag":"x"}' }, { text: '{"a":3,"tag":"z"}' }]);
    expect((await fail(geminiStructured(req, client))).message).toBe(AI_BAD_FORMAT);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("schema-mismatch then valid -> success", async () => {
    const { client } = stub([{ text: '{"a":1}' }, { text: '{"a":1,"tag":"x"}' }]);
    await expect(geminiStructured(req, client)).resolves.toEqual({ a: 1, tag: "x" });
  });

  it("empty / undefined text -> retried, then AI_BAD_FORMAT", async () => {
    const { client, generateContent } = stub([{ text: "" }, { text: undefined }]);
    expect((await fail(geminiStructured(req, client))).message).toBe(AI_BAD_FORMAT);
    expect(generateContent).toHaveBeenCalledTimes(2);
  });

  it("MAX_TOKENS truncated JSON then a full answer -> success", async () => {
    const { client } = stub([{ text: '{"a":1,"ta', finishReason: "MAX_TOKENS" }, { text: '{"a":1,"tag":"x"}' }]);
    await expect(geminiStructured(req, client)).resolves.toEqual({ a: 1, tag: "x" });
  });

  it("valid JSON with no candidates array is still accepted", async () => {
    const { client } = stub([{ text: '{"a":5,"tag":"x"}', candidates: null }]);
    await expect(geminiStructured(req, client)).resolves.toEqual({ a: 5, tag: "x" });
  });

  it("strips extra keys the schema does not know (zod default) rather than failing", async () => {
    const { client } = stub([{ text: '{"a":5,"tag":"x","injected":true}' }]);
    await expect(geminiStructured(req, client)).resolves.toEqual({ a: 5, tag: "x" });
  });
});

describe("geminiStructured: request shape", () => {
  it("maps tier to model, sends JSON schema, system prompt and default maxOutputTokens", async () => {
    const { client, generateContent } = stub([{ text: '{"a":1,"tag":"x"}' }, { text: '{"a":1,"tag":"x"}' }]);
    await geminiStructured(req, client);
    await geminiStructured({ ...req, tier: "smart", maxTokens: 123 }, client);
    const [fast, smart] = generateContent.mock.calls.map((c) => c[0] as { model: string; config: Record<string, unknown>; contents: unknown });
    expect(fast.model).toBe("gemini-3.8-flash");
    expect(smart.model).toBe("gemini-3.1-pro-preview");
    expect(fast.config).toMatchObject({ systemInstruction: "sys", responseMimeType: "application/json", maxOutputTokens: 16000 });
    expect(fast.config.responseJsonSchema).toEqual(z.toJSONSchema(schema));
    expect(smart.config.maxOutputTokens).toBe(123);
  });

  it("sends PDFs as inlineData and text as text parts, in order", async () => {
    const { client, generateContent } = stub([{ text: '{"a":1,"tag":"x"}' }]);
    await geminiStructured({ ...req, parts: [{ type: "pdf", base64: "JVBERi0=" }, { type: "text", text: "Parse this CV." }] }, client);
    const args = generateContent.mock.calls[0][0] as { contents: { role: string; parts: unknown[] }[] };
    expect(args.contents).toEqual([{ role: "user", parts: [{ inlineData: { mimeType: "application/pdf", data: "JVBERi0=" } }, { text: "Parse this CV." }] }]);
  });
});
