import { describe, it, expect, afterAll } from "vitest";
import { z } from "zod";
import * as schemas from "@/lib/ai/schemas";
import { geminiStructured } from "@/lib/ai/gemini";
import { AiError, AI_BAD_FORMAT } from "@/lib/ai/provider";
import { LIVE, attempts, instrumentedGemini, printLatency, setLabel, timed } from "./_harness";

const ZOD_EXPORTS = Object.entries(schemas).filter(([, v]) => v instanceof z.ZodType) as [string, z.ZodType][];

describe.skipIf(!LIVE)("every lib/ai/schemas.ts zod schema is accepted by Gemini responseJsonSchema", () => {
  afterAll(() => printLatency("schemas"));

  it("finds the schemas", () => {
    expect(ZOD_EXPORTS.map(([k]) => k).sort()).toEqual(expect.arrayContaining(["ArchetypeScoreOut", "ParsedCvOutput", "RequirementOut", "TagJobOutput"]));
  });

  for (const [name, schema] of ZOD_EXPORTS) {
    it(`${name}: converts with z.toJSONSchema and round-trips a live answer`, async () => {
      const json = z.toJSONSchema(schema) as Record<string, unknown>;
      expect(json.type).toBe("object");
      setLabel(`schema:${name}`);
      const before = attempts.length;
      let out: unknown;
      try {
        out = await timed("schema", () => geminiStructured({
          tier: "fast",
          system: "You produce small, realistic example objects for a UK student careers app. Keep arrays to at most 2 items and strings short.",
          parts: [{ type: "text", text: `Return one example ${name} object.` }],
          schema,
          maxTokens: 4000,
        }, instrumentedGemini()));
      } catch (e) {
        const cause = (e as { cause?: Error }).cause;
        throw new Error(`${name} rejected: ${(e as Error).message} / cause: ${cause?.message?.slice(0, 400)}`);
      }
      const mine = attempts.slice(before);
      expect(mine.every((a) => !a.error)).toBe(true);
      expect(mine).toHaveLength(1); // valid on the first attempt => schema actually constrained decoding
      expect(schema.safeParse(out).success).toBe(true);
    });
  }

  it("a truncated answer (tiny maxTokens) surfaces AI_BAD_FORMAT after exactly one retry", async () => {
    setLabel("truncation");
    const before = attempts.length;
    const err = await geminiStructured({
      tier: "fast", system: "Return a full example.",
      parts: [{ type: "text", text: "Return one long, detailed example ParsedCvOutput with 3 experience entries of 4 bullets each." }],
      schema: schemas.ParsedCvOutput, maxTokens: 64,
    }, instrumentedGemini()).catch((e) => e);
    const mine = attempts.slice(before);
    console.log(`[truncation] ${JSON.stringify(mine.map((a) => ({ fr: a.finishReason, out: a.outputTokens, th: a.thoughtTokens, len: a.text?.length })))}`);
    expect(err).toBeInstanceOf(AiError);
    expect(err.message).toBe(AI_BAD_FORMAT);
    expect(mine).toHaveLength(2);
  });
});
