import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  companyResearch, coverLetterOutputs, coverLetters, coverLetterStories,
  type LetterRow, type OutputRow, type ResearchRow, type StoryRow,
} from "@/lib/db/schema";
import type { OutputTarget, Span } from "./types";

export const RESEARCH_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const stamp = () => new Date().toISOString();

export function getOrCreateLetter(userId: string, jobId: string): LetterRow {
  db.insert(coverLetters).values({ user_id: userId, job_id: jobId }).onConflictDoNothing().run();
  return db.select().from(coverLetters).where(and(eq(coverLetters.user_id, userId), eq(coverLetters.job_id, jobId))).get()!;
}

export function saveLetter(id: string, patch: Partial<LetterRow>): void {
  const { id: _id, ...rest } = patch;
  db.update(coverLetters).set({ ...rest, updated_at: stamp() }).where(eq(coverLetters.id, id)).run();
}

export function listOutputs(letterId: string): OutputRow[] {
  return db.select().from(coverLetterOutputs).where(eq(coverLetterOutputs.letter_id, letterId)).all();
}

const sameTarget = (a: OutputTarget, b: OutputTarget) =>
  a.kind === "upload" ? b.kind === "upload" : b.kind === "field" && a.fieldKey === b.fieldKey;

/** One output per target: the upload, or one per form field (fieldKey). Creates it (mode required then) or patches it. */
export function upsertOutput(letterId: string, target: OutputTarget, patch: Partial<Omit<OutputRow, "id" | "letter_id" | "target">>): OutputRow {
  const existing = listOutputs(letterId).find((o) => sameTarget(o.target, target));
  if (existing) {
    return db.update(coverLetterOutputs).set({ ...patch, updated_at: stamp() }).where(eq(coverLetterOutputs.id, existing.id)).returning().get();
  }
  return db.insert(coverLetterOutputs).values({ mode: "full_letter", ...patch, letter_id: letterId, target }).returning().get();
}

function getOutput(id: string): OutputRow | undefined {
  return db.select().from(coverLetterOutputs).where(eq(coverLetterOutputs.id, id)).get();
}

export function pushUndo(outputId: string, prev: { text: string; spans: Span[] }): void {
  const o = getOutput(outputId);
  if (!o) return;
  db.update(coverLetterOutputs).set({ undo: [...o.undo, prev], updated_at: stamp() }).where(eq(coverLetterOutputs.id, outputId)).run();
}

export function popUndo(outputId: string): { text: string; spans: Span[] } | null {
  const o = getOutput(outputId);
  const prev = o?.undo[o.undo.length - 1];
  if (!o || !prev) return null;
  db.update(coverLetterOutputs).set({ undo: o.undo.slice(0, -1), updated_at: stamp() }).where(eq(coverLetterOutputs.id, outputId)).run();
  return prev;
}

export function rememberStory(userId: string, s: { kind: StoryRow["kind"]; cvEntryId?: string; company?: string; text: string }): void {
  db.insert(coverLetterStories).values({ user_id: userId, kind: s.kind, cv_entry_id: s.cvEntryId ?? null, company: s.company ?? null, text: s.text }).run();
}

export function findStories(userId: string, q: { cvEntryId?: string; company?: string; kind: StoryRow["kind"] }): StoryRow[] {
  return db.select().from(coverLetterStories).where(and(
    eq(coverLetterStories.user_id, userId),
    eq(coverLetterStories.kind, q.kind),
    q.cvEntryId ? eq(coverLetterStories.cv_entry_id, q.cvEntryId) : undefined,
    q.company ? eq(coverLetterStories.company, q.company) : undefined,
  )).all();
}

export function deleteStory(userId: string, id: string): void {
  db.delete(coverLetterStories).where(and(eq(coverLetterStories.user_id, userId), eq(coverLetterStories.id, id))).run();
}

/** Cached research for a company key; null when missing or older than 7 days. */
export function getResearch(key: string, now = Date.now()): ResearchRow | null {
  const r = db.select().from(companyResearch).where(eq(companyResearch.company_key, key)).get();
  if (!r) return null;
  return now - new Date(r.fetched_at).getTime() > RESEARCH_TTL_MS ? null : r;
}

export function putResearch(row: Pick<ResearchRow, "company_key" | "facts" | "rivals" | "provider"> & { fetched_at?: string }): void {
  const v = { ...row, fetched_at: row.fetched_at ?? stamp() };
  db.insert(companyResearch).values(v).onConflictDoUpdate({ target: companyResearch.company_key, set: v }).run();
}
