import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { confirmedFacts, playbookProgress, profiles } from "@/lib/db/schema";
import { awardXP } from "@/lib/gamify/award";
import type { AwardResult } from "@/lib/gamify/core";
import { PLAYBOOKS, type Action } from "@/lib/playbooks";
import { ARCHETYPES, type Archetype, type Year } from "@/lib/types";
import { canonicalize } from "@/lib/skills/extract";
import { openToYear } from "./actions";
import { targetFor } from "./view";

const MIN_NOTE = 10;
const MAX_NOTE = 500;
const MAX_URL = 300;
const SAVE_FAILED = "Couldn't save that — try again.";

export function findAction(id: string): Action | null {
  for (const a of ARCHETYPES) {
    const hit = PLAYBOOKS[a].actions.find((x) => x.id === id);
    if (hit) return hit;
  }
  return null;
}

/** An action the student can actually see: in their target role's playbook and open to their year. */
export function actionFor(id: string, sector: Archetype, year: Year): Action | null {
  const a = PLAYBOOKS[sector].actions.find((x) => x.id === id);
  return a && openToYear(a, year) ? a : null;
}

function studentTarget(userId: string) {
  const row = db.select({ target_archetype: profiles.target_archetype, archetypes: profiles.archetypes, year: profiles.year })
    .from(profiles).where(eq(profiles.user_id, userId)).get();
  return targetFor(row ?? {});
}

const progressOf = (userId: string, id: string) =>
  db.select({ status: playbookProgress.status }).from(playbookProgress)
    .where(and(eq(playbookProgress.user_id, userId), eq(playbookProgress.action_id, id))).get();

function upsertProgress(row: typeof playbookProgress.$inferInsert) {
  // like a PostgREST upsert: only the columns given are overwritten
  const set = Object.fromEntries(Object.entries(row).filter(([k]) => k !== "user_id" && k !== "action_id"));
  db.insert(playbookProgress).values(row)
    .onConflictDoUpdate({ target: [playbookProgress.user_id, playbookProgress.action_id], set }).run();
}

/** Runs a write; false (logged) when the DB rejects it. */
function tryWrite(what: string, fn: () => void): boolean {
  try {
    fn();
    return true;
  } catch (e) {
    console.error(`target: ${what} failed`, e instanceof Error ? e.message : e);
    return false;
  }
}

/** The note is the student's own words: trimmed, never rewritten. The link is kept apart from it. */
export function validateCompletion(note: unknown, url: unknown): { note: string; url: string | null } | { error: string } {
  if (typeof note !== "string" || (url !== undefined && url !== null && typeof url !== "string")) return { error: "Tell us in a sentence what you did." };
  const clean = note.replace(/\s+/g, " ").trim();
  if (clean.length < MIN_NOTE) return { error: "Tell us in a sentence what you did — that's what lets us use it on your CV." };
  if (clean.length > MAX_NOTE) return { error: `Keep it under ${MAX_NOTE} characters.` };
  const link = typeof url === "string" ? url.trim() || null : null;
  if (link) {
    let ok = link.length <= MAX_URL && /^https:\/\/\S+$/.test(link);
    try { ok = ok && new URL(link).protocol === "https:"; } catch { ok = false; }
    if (!ok) return { error: `Links must start with https:// and be under ${MAX_URL} characters.` };
  }
  return { note: clean, url: link };
}

export async function planAction(userId: string, id: unknown) {
  if (typeof id !== "string" || !findAction(id)) return { error: "Unknown action." };
  const t = studentTarget(userId);
  if (!actionFor(id, t.sector, t.year)) return { error: "That step isn't part of your target role." };
  if (progressOf(userId, id)?.status === "done") return { ok: true as const }; // never downgrade a done item
  const ok = tryWrite("plan", () => upsertProgress({ user_id: userId, action_id: id, status: "planned", updated_at: new Date().toISOString() }));
  return ok ? { ok: true as const } : { error: SAVE_FAILED };
}

export type CompleteResult = { error: string } | { award: AwardResult | null; firstTime: boolean };

/**
 * Marks an action done. The student's note (their words only, never our action title, which would smuggle the
 * playbook's skills into the corpus) becomes a confirmed fact: the only way a playbook item reaches tailoring.
 * Order: fact first, then done, so "done" always implies the fact exists and a retry can't skip it.
 */
export async function completeAction(userId: string, id: unknown, note: unknown, url: unknown): Promise<CompleteResult> {
  if (typeof id !== "string" || !findAction(id)) return { error: "Unknown action." };
  const v = validateCompletion(note, url);
  if ("error" in v) return v;
  const t = studentTarget(userId);
  if (!actionFor(id, t.sector, t.year)) return { error: "That step isn't part of your target role." };

  const firstTime = progressOf(userId, id)?.status !== "done";
  if (firstTime && !tryWrite("fact insert", () => db.insert(confirmedFacts).values({ user_id: userId, claim: v.note, source: "user-stated" }).run())) {
    return { error: SAVE_FAILED };
  }
  const up = tryWrite("complete", () => upsertProgress({
    user_id: userId, action_id: id, status: "done", evidence_note: v.note, evidence_url: v.url, updated_at: new Date().toISOString(),
  }));
  if (!up) return { error: SAVE_FAILED };
  if (!firstTime) return { award: null, firstTime };
  try {
    // xp_events.ref makes this once per action even if two requests race
    return { award: await awardXP(userId, { type: "playbook_done", ref: id }), firstTime };
  } catch (e) {
    console.error("completeAction: awardXP failed", e instanceof Error ? e.message : e);
    return { award: null, firstTime }; // the action and the fact are saved; only the XP is missing
  }
}

/**
 * "Have you really used {skill}?" → yes, with where/how in the student's own words. Stored as a confirmed fact so
 * verifyTailoring accepts the skill from now on; the CV itself is never changed. No XP: a claim isn't an action.
 * The link is not part of the claim, so a URL path can't confirm extra skills.
 */
export async function confirmSkill(userId: string, skill: unknown, note: unknown, url: unknown) {
  const canon = typeof skill === "string" ? canonicalize(skill.trim()) : null;
  if (!canon) return { error: "Unknown skill." };
  const v = validateCompletion(note, url);
  if ("error" in v) return { error: v.error.replace("what you did", `where you used ${canon}`) };
  const prefix = `${canon}: `;
  const prev = db.select({ id: confirmedFacts.id }).from(confirmedFacts)
    .where(and(eq(confirmedFacts.user_id, userId), sql`instr(${confirmedFacts.claim}, ${prefix}) = 1`)).limit(1).get();
  if (prev) return { ok: true as const, stored: null };
  const claim = `${prefix}${v.note}`;
  const ok = tryWrite("skill fact insert", () => db.insert(confirmedFacts).values({ user_id: userId, claim, source: "user-stated" }).run());
  return ok ? { ok: true as const, stored: claim } : { error: SAVE_FAILED };
}
