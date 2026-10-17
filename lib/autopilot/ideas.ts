import "server-only";
import { z } from "zod";
import { generateStructured, isAiNotSetUp, runAi } from "@/lib/ai/provider";
import { cvBulletIndex, lexiconBlock, promptParts, SYSTEM, type DraftInput } from "@/lib/autopilot/drafts";

export type Idea = { text: string; refs: string[] };

const IdeasSchema = z.object({ ideas: z.array(z.object({ text: z.string(), refs: z.array(z.string()) })) });
const MAX_IDEAS = 3;

/** Keeps ideas whose refs all resolve to a CV bullet, a confirmed fact or a job-post line, and that read as the student's own. */
export function gateIdeas(raw: Idea[], i: DraftInput): Idea[] {
  const bullets = cvBulletIndex(i.cv);
  const facts = new Set(i.facts.map((f) => `fact:${f.id}`));
  const ok = (r: string) => bullets.has(r) || facts.has(r) || (/^jd:\d+$/.test(r) && i.jdLines[Number(r.slice(3))] !== undefined);
  return raw.filter((x) => x.text.trim() && x.refs.length > 0 && x.refs.every(ok) && !lexiconBlock(x.text)).slice(0, MAX_IDEAS);
}

const IDEAS_SYSTEM = `${SYSTEM.split("\nReturn JSON")[0]}
Task: suggest up to 3 one-line angles the student could write about for <question>, each tied to cited lines (refs). Suggest angles only, not a finished answer.
Return JSON {ideas:[{text, refs:[...]}]}.`;

export async function suggestIdeas(i: DraftInput): Promise<Idea[]> {
  try {
    const raw = await runAi({
      fn: "autopilotIdeas", fixtureKey: `${i.jobExtId}-${i.fieldKey}`, schema: IdeasSchema,
      live: () => generateStructured({ tier: "fast", system: IDEAS_SYSTEM, parts: promptParts(i), schema: IdeasSchema }),
      fallback: () => ({ ideas: [] }),
    });
    return gateIdeas(raw.ideas, i);
  } catch (e) {
    if (isAiNotSetUp(e)) throw e; // the chat says "AI isn't set up" instead of a thin result
    return [];
  }
}
