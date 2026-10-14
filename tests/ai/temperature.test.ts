import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { anthropicStructured } from "@/lib/ai/anthropic";
import { geminiStructured, geminiAcceptsTemperature } from "@/lib/ai/gemini";
import { GEMINI_MODELS } from "@/lib/ai/models";

/**
 * Task 23a fix round 1: models released after Claude Opus 4.6 reject any `temperature` with a 400
 * (@anthropic-ai/sdk 0.133 messages.d.ts). The Anthropic adapter must never send it.
 * Final review: Google advises keeping Gemini 3 models at their default temperature, so the Gemini
 * adapter drops it for gemini-3* ids too. Net effect: no adapter sends temperature for current models.
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
    it(`Gemini (${tier}: ${GEMINI_MODELS[tier]}) gets no temperature key (Gemini 3 default)`, async () => {
      const generateContent = vi.fn<(body: { model: string; config: Record<string, unknown> }) => Promise<unknown>>(async () => ({ text: '{"a":1}', candidates: [{ finishReason: "STOP" }] }));
      await geminiStructured({ ...base, tier }, { models: { generateContent } } as never);
      const body = generateContent.mock.calls[0][0];
      expect(body.model).toBe(GEMINI_MODELS[tier]);
      expect(body.config).not.toHaveProperty("temperature");
    });
  }
  it("only pre-Gemini-3 ids would honour temperature", () => {
    expect(geminiAcceptsTemperature("gemini-3.1-pro-preview")).toBe(false);
    expect(geminiAcceptsTemperature("gemini-3.8-flash")).toBe(false);
    expect(geminiAcceptsTemperature("gemini-2.5-flash")).toBe(true);
  });
});
