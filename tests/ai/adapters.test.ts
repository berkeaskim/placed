import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { anthropicStructured } from "@/lib/ai/anthropic";
import { geminiStructured } from "@/lib/ai/gemini";
import { AiError, AI_BAD_FORMAT, AI_REFUSAL } from "@/lib/ai/provider";

const schema = z.object({ a: z.number() });
const req = { tier: "fast" as const, system: "sys", parts: [{ type: "text" as const, text: "hi" }], schema };

function anthropicStub(responses: { stop_reason: string; text: string }[]) {
  const create = vi.fn(async () => {
    const r = responses.shift()!;
    return { stop_reason: r.stop_reason, content: [{ type: "text", text: r.text }] };
  });
  return { client: { messages: { create } } as never, create };
}

function geminiStub(responses: { text?: string; finishReason?: string; blockReason?: string }[]) {
  const generateContent = vi.fn(async () => {
    const r = responses.shift()!;
    return {
      text: r.text,
      candidates: [{ finishReason: r.finishReason ?? "STOP" }],
      promptFeedback: r.blockReason ? { blockReason: r.blockReason } : undefined,
    };
  });
  return { client: { models: { generateContent } } as never, generateContent };
}

describe("anthropicStructured", () => {
  it("retries once after invalid output and returns the valid second answer", async () => {
    const { client, create } = anthropicStub([
      { stop_reason: "end_turn", text: '{"a":"not a number"}' },
      { stop_reason: "end_turn", text: '{"a":2}' },
    ]);
    await expect(anthropicStructured(req, client)).resolves.toEqual({ a: 2 });
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("throws a friendly AiError after two invalid outputs", async () => {
    const { client, create } = anthropicStub([
      { stop_reason: "end_turn", text: "not json" },
      { stop_reason: "max_tokens", text: '{"a":' },
    ]);
    const err = await anthropicStructured(req, client).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.message).toBe(AI_BAD_FORMAT);
    expect(create).toHaveBeenCalledTimes(2);
  });
  it("raises a refusal AiError without retrying", async () => {
    const { client, create } = anthropicStub([{ stop_reason: "refusal", text: "I can't help with that." }]);
    const err = await anthropicStructured(req, client).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.message).toBe(AI_REFUSAL);
    expect(create).toHaveBeenCalledTimes(1);
  });
  it("wraps transport errors in a user-readable AiError", async () => {
    const client = { messages: { create: vi.fn(async () => { throw new Error("ECONNRESET 10.0.0.1"); }) } } as never;
    const err = await anthropicStructured(req, client).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.message).not.toMatch(/ECONNRESET/);
  });
});

describe("geminiStructured", () => {
  it("retries once after invalid output and returns the valid second answer", async () => {
    const { client, generateContent } = geminiStub([{ text: "{oops" }, { text: '{"a":3}' }]);
    await expect(geminiStructured(req, client)).resolves.toEqual({ a: 3 });
    expect(generateContent).toHaveBeenCalledTimes(2);
  });
  it("throws a friendly AiError after two invalid outputs", async () => {
    const { client } = geminiStub([{ text: "{}" }, { text: "" }]);
    const err = await geminiStructured(req, client).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.message).toBe(AI_BAD_FORMAT);
  });
  it("treats a blocked prompt as a refusal without retrying", async () => {
    const { client, generateContent } = geminiStub([{ blockReason: "SAFETY" }]);
    const err = await geminiStructured(req, client).catch((e) => e);
    expect(err.message).toBe(AI_REFUSAL);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
  it("treats finishReason SAFETY as a refusal without retrying", async () => {
    const { client, generateContent } = geminiStub([{ text: "", finishReason: "SAFETY" }]);
    const err = await geminiStructured(req, client).catch((e) => e);
    expect(err).toBeInstanceOf(AiError);
    expect(err.message).toBe(AI_REFUSAL);
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
