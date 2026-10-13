import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { anthropicStructured } from "@/lib/ai/anthropic";
import { geminiStructured } from "@/lib/ai/gemini";

/**
 * Task 23a fix round 1: models released after Claude Opus 4.6 reject any `temperature` with a 400
 * (@anthropic-ai/sdk 0.133 messages.d.ts). The Anthropic adapter must never send it; Gemini still gets it.
 */
const schema = z.object({ a: z.number() });
const base = { system: "sys", parts: [{ type: "text" as const, text: "hi" }], schema, temperature: 0.2 };

describe("temperature per provider", () => {
  for (const tier of ["smart", "fast"] as const) {
    it(`Anthropic (${tier}: ${tier === "smart" ? "claude-sonnet-5-5" : "claude-haiku-4-5"}) gets no temperature key`, async () => {
      const create = vi.fn<(body: Record<string, unknown>) => Promise<unknown>>(async () => ({ stop_reason: "end_turn", content: [{ type: "text", text: '{"a":1}' }] }));
      await anthropicStructured({ ...base, tier }, { messages: { create } } as never);
      const body = create.mock.calls[0][0];
      expect(body.model).toBe(tier === "smart" ? "claude-sonnet-5-5" : "claude-haiku-4-5");
      expect(body).not.toHaveProperty("temperature");
    });
  }
  it("Gemini still receives the requested temperature", async () => {
    const generateContent = vi.fn<(body: { config: Record<string, unknown> }) => Promise<unknown>>(async () => ({ text: '{"a":1}', candidates: [{ finishReason: "STOP" }] }));
    await geminiStructured({ ...base, tier: "smart" }, { models: { generateContent } } as never);
    expect(generateContent.mock.calls[0][0].config.temperature).toBe(0.2);
  });
});
