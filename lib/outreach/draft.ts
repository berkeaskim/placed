// lib/outreach/draft.ts
import { z } from "zod";
import { generateStructured, runAi } from "@/lib/ai/provider";
import { SYSTEM_OUTREACH, escapeUntrusted } from "@/lib/ai/prompts";
import { renderCvContent, stripPii } from "@/lib/cv-score/pii";
import { checkOutreach, fitToLimit, removeSentences, type GuardIssue, type GuardSource } from "./guard";
import type { OutreachTarget } from "./targets";

export type OutreachPurpose = "intro" | "follow_up" | "interview_prep";
export const OutreachDraftOut = z.object({ connection_note: z.string(), coffee_chat: z.string(), questions: z.array(z.string()).min(1).max(4) });
type Raw = z.infer<typeof OutreachDraftOut>;

export type OutreachDraft = { connectionNote: string; coffeeChat: string; questions: string[]; removed: string[] };
export type DraftInput = GuardSource & { target: OutreachTarget; purpose: OutreachPurpose; recipientName: string | null };

const TARGET_TEXT: Record<OutreachTarget, string> = {
  alumni: "a UCL graduate who works at the company", recent_joiner: "someone who joined the company's programme in the last 1-2 years",
  team: "someone in the team this role sits in", recruiter: "an early careers recruiter at the company",
};

/** Only an interview-prep message may say the student has an interview; the flag comes from the purpose, never the caller. */
const guardSrc = (i: DraftInput): GuardSource => ({ ...i, allowInterviewClaim: i.purpose === "interview_prep" });

function buildPrompt(i: DraftInput, problems: GuardIssue[] = []): string {
  const fix = problems.length
    ? `\n\nYour previous draft had lines we can't back up. Rewrite without them:\n${problems.map((p) => `- "${p.sentence}": ${p.reason}`).join("\n")}`
    : "";
  return `Company: ${escapeUntrusted(i.company)}\nRole: ${escapeUntrusted(i.jobTitle)}\nRecipient: ${TARGET_TEXT[i.target]}` +
    `${i.recipientName ? `, first name ${escapeUntrusted(i.recipientName)}` : ""}\nPurpose: ${i.purpose}\n\n` +
    `<cv>\n${escapeUntrusted(renderCvContent(stripPii(i.cv)))}\n</cv>\n<facts>\n${escapeUntrusted(i.facts.join("\n"))}\n</facts>\n` +
    `<note>\n${escapeUntrusted(i.note ?? "")}\n</note>${fix}`;
}

const issuesOf = (r: Raw, i: DraftInput) => {
  const g = guardSrc(i);
  return [...checkOutreach(r.connection_note, g), ...checkOutreach(r.coffee_chat, g)];
};

/** Blocked sentences removed, note fitted to 300. `removed` lists what was cut so the UI can say so. */
export function repairDraft(r: Raw, i: DraftInput): OutreachDraft {
  const g = guardSrc(i);
  const noteIssues = checkOutreach(r.connection_note, g), chatIssues = checkOutreach(r.coffee_chat, g);
  return {
    connectionNote: fitToLimit(removeSentences(r.connection_note, noteIssues.map((x) => x.sentence))),
    coffeeChat: removeSentences(r.coffee_chat, chatIssues.map((x) => x.sentence)),
    questions: r.questions.map((q) => q.trim()).filter(Boolean).slice(0, 3),
    removed: [...noteIssues, ...chatIssues].map((x) => x.sentence),
  };
}

/** Fixture text uses {company}, {name} and {role}; filled from the input so one file serves any demo job. */
function fill(r: Raw, i: DraftInput): Raw {
  const sub = (s: string) => s.replace(/\{company\}/g, i.company).replace(/\{role\}/g, i.jobTitle)
    .replace(/\{name\}/g, i.recipientName ?? "there");
  return { connection_note: sub(r.connection_note), coffee_chat: sub(r.coffee_chat), questions: r.questions.map(sub) };
}

const liveGenerate = (prompt: string) => generateStructured({
  tier: "fast", system: SYSTEM_OUTREACH, schema: OutreachDraftOut, maxTokens: 3000, parts: [{ type: "text", text: prompt }],
});

/**
 * One generation, one retry naming the blocked lines, then deterministic repair (spec §3.3).
 * Fixture key: `<target>` for intros, `<purpose>` otherwise (fixtures/ai/draftOutreach/).
 */
export async function draftOutreach(i: DraftInput, generate: (prompt: string) => Promise<Raw> = liveGenerate): Promise<OutreachDraft> {
  const live = async () => {
    let raw = await generate(buildPrompt(i));
    const problems = issuesOf(raw, i);
    if (problems.length || raw.connection_note.length > 300) {
      const tooLong = raw.connection_note.length > 300 ? [{ sentence: "(connection note)", reason: "over 300 characters" }] : [];
      raw = await generate(buildPrompt(i, [...problems, ...tooLong]));
    }
    return repairDraft(raw, i);
  };
  if (generate !== liveGenerate) return live(); // tests inject a generator: always the live path
  return runAi({
    fn: "draftOutreach", fixtureKey: i.purpose === "intro" ? i.target : i.purpose, schema: OutreachDraftOut,
    fromFixture: (raw) => repairDraft(fill(raw, i), i), live,
    fallback: () => ({ connectionNote: "", coffeeChat: "", questions: [], removed: [] }),
  });
}
