import type { ParsedCV } from "@/lib/types";
import { assignIds } from "@/lib/cv/ids";
import { generateStructured, runAi } from "./provider";
import { SYSTEM_PARSE_CV } from "./prompts";
import { ParsedCvOutput } from "./schemas";
import { heuristicParseCv } from "./heuristics";

export async function parseCV(input: { base64: string; text: string; fixtureKey?: string }): Promise<ParsedCV> {
  const cv = await runAi({
    fn: "parseCV",
    fixtureKey: input.fixtureKey,
    schema: ParsedCvOutput,
    live: () => generateStructured({
      tier: "smart", system: SYSTEM_PARSE_CV, schema: ParsedCvOutput, maxTokens: 16000,
      parts: [{ type: "pdf", base64: input.base64 }, { type: "text", text: "Parse this CV." }],
    }),
    fallback: () => heuristicParseCv(input.text),
  });
  return assignIds(cv as ParsedCV);
}
