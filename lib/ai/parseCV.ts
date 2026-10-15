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

/** Upload waits on this call, so it gets a hard deadline: past it the heuristic parse saves the profile instead. */
export const PARSE_DEADLINE_MS = 60_000;

/** Resolves to `fallback()` if `p` hasn't settled within `ms` or rejects. */
export async function withDeadline<T>(p: Promise<T>, ms: number, fallback: () => T, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"timeout">((resolve) => { timer = setTimeout(() => resolve("timeout"), ms); });
  try {
    const r = await Promise.race([p, timeout]);
    if (r !== "timeout") return r;
    console.error(`${label} timed out after ${ms}ms; using the fallback`);
  } catch (e) {
    console.error(`${label} failed; using the fallback`, e);
  } finally {
    clearTimeout(timer);
  }
  return fallback();
}

export async function parseCV(input: { base64: string; text: string; fixtureKey?: string; textOnly?: boolean }): Promise<ParsedCV> {
  const fallback = () => heuristicParseCv(input.text);
  const cv = await runAi({
    fn: "parseCV",
    fixtureKey: input.fixtureKey,
    schema: ParsedCvOutput,
    // Fast tier + low thinking: extraction doesn't need Pro, which took 130-300s per call and left the upload hanging.
    live: () => withDeadline(generateStructured({
      tier: "fast", thinking: "low", system: SYSTEM_PARSE_CV, schema: ParsedCvOutput, maxTokens: 16000,
      parts: buildParseParts(input, input.textOnly),
    }), PARSE_DEADLINE_MS, fallback, "parseCV"),
    fallback,
  });
  return assignIds(cv as ParsedCV);
}
