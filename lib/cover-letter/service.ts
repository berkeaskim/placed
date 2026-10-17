import "server-only";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  autopilotPacks, companies, confirmedFacts, coverLetterStories, cvs, jobs,
  type CL_DRAFT_STATE_VALUES, type CL_RESEARCH_STATE_VALUES, type LetterRow, type OutputRow,
} from "@/lib/db/schema";
import type { NormalizedForm } from "@/lib/autopilot/forms/types";
import { putFile } from "@/lib/files";
import { awardXP } from "@/lib/gamify/award";
import type { Archetype, ParsedCV } from "@/lib/types";
import type { DraftInput } from "./draft";
import { buildEvidence, pickStoryEntry, type Evidence } from "./evidence";
import { canMarkReady } from "./gate";
import { aiPolicyBlocks, chooseMode } from "./mode";
import { renderLetterPdf } from "./pdf";
import { findPerson, maskPerson } from "./person";
import { nextQuestion } from "./questions";
import { defaultResearchDeps, researchCompany } from "./research";
import { countWords, lintLetter, RULES } from "./rules";
import { diffSpans } from "./spans";
import {
  findStories, getOrCreateLetter, getResearch, listOutputs, popUndo, pushUndo, rememberStory, saveLetter, upsertOutput,
} from "./store";
import type { Answer, ChatMsg, Fact, Limit, LintHit, Mode, OutputStatus, OutputTarget, Span } from "./types";

/** An error whose message is fit to show the student. */
export class CardError extends Error {}

type ResearchState = (typeof CL_RESEARCH_STATE_VALUES)[number];
type DraftState = (typeof CL_DRAFT_STATE_VALUES)[number];

export type OutputView = {
  id: string; target: OutputTarget; mode: Mode; limit: Limit; status: OutputStatus; text: string; spans: Span[]; lint: LintHit[];
  words: number; canReady: ReturnType<typeof canMarkReady>;
  /** Under the `letters` bucket, set once an upload output is Ready. */
  pdfPath: string | null;
};
export type CardView = {
  letterId: string; company: string; role: string; chat: ChatMsg[]; next: ReturnType<typeof nextQuestion>;
  researchState: ResearchState; draftState: DraftState; facts: Fact[]; outputs: OutputView[];
  feedbackOnly: boolean; noLetter: boolean;
  /** A person named in an answer, waiting for the student to say they may be named. */
  confirmPerson: { name: string } | null;
  /** The saved answer for the story question's CV entry, for the "Use my saved answer" chip. */
  savedStory: { id: string; text: string } | null;
};

export type Ctx = {
  userId: string;
  job: { id: string; extId: string; company: string; role: string; archetype: Archetype | null; jdLines: string[] };
  cv: ParsedCV | null;
  confirmed: { id: string; claim: string }[];
};

const STALE_STREAM_MS = 2 * 60_000;
const MAX_ANSWER = 1500;
const MAX_LETTER = 20_000;
const QUESTION_IDS = new Set<Answer["question"]>(["why_firm", "facts", "story", "touchpoint", "product"]);
const msg = (m: Omit<ChatMsg, "id">): ChatMsg => ({ id: crypto.randomUUID(), ...m });
const sameTarget = (a: OutputTarget, b: OutputTarget) =>
  a.kind === "upload" ? b.kind === "upload" : b.kind === "field" && a.fieldKey === b.fieldKey;

// ---------------------------------------------------------------- loading

export function loadCtx(userId: string, jobId: string): Ctx {
  const j = db.select({ id: jobs.id, ext_id: jobs.ext_id, title: jobs.title, archetype: jobs.archetype, text_lines: jobs.text_lines, name: companies.name })
    .from(jobs).innerJoin(companies, eq(companies.id, jobs.company_id)).where(eq(jobs.id, jobId)).get();
  if (!j) throw new CardError("Job not found");
  const cvRow = db.select({ parsed_json: cvs.parsed_json }).from(cvs).where(and(eq(cvs.user_id, userId), eq(cvs.is_active, true))).get();
  const confirmed = db.select({ id: confirmedFacts.id, claim: confirmedFacts.claim }).from(confirmedFacts).where(eq(confirmedFacts.user_id, userId)).all();
  return {
    userId, cv: (cvRow?.parsed_json ?? null) as ParsedCV | null, confirmed,
    job: { id: j.id, extId: j.ext_id, company: j.name, role: j.title, archetype: j.archetype ?? null, jdLines: j.text_lines ?? [] },
  };
}

const jdText = (ctx: Ctx) => ctx.job.jdLines.join("\n");
const feedbackOnly = (ctx: Ctx) => aiPolicyBlocks(jdText(ctx));
const storyEntry = (ctx: Ctx) => (ctx.cv ? pickStoryEntry(ctx.cv, ctx.job.jdLines) : null);
const researchKey = (ctx: Ctx) => `${ctx.job.company.toLowerCase()}|`;

function getOutput(letter: LetterRow, outputId: string): OutputRow {
  const o = listOutputs(letter.id).find((x) => x.id === outputId);
  if (!o) throw new CardError("That letter was not found");
  return o;
}

// ---------------------------------------------------------------- view

function savedStory(ctx: Ctx): { id: string; text: string } | null {
  const entry = storyEntry(ctx);
  const s = entry ? findStories(ctx.userId, { kind: "story", cvEntryId: entry.id }).at(-1) : undefined;
  return s ? { id: s.id, text: s.text } : null;
}

function questionFor(ctx: Ctx, letter: LetterRow) {
  if (feedbackOnly(ctx)) return null;
  const answers = letter.answers;
  return nextQuestion({
    answers, researchState: letter.research_state as ResearchState, facts: letter.facts, storyEntry: storyEntry(ctx),
    archetype: ctx.job.archetype, company: ctx.job.company, hasSavedStory: savedStory(ctx) !== null,
    hasTouchpointAnswer: answers.some((a) => (a.question === "touchpoint" || a.question === "product") && !!a.text),
  });
}

/** Appends the next question to the transcript the first time it is asked. */
function syncChat(ctx: Ctx, letter: LetterRow): LetterRow {
  const q = questionFor(ctx, letter);
  if (!q || q.id === "wait_research" || letter.chat.some((m) => m.kind === "question" && m.questionId === q.id)) return letter;
  const chat = [...letter.chat, msg({ from: "bot", text: q.text, kind: "question", questionId: q.id })];
  saveLetter(letter.id, { chat });
  return { ...letter, chat };
}

function outputView(o: OutputRow): OutputView {
  return {
    id: o.id, target: o.target, mode: o.mode as Mode, limit: o.limit, status: o.status, text: o.text, spans: o.spans, lint: o.lint,
    words: countWords(o.text), canReady: canMarkReady({ text: o.text, spans: o.spans, lint: o.lint, limit: o.limit }), pdfPath: o.pdf_path,
  };
}

function view(ctx: Ctx, row: LetterRow): CardView {
  const letter = syncChat(ctx, row);
  const outputs = listOutputs(letter.id).map(outputView);
  const pending = letter.answers.find((a) => a.person && a.person.ok === null)?.person;
  return {
    letterId: letter.id, company: ctx.job.company, role: ctx.job.role, chat: letter.chat, next: questionFor(ctx, letter),
    researchState: letter.research_state as ResearchState, draftState: letter.draft_state as DraftState, facts: letter.facts, outputs,
    feedbackOnly: feedbackOnly(ctx), noLetter: outputs.find((o) => o.target.kind === "upload")?.mode === "skip",
    confirmPerson: pending ? { name: pending.name } : null, savedStory: savedStory(ctx),
  };
}

export async function cardView(userId: string, jobId: string): Promise<CardView> {
  const ctx = loadCtx(userId, jobId);
  return view(ctx, getOrCreateLetter(userId, jobId));
}

// ---------------------------------------------------------------- research (background)

const running = new Map<string, Promise<void>>();

function startResearch(ctx: Ctx, letter: LetterRow): void {
  saveLetter(letter.id, { research_state: "running" });
  const company = ctx.job.company;
  const p = (async () => {
    let state: ResearchState;
    let facts: Fact[] = [];
    try {
      const r = await researchCompany({ company, division: null, jdText: jdText(ctx) }, defaultResearchDeps(ctx.job.extId));
      state = r.provider === "none" ? "none" : "done";
      facts = r.facts;
    } catch (e) {
      console.error("[cover-letter] research:", e instanceof Error ? e.message : "unknown error");
      state = "failed";
    }
    const cur = getOrCreateLetter(ctx.userId, ctx.job.id);
    const note = state === "done" ? [] : [msg({
      from: "bot", kind: "research",
      text: state === "none"
        ? `I couldn't look ${company} up (that needs a Gemini or Serper key in Settings), so I'll work from the job post.`
        : `Researching ${company} didn't work this time, so I'll work from the job post.`,
    })];
    saveLetter(cur.id, { research_state: state, facts, chat: [...cur.chat, ...note] });
  })().finally(() => running.delete(letter.id));
  running.set(letter.id, p);
}

/** Resolves once every background research run has saved its result (tests and scripts). */
export async function researchSettled(): Promise<void> {
  while (running.size) await Promise.all(running.values());
}

// ---------------------------------------------------------------- open

function lengthLine(mode: Mode, limit: Limit): string {
  const m = RULES.modes[mode];
  if (mode === "full_letter") return `a full cover letter of ${m.words![0]}–${m.words![1]} words`;
  if (mode === "short_letter") return "a short letter of about 300 words";
  if (mode === "short_note") return `a short note of ${m.words![0]}–${m.words![1]} words`;
  return `an answer of up to ${limit?.max ?? m.defaultWords} ${limit?.unit === "chars" ? "characters" : "words"}`;
}

function modeFor(ctx: Ctx, target: OutputTarget): ReturnType<typeof chooseMode> {
  if (target.kind === "upload") return chooseMode({ target, jdText: jdText(ctx) });
  const form = db.select({ form: autopilotPacks.form }).from(autopilotPacks)
    .where(and(eq(autopilotPacks.user_id, ctx.userId), eq(autopilotPacks.job_id, ctx.job.id))).get()?.form as NormalizedForm | undefined;
  const f = form?.fields?.find((x) => x.key === target.fieldKey);
  return chooseMode({ target, fieldType: f?.type === "file" ? "file" : "textarea", wordLimit: f?.wordLimit, jdText: jdText(ctx) });
}

function firstMessage(ctx: Ctx, m: ReturnType<typeof chooseMode>): ChatMsg {
  if (feedbackOnly(ctx)) {
    return msg({ from: "bot", text: `${ctx.job.company} asks applicants not to use AI, so I won't write anything here. Paste or type your own letter and I'll check it against the playbook.` });
  }
  if (m.mode === "skip") return msg({ from: "bot", text: `${m.reason} I can still help you write a short "why us" answer.` });
  return msg({ from: "bot", text: `${m.reason} I'll write ${lengthLine(m.mode, m.limit)}, built around your own words. First, a few quick questions.` });
}

/**
 * Opens (or reopens) the card for a job: the letter row, an output for `target`, background research while it is
 * idle (or orphaned by a restart), and a stale "streaming" draft turned into "interrupted".
 */
export async function openCard(userId: string, jobId: string, target: OutputTarget = { kind: "upload" }): Promise<CardView> {
  const ctx = loadCtx(userId, jobId);
  let letter = getOrCreateLetter(userId, jobId);
  if (!listOutputs(letter.id).some((o) => sameTarget(o.target, target))) {
    const m = modeFor(ctx, target);
    upsertOutput(letter.id, target, { mode: m.mode, limit: m.limit });
    if (!letter.chat.length) saveLetter(letter.id, { chat: [firstMessage(ctx, m)] });
  }
  if (letter.draft_state === "streaming" && Date.now() - Date.parse(letter.updated_at) > STALE_STREAM_MS) {
    saveLetter(letter.id, { draft_state: "interrupted" });
  }
  if (!feedbackOnly(ctx) && (letter.research_state === "idle" || (letter.research_state === "running" && !running.has(letter.id)))) {
    startResearch(ctx, letter);
  }
  letter = getOrCreateLetter(userId, jobId);
  return view(ctx, letter);
}

// ---------------------------------------------------------------- the interview

function putAnswer(answers: Answer[], a: Omit<Answer, "id">): Answer[] {
  const old = answers.find((x) => x.question === a.question);
  if (old) return answers.map((x) => (x === old ? { ...a, id: old.id } : x));
  return [...answers, { ...a, id: `a${answers.length + 1}` }];
}

/** Names the student wrote that are not the firm, the role, the job post or their own CV. */
function personIn(ctx: Ctx, text: string, prev?: Answer): Answer["person"] {
  const cv = ctx.cv;
  const avoid = [ctx.job.company, ctx.job.role, ...ctx.job.jdLines,
    ...(cv ? [...cv.experience, ...cv.projects, ...cv.leadership].flatMap((e) => [e.org, e.title, e.location]) : []),
    ...(cv ? cv.education.flatMap((e) => [e.institution, e.degree]) : [])].filter(Boolean);
  const name = findPerson(text, avoid);
  if (!name) return undefined;
  return { name, ok: prev?.person?.name === name ? prev.person.ok : null };
}

export async function answerQuestion(userId: string, jobId: string, question: Answer["question"], raw: string | null): Promise<CardView> {
  if (!QUESTION_IDS.has(question)) throw new CardError("Unknown question");
  if (question === "facts") return pickFacts(userId, jobId, []); // "Skip" on the facts question
  if (raw !== null && (typeof raw !== "string" || raw.length > MAX_ANSWER)) throw new CardError(`Keep it under ${MAX_ANSWER} characters`);
  const ctx = loadCtx(userId, jobId);
  const letter = getOrCreateLetter(userId, jobId);
  const text = raw?.trim() || null;
  const prev = letter.answers.find((a) => a.question === question);
  const entry = question === "story" ? storyEntry(ctx) : null;
  const person = text && (question === "why_firm" || question === "touchpoint") ? personIn(ctx, text, prev) : undefined;
  const answers = putAnswer(letter.answers, { question, text, ...(entry ? { cvEntryId: entry.id } : {}), ...(person ? { person } : {}) });
  const chat = [...letter.chat, msg({ from: "me", text: text ?? "Skip", questionId: question })];
  saveLetter(letter.id, { answers, chat });
  if (text && question === "why_firm") rememberOnce(userId, { kind: "why_firm", company: ctx.job.company, text });
  if (text && entry) rememberOnce(userId, { kind: "story", cvEntryId: entry.id, text });
  return view(ctx, getOrCreateLetter(userId, jobId));
}

function rememberOnce(userId: string, s: Parameters<typeof rememberStory>[1]): void {
  const same = findStories(userId, { kind: s.kind, cvEntryId: s.cvEntryId, company: s.company }).some((x) => x.text === s.text);
  if (!same) rememberStory(userId, s);
}

export async function pickFacts(userId: string, jobId: string, factIds: string[]): Promise<CardView> {
  if (!Array.isArray(factIds) || factIds.length > 20) throw new CardError("Unknown facts");
  const ctx = loadCtx(userId, jobId);
  const letter = getOrCreateLetter(userId, jobId);
  const picked = letter.facts.filter((f) => factIds.includes(f.id));
  const answers = putAnswer(letter.answers, { question: "facts", text: null, pickedFactIds: picked.map((f) => f.id) });
  const chat = [...letter.chat, msg({ from: "me", text: picked.length ? picked.map((f) => f.claim).join("\n") : "None of these", questionId: "facts" })];
  saveLetter(letter.id, { answers, chat });
  return view(ctx, getOrCreateLetter(userId, jobId));
}

export async function applySavedStory(userId: string, jobId: string, storyId: string): Promise<CardView> {
  const s = db.select().from(coverLetterStories)
    .where(and(eq(coverLetterStories.id, storyId), eq(coverLetterStories.user_id, userId), eq(coverLetterStories.kind, "story"))).get();
  if (!s) throw new CardError("That saved answer was not found");
  db.update(coverLetterStories).set({ last_used_at: new Date().toISOString() }).where(eq(coverLetterStories.id, s.id)).run();
  return answerQuestion(userId, jobId, "story", s.text);
}

export async function confirmPerson(userId: string, jobId: string, name: string, ok: boolean): Promise<CardView> {
  const ctx = loadCtx(userId, jobId);
  const letter = getOrCreateLetter(userId, jobId);
  const answers = letter.answers.map((a) => (a.person?.name === name ? { ...a, person: { name, ok: ok === true } } : a));
  saveLetter(letter.id, { answers });
  return view(ctx, getOrCreateLetter(userId, jobId));
}

// ---------------------------------------------------------------- draft input

const rivalsFor = (ctx: Ctx) => getResearch(researchKey(ctx))?.rivals ?? [];

/** The evidence pack, built once per letter (may throw on an AI error). */
export async function ensureEvidence(ctx: Ctx, letter: LetterRow): Promise<Evidence> {
  if (letter.evidence) return letter.evidence as Evidence;
  if (!ctx.cv) throw new CardError("Upload your CV first: the letter is built from it.");
  const evidence = await buildEvidence({
    cv: ctx.cv, jdLines: ctx.job.jdLines, company: ctx.job.company, rivals: rivalsFor(ctx), archetype: ctx.job.archetype, fixtureKey: ctx.job.extId,
  });
  saveLetter(letter.id, { evidence });
  return evidence;
}

/** What the writer sees. Names the student has not confirmed are masked as "a {company} associate". */
export function draftInput(ctx: Ctx, letter: LetterRow, o: OutputRow, evidence: Evidence): DraftInput {
  if (!ctx.cv) throw new CardError("Upload your CV first: the letter is built from it.");
  const company = ctx.job.company;
  const answers = letter.answers.map((a) => (a.text && a.person && a.person.ok !== true ? { ...a, text: maskPerson(a.text, a.person.name, company) } : a));
  const pickedIds = new Set(letter.answers.find((a) => a.question === "facts")?.pickedFactIds ?? []);
  return {
    mode: o.mode as Mode, limit: o.limit, company, role: ctx.job.role, ref: null, cv: ctx.cv, jdLines: ctx.job.jdLines,
    evidence, answers, facts: letter.facts, pickedFacts: letter.facts.filter((f) => pickedIds.has(f.id)), confirmedFacts: ctx.confirmed,
  };
}

export async function draftInputFor(userId: string, jobId: string, outputId: string): Promise<DraftInput> {
  const ctx = loadCtx(userId, jobId);
  const letter = getOrCreateLetter(userId, jobId);
  const evidence = await ensureEvidence(ctx, letter);
  return draftInput(ctx, letter, getOutput(letter, outputId), evidence);
}

// ---------------------------------------------------------------- the student's edits

/** Lint for the current text, the student's own spans scoped "theirs". */
function relint(ctx: Ctx, letter: LetterRow, o: OutputRow, text: string, spans: Span[]): LintHit[] {
  const past = ctx.cv ? [...ctx.cv.experience, ...ctx.cv.projects, ...ctx.cv.leadership].map((e) => e.org.trim().toLowerCase()) : [];
  const rivals = (letter.evidence as Evidence | null)?.rivals ?? rivalsFor(ctx);
  const otherEmployers = [...new Set(rivals)].filter((r) => r.trim() && !past.includes(r.trim().toLowerCase()));
  return lintLetter(text, {
    mode: o.mode as Mode, limit: o.limit, company: ctx.job.company, role: ctx.job.role, otherEmployers, ownSpans: spans.filter((s) => s.kind === "theirs"),
  });
}

/** Saves new text and spans; any change sends a Ready output back to draft (its PDF is stale). */
function writeOutput(ctx: Ctx, letter: LetterRow, o: OutputRow, text: string, spans: Span[]): void {
  upsertOutput(letter.id, o.target, { text, spans, lint: relint(ctx, letter, o, text, spans), status: "draft", pdf_path: null });
}

export async function saveText(userId: string, jobId: string, outputId: string, text: string): Promise<CardView> {
  if (typeof text !== "string" || text.length > MAX_LETTER) throw new CardError("That letter is too long");
  const ctx = loadCtx(userId, jobId);
  const letter = getOrCreateLetter(userId, jobId);
  const o = getOutput(letter, outputId);
  if (text !== o.text) {
    pushUndo(o.id, { text: o.text, spans: o.spans });
    writeOutput(ctx, letter, o, text, diffSpans(o.text, o.spans, text));
  }
  return view(ctx, letter);
}

export async function undoEdit(userId: string, jobId: string, outputId: string): Promise<CardView> {
  const ctx = loadCtx(userId, jobId);
  const letter = getOrCreateLetter(userId, jobId);
  const o = getOutput(letter, outputId);
  const prev = popUndo(o.id);
  if (prev) writeOutput(ctx, letter, o, prev.text, prev.spans);
  return view(ctx, letter);
}

/** "This is true": the claim joins confirmed_facts (grounding later letters and tailoring) and the span becomes theirs. */
export async function confirmTrue(userId: string, jobId: string, outputId: string, spanStart: number): Promise<CardView> {
  const ctx = loadCtx(userId, jobId);
  const letter = getOrCreateLetter(userId, jobId);
  const o = getOutput(letter, outputId);
  const span = o.spans.find((s) => s.start === spanStart && s.kind === "ai");
  if (!span) throw new CardError("There is nothing to confirm there");
  const claim = o.text.slice(span.start, span.end).trim().slice(0, 500);
  if (claim) db.insert(confirmedFacts).values({ user_id: userId, claim }).run();
  const spans = o.spans.map((s) => (s === span ? { start: s.start, end: s.end, kind: "theirs" as const, refs: s.refs } : s));
  writeOutput(ctx, letter, o, o.text, spans);
  return view(ctx, letter);
}

/** Ready: the gate passes, an upload gets its A4 PDF (and plain-text twin), and the job earns its once-only XP. */
export async function markReady(userId: string, jobId: string, outputId: string): Promise<CardView> {
  const ctx = loadCtx(userId, jobId);
  const letter = getOrCreateLetter(userId, jobId);
  const o = getOutput(letter, outputId);
  if (!canMarkReady({ text: o.text, spans: o.spans, lint: o.lint, limit: o.limit }).ok) return view(ctx, letter);
  let pdf_path: string | null = null;
  if (o.target.kind === "upload") {
    const cv = ctx.cv;
    const bytes = await renderLetterPdf({
      name: cv?.name ?? "", email: cv?.email ?? "", phone: cv?.phone ?? null, linkedin: cv?.links.find((l) => /linkedin\.com/i.test(l)) ?? null,
      date: new Date(), company: ctx.job.company, ref: null, role: ctx.job.role, body: o.text,
    });
    pdf_path = `${userId}/${letter.id}-${o.id}.pdf`;
    await putFile("letters", pdf_path, bytes, "application/pdf");
    await putFile("letters", pdf_path.replace(/\.pdf$/, ".txt"), Buffer.from(o.text, "utf8"), "text/plain; charset=utf-8");
  }
  upsertOutput(letter.id, o.target, { status: "ready", pdf_path });
  await awardXP(userId, { type: "cover_letter_ready" }, jobId).catch((e) => {
    console.error("cover_letter_ready XP award failed:", e instanceof Error ? e.message : "unknown error");
  });
  return view(ctx, letter);
}

export async function addFieldOutput(userId: string, jobId: string, label: string, limit: Limit): Promise<CardView> {
  const name = typeof label === "string" ? label.trim() : "";
  if (!name || name.length > 300) throw new CardError("Give the question a label");
  if (limit !== null && !(limit && (limit.unit === "words" || limit.unit === "chars") && Number.isInteger(limit.max) && limit.max > 0 && limit.max <= 10_000)) {
    throw new CardError("That limit doesn't look right");
  }
  const ctx = loadCtx(userId, jobId);
  const letter = getOrCreateLetter(userId, jobId);
  const keys = new Set(listOutputs(letter.id).flatMap((x) => (x.target.kind === "field" ? [x.target.fieldKey] : [])));
  let n = keys.size + 1;
  while (keys.has(`manual-${n}`)) n++;
  const target: OutputTarget = { kind: "field", fieldKey: `manual-${n}`, label: name };
  // The student asked for this answer, so a "no cover letter" posting does not turn it into skip.
  const m = chooseMode({ target, fieldType: "textarea", wordLimit: limit?.unit === "words" ? limit.max : undefined, charLimit: limit?.unit === "chars" ? limit.max : undefined, jdText: "" });
  upsertOutput(letter.id, target, { mode: m.mode, limit: m.limit });
  return view(ctx, letter);
}

/** For the route: the letter and output a generation runs on, plus whether it may run. */
export function generationTarget(userId: string, jobId: string, outputId: string) {
  const ctx = loadCtx(userId, jobId);
  const letter = getOrCreateLetter(userId, jobId);
  return { ctx, letter, output: getOutput(letter, outputId), feedbackOnly: feedbackOnly(ctx) };
}

