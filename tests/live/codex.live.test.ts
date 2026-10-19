import { describe, it, expect } from "vitest";
import { z } from "zod";
import * as schemas from "@/lib/ai/schemas";
import { codexStructured, codexStream } from "@/lib/ai/codex";

// Needs the Codex CLI signed in with ChatGPT. Run with:
//   LIVE_CODEX=1 npx vitest run -c vitest.live.config.ts tests/live/codex.live.test.ts
const LIVE = Boolean(process.env.LIVE_CODEX);
const ZOD_EXPORTS = Object.entries(schemas).filter(([, v]) => v instanceof z.ZodType) as [string, z.ZodType][];

describe.skipIf(!LIVE).concurrent("every lib/ai/schemas.ts schema works as a strict Codex --output-schema", () => {
  for (const [name, schema] of ZOD_EXPORTS) {
    it(`${name}`, { timeout: 300_000 }, async () => {
      const t0 = Date.now();
      const out = await codexStructured({
        tier: "fast",
        system: "You produce small, realistic example objects for a UK student careers app. Keep arrays to at most 2 items and strings short.",
        parts: [{ type: "text", text: `Return one example ${name} object.` }],
        schema,
      }).catch((e) => {
        throw new Error(`${name}: ${(e as Error).message} / ${(e as { cause?: Error }).cause?.message}`);
      });
      console.log(`[codex] ${name} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
      expect(schema.safeParse(out).success).toBe(true);
    });
  }

  it("streams a short text", { timeout: 300_000 }, async () => {
    let text = "";
    for await (const d of codexStream({ tier: "fast", system: "You write short notes.", prompt: "Write one sentence about London." })) text += d;
    expect(text.length).toBeGreaterThan(10);
  });
});
