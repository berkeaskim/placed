import type { ParsedCV } from "@/lib/types";
import { assignIds } from "@/lib/cv/ids";
import { generateStructured, runAi, type Part } from "./provider";
import { SYSTEM_PARSE_CV } from "./prompts";
import { ParsedCvOutput } from "./schemas";
import { heuristicParseCv } from "./heuristics";

/** textOnly: send only the (already stripped) text, never the PDF document, so hidden PDF content cannot reach the model. */
export function buildParseParts(input: { base64: string; text: string }, textOnly?: boolean): Part[] {
  return textOnly
    ? [{ type: "text", text: `Parse this CV. The CV text follows.\n\n${input.text}` }]
    : [{ type: "pdf", base64: input.base64 }, { type: "text", text: "Parse this CV." }];
}

export async function parseCV(input: { base64: string; text: string; fixtureKey?: string; textOnly?: boolean }): Promise<ParsedCV> {
  const cv = await runAi({
    fn: "parseCV",
    fixtureKey: input.fixtureKey,
    schema: ParsedCvOutput,
    live: () => generateStructured({
      tier: "smart", system: SYSTEM_PARSE_CV, schema: ParsedCvOutput, maxTokens: 16000,
      parts: buildParseParts(input, input.textOnly),
    }),
    fallback: () => heuristicParseCv(input.text),
  });
  return assignIds(cv as ParsedCV);
}
