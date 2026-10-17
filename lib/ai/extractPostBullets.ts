import { AiError, AI_UNAVAILABLE, generateStructured, runAi } from "./provider";
import { SYSTEM_POST_BULLETS, escapeUntrusted, wrapJob } from "./prompts";
import { PostBulletsOutput, type PostBulletsOutputT } from "./schemas";

export type BankEntryRef = { id: string; org: string; title: string };

/** Proposes CV bullets from one LinkedIn post. The caller (importPosts) drops anything not grounded in the post. */
export async function extractPostBullets(postText: string, bankEntries: BankEntryRef[]): Promise<PostBulletsOutputT> {
  const list = bankEntries.length
    ? bankEntries.map((e) => `- ${escapeUntrusted(e.org)} | ${escapeUntrusted(e.title)}`).join("\n")
    : "(none)";
  return runAi({
    fn: "extractPostBullets",
    schema: PostBulletsOutput,
    live: () => generateStructured({
      tier: "fast", thinking: "low", system: SYSTEM_POST_BULLETS, schema: PostBulletsOutput,
      parts: [{ type: "text", text: `Existing CV entries:\n${list}\n\n${wrapJob(postText.slice(0, 8000))}` }],
    }),
    fallback: () => { throw new AiError(AI_UNAVAILABLE); },
  });
}
