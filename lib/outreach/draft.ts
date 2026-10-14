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

/** Single line for `Key: value` prompt lines, so a name or title can't smuggle in a new line of instructions. */
const oneLine = (s: string) => escapeUntrusted(s.replace(/\s+/g, " ").trim());

function buildPrompt(i: DraftInput, problems: GuardIssue[] = []): string {
  const fix = problems.length
    ? `\n\nYour previous draft had lines we can't back up. Rewrite without them:\n${problems.map((p) => `- "${oneLine(p.sentence)}": ${oneLine(p.reason)}`).join("\n")}`
    : "";
  return `Company: ${oneLine(i.company)}\nRole: ${oneLine(i.jobTitle)}\nRecipient: ${TARGET_TEXT[i.target]}` +
    `${i.recipientName ? `, first name ${oneLine(i.recipientName)}` : ""}\nPurpose: ${i.purpose}\n\n` +
    `<cv>\n${escapeUntrusted(renderCvContent(stripPii(i.cv)))}\n</cv>\n<facts>\n${escapeUntrusted(i.facts.join("\n"))}\n</facts>\n` +
    `<note>\n${escapeUntrusted(i.note ?? "")}\n</note>${fix}`;
}

/** Every question is checked like the messages: a blocked question is a blocked line. */
const questionIssues = (r: Raw, g: GuardSource) => r.questions.flatMap((q) => checkOutreach(q, g).length ? [{ sentence: q.trim(), reason: checkOutreach(q, g)[0].reason }] : []);

const issuesOf = (r: Raw, i: DraftInput) => {
  const g = guardSrc(i);
  return [...checkOutreach(r.connection_note, g), ...checkOutreach(r.coffee_chat, g), ...questionIssues(r, g)];
};

/** Blocked sentences and questions removed, note fitted to 300. `removed` lists what was cut so the UI can say so. */
export function repairDraft(r: Raw, i: DraftInput): OutreachDraft {
  const g = guardSrc(i);
  const noteIssues = checkOutreach(r.connection_note, g), chatIssues = checkOutreach(r.coffee_chat, g), qIssues = questionIssues(r, g);
  const blockedQs = new Set(qIssues.map((x) => x.sentence));
  return {
    connectionNote: fitToLimit(removeSentences(r.connection_note, noteIssues.map((x) => x.sentence))),
    coffeeChat: removeSentences(r.coffee_chat, chatIssues.map((x) => x.sentence)),
    questions: r.questions.map((q) => q.trim()).filter((q) => q && !blockedQs.has(q)).slice(0, 3),
    removed: [...new Set([...noteIssues, ...chatIssues, ...qIssues].map((x) => x.sentence))],
  };
}

/** Fixture text uses {company}, {name} and {role}; filled in one pass so `$&` or `{role}` inside a value stays literal. */
function fill(r: Raw, i: DraftInput): Raw {
  const vals: Record<string, string> = { company: i.company, role: i.jobTitle, name: i.recipientName ?? "there" };
  const sub = (s: string) => s.replace(/\{(company|role|name)\}/g, (_, k: string) => vals[k]);
  return { connection_note: sub(r.connection_note), coffee_chat: sub(r.coffee_chat), questions: r.questions.map(sub) };
}

/** Returned when no fixture exists; consumers detect it with `isEmptyDraft`. */
export const EMPTY_DRAFT: OutreachDraft = Object.freeze({ connectionNote: "", coffeeChat: "", questions: [], removed: [] }) as OutreachDraft;
export const isEmptyDraft = (d: OutreachDraft) => !d.connectionNote && !d.coffeeChat && d.questions.length === 0;

const liveGenerate = (prompt: string) => generateStructured({
  tier: "fast", system: SYSTEM_OUTREACH, schema: OutreachDraftOut, maxTokens: 3000, parts: [{ type: "text", text: prompt }],
});

/**
 * One generation, one retry naming the blocked lines, then deterministic repair (spec §3.3).
 * Fixture key: `<target>` for intros, `<purpose>` otherwise (fixtures/ai/draftOutreach/); no fixture -> EMPTY_DRAFT.
 * A failing retry falls back to repairing the first draft. A failure of the FIRST live call propagates (AiError or
 * a zod error); the action layer turns it into a user message.
 * `generate` is a test seam: injecting it bypasses fixture mode.
 */
export async function draftOutreach(i: DraftInput, generate: (prompt: string) => Promise<Raw> = liveGenerate): Promise<OutreachDraft> {
  const live = async () => {
    const first = await generate(buildPrompt(i));
    const problems = issuesOf(first, i);
    if (!problems.length && first.connection_note.length <= 300) return repairDraft(first, i);
    const tooLong = first.connection_note.length > 300 ? [{ sentence: "(connection note)", reason: "over 300 characters" }] : [];
    try {
      return repairDraft(await generate(buildPrompt(i, [...problems, ...tooLong])), i);
    } catch {
      return repairDraft(first, i);
    }
  };
  if (generate !== liveGenerate) return live();
  return runAi({
    fn: "draftOutreach", fixtureKey: i.purpose === "intro" ? i.target : i.purpose, schema: OutreachDraftOut,
    fromFixture: (raw) => repairDraft(fill(raw, i), i), live,
    fallback: () => ({ ...EMPTY_DRAFT, questions: [], removed: [] }),
  });
}
