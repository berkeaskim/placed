import { describe, it, expect, vi } from "vitest";
import { geminiGrounded } from "@/lib/ai/gemini";
import { AiError } from "@/lib/ai/provider";

const client = (res: unknown) => ({ models: { generateContent: vi.fn().mockResolvedValue(res) } }) as never;

describe("geminiGrounded", () => {
  it("returns the text and web chunks, and sends the googleSearch tool without a JSON schema", async () => {
    const c = client({
      text: "Candidates report a HireVue then a superday.",
      candidates: [{ finishReason: "STOP", groundingMetadata: { groundingChunks: [
        { web: { uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/a", title: "reddit.com" } },
        { retrievedContext: { uri: "x" } },
      ] } }],
    });
    const r = await geminiGrounded({ system: "s", prompt: "p" }, c);
    expect(r).toEqual({ text: "Candidates report a HireVue then a superday.", chunks: [{ uri: "https://vertexaisearch.cloud.google.com/grounding-api-redirect/a", title: "reddit.com" }] });
    const cfg = (c as { models: { generateContent: ReturnType<typeof vi.fn> } }).models.generateContent.mock.calls[0][0].config;
    expect(cfg.tools).toEqual([{ googleSearch: {} }]);
    expect(cfg.responseJsonSchema).toBeUndefined();
  });

  it("returns no chunks when the model did not search", async () => {
    const r = await geminiGrounded({ system: "s", prompt: "p" }, client({ text: "x", candidates: [{ finishReason: "STOP" }] }));
    expect(r.chunks).toEqual([]);
  });

  it("throws AiError on empty text and on refusal", async () => {
    await expect(geminiGrounded({ system: "s", prompt: "p" }, client({ text: "", candidates: [{ finishReason: "STOP" }] }))).rejects.toBeInstanceOf(AiError);
    await expect(geminiGrounded({ system: "s", prompt: "p" }, client({ text: "x", candidates: [{ finishReason: "SAFETY" }] }))).rejects.toBeInstanceOf(AiError);
  });
});
