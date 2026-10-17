import "server-only";
import { z } from "zod";
import { generateStructured, isAiNotSetUp, runAi } from "@/lib/ai/provider";
import { gateDraft, promptParts, SYSTEM, type DraftInput, type DraftResult } from "@/lib/autopilot/drafts";

export type ReviseHow = "shorter" | "warmer" | "tidy";

const ReviseSchema = z.object({ sentences: z.array(z.object({ text: z.string(), about: z.enum(["me", "them"]), refs: z.array(z.string()) })) });
const HOW: Record<ReviseHow, string> = { shorter: "about 70% of its words", warmer: "friendlier, still professional", tidy: "fix grammar and flow only" };

/** The student's own sentences as citable facts (ids own-0, own-1, …), so a rewrite of them survives the gate. */
export function ownFacts(text: string): { id: string; claim: string }[] {
  return (text.match(/[^.!?\n]+(?:[.!?]+|$)/g) ?? []).map((s) => s.trim()).filter(Boolean).map((claim, n) => ({ id: `own-${n}`, claim }));
}

export async function reviseAnswer(i: DraftInput, text: string, how: ReviseHow): Promise<DraftResult> {
  const withOwn: DraftInput = { ...i, facts: [...i.facts, ...ownFacts(text)] };
  const empty: DraftResult = { text: "", sentences: [], caught: [], words: 0, limit: i.wordLimit ?? 200, thin: true, source: "none" };
  const system = `${SYSTEM}\nTask: rewrite the student's <answer> to be ${HOW[how]}. Keep every claim the student made; add no new ones. Cite the student's own sentences as fact:own-N.`;
  const parts = promptParts(withOwn);
  parts[0] = { ...parts[0], text: `${parts[0].text}\n<answer>\n${text.replace(/[<>]/g, "")}\n</answer>` };
  try {
    let source: DraftResult["source"] = "ai";
    const raw = await runAi({
      fn: "autopilotRevise", fixtureKey: `${i.jobExtId}-${i.fieldKey}`, schema: ReviseSchema,
      fromFixture: (x) => { source = "fixture"; return x; },
      live: () => generateStructured({ tier: "smart", system, parts, schema: ReviseSchema }),
      fallback: () => ({ sentences: [] }),
    });
    if (!raw.sentences.length) return empty;
    return { ...gateDraft(raw.sentences, withOwn), source };
  } catch (e) {
    if (isAiNotSetUp(e)) throw e; // the chat says "AI isn't set up" instead of a thin result
    return empty;
  }
}
