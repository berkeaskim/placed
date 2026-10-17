import { and, asc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { bankBullets, bankEntries, bankSources, bankSuggestions } from "../db/schema";
import type {
  Bank, BankBullet, BankEntry, BankSection, BankSourceKind, BankSuggestion, BankSuggestionKind, BankSuggestionPayload, BankSuggestionStatus,
} from "./types";

type EntryRow = typeof bankEntries.$inferSelect;
type BulletRow = typeof bankBullets.$inferSelect;

const toBullet = (r: BulletRow): BankBullet => ({
  id: r.id, entryId: r.entry_id, text: r.text, position: r.position, pinned: r.pinned, hidden: r.hidden,
  sourceIds: r.source_ids, sourceText: r.source_text, updatedAt: r.updated_at,
});
const toEntry = (r: EntryRow, bullets: BulletRow[]): BankEntry => ({
  id: r.id, section: r.section as BankSection, org: r.org, title: r.title, dates: r.dates,
  startYm: r.start_ym, endYm: r.end_ym, location: r.location, pinned: r.pinned, hidden: r.hidden,
  sourceIds: r.source_ids, bullets: bullets.map(toBullet), updatedAt: r.updated_at,
});
const toSuggestion = (r: typeof bankSuggestions.$inferSelect): BankSuggestion => ({
  id: r.id, sourceId: r.source_id, kind: r.kind as BankSuggestionKind, targetEntryId: r.target_entry_id,
  payload: r.payload as BankSuggestionPayload, status: r.status as BankSuggestionStatus, createdAt: r.created_at,
});

const nowIso = () => new Date().toISOString();

export function getBank(userId: string): Bank {
  const entries = db.select().from(bankEntries).where(eq(bankEntries.user_id, userId)).orderBy(asc(bankEntries.created_at)).all();
  const bullets = db.select().from(bankBullets).where(eq(bankBullets.user_id, userId)).orderBy(asc(bankBullets.position)).all();
  const byEntry = new Map<string, BulletRow[]>();
  for (const b of bullets) byEntry.set(b.entry_id, [...(byEntry.get(b.entry_id) ?? []), b]);
  return { entries: entries.map((e) => toEntry(e, byEntry.get(e.id) ?? [])) };
}

export type NewBullet = Omit<BankBullet, "id" | "entryId" | "updatedAt">;
export type NewEntry = Omit<BankEntry, "id" | "bullets" | "updatedAt"> & { bullets: NewBullet[] };

export function insertEntry(userId: string, e: NewEntry): BankEntry {
  return db.transaction((tx) => {
    const row = tx.insert(bankEntries).values({
      user_id: userId, section: e.section, org: e.org, title: e.title, dates: e.dates, start_ym: e.startYm, end_ym: e.endYm,
      location: e.location, pinned: e.pinned, hidden: e.hidden, source_ids: e.sourceIds,
    }).returning().get();
    const rows = e.bullets.map((b) => tx.insert(bankBullets).values({
      entry_id: row.id, user_id: userId, text: b.text, position: b.position, pinned: b.pinned, hidden: b.hidden,
      source_ids: b.sourceIds, source_text: b.sourceText,
    }).returning().get());
    return toEntry(row, rows.sort((a, b) => a.position - b.position));
  });
}

export type EntryPatch = Partial<Pick<BankEntry, "section" | "org" | "title" | "dates" | "startYm" | "endYm" | "location" | "pinned" | "hidden">>;

export function updateEntry(userId: string, id: string, patch: EntryPatch): void {
  const set: Partial<typeof bankEntries.$inferInsert> = { updated_at: nowIso() };
  if (patch.section !== undefined) set.section = patch.section;
  if (patch.org !== undefined) set.org = patch.org;
  if (patch.title !== undefined) set.title = patch.title;
  if (patch.dates !== undefined) set.dates = patch.dates;
  if (patch.startYm !== undefined) set.start_ym = patch.startYm;
  if (patch.endYm !== undefined) set.end_ym = patch.endYm;
  if (patch.location !== undefined) set.location = patch.location;
  if (patch.pinned !== undefined) set.pinned = patch.pinned;
  if (patch.hidden !== undefined) set.hidden = patch.hidden;
  db.update(bankEntries).set(set).where(and(eq(bankEntries.id, id), eq(bankEntries.user_id, userId))).run();
}

export type BulletPatch = Partial<Pick<BankBullet, "text" | "position" | "pinned" | "hidden">>;

/** A text edit is the student's own claim: provenance gains "manual", `source_text` is kept. */
export function updateBullet(userId: string, id: string, patch: BulletPatch): void {
  const where = and(eq(bankBullets.id, id), eq(bankBullets.user_id, userId));
  const cur = db.select().from(bankBullets).where(where).get();
  if (!cur) return;
  const set: Partial<typeof bankBullets.$inferInsert> = { updated_at: nowIso() };
  if (patch.text !== undefined) {
    set.text = patch.text;
    if (!cur.source_ids.includes("manual")) set.source_ids = [...cur.source_ids, "manual"];
  }
  if (patch.position !== undefined) set.position = patch.position;
  if (patch.pinned !== undefined) set.pinned = patch.pinned;
  if (patch.hidden !== undefined) set.hidden = patch.hidden;
  db.update(bankBullets).set(set).where(where).run();
}

export function addBullet(userId: string, entryId: string, b: NewBullet): BankBullet | null {
  const entry = db.select({ id: bankEntries.id }).from(bankEntries).where(and(eq(bankEntries.id, entryId), eq(bankEntries.user_id, userId))).get();
  if (!entry) return null;
  const row = db.insert(bankBullets).values({
    entry_id: entryId, user_id: userId, text: b.text, position: b.position, pinned: b.pinned, hidden: b.hidden,
    source_ids: b.sourceIds, source_text: b.sourceText,
  }).returning().get();
  return toBullet(row);
}

export function deleteBullet(userId: string, id: string): void {
  db.delete(bankBullets).where(and(eq(bankBullets.id, id), eq(bankBullets.user_id, userId))).run();
}

export function appendBulletSource(userId: string, bulletId: string, sourceId: string): void {
  const where = and(eq(bankBullets.id, bulletId), eq(bankBullets.user_id, userId));
  const cur = db.select({ s: bankBullets.source_ids }).from(bankBullets).where(where).get();
  if (!cur || cur.s.includes(sourceId)) return;
  db.update(bankBullets).set({ source_ids: [...cur.s, sourceId], updated_at: nowIso() }).where(where).run();
}

export function appendEntrySource(userId: string, entryId: string, sourceId: string): void {
  const where = and(eq(bankEntries.id, entryId), eq(bankEntries.user_id, userId));
  const cur = db.select({ s: bankEntries.source_ids }).from(bankEntries).where(where).get();
  if (!cur || cur.s.includes(sourceId)) return;
  db.update(bankEntries).set({ source_ids: [...cur.s, sourceId], updated_at: nowIso() }).where(where).run();
}

/** Idempotent on (kind, ref) when ref is set; re-importing refreshes `raw_text`. A null ref always creates a new source. */
export function upsertSource(userId: string, kind: BankSourceKind, ref: string | null, rawText: string): { id: string; created: boolean } {
  if (ref !== null) {
    const where = and(eq(bankSources.user_id, userId), eq(bankSources.kind, kind), eq(bankSources.ref, ref));
    const cur = db.select({ id: bankSources.id }).from(bankSources).where(where).get();
    if (cur) {
      db.update(bankSources).set({ raw_text: rawText, imported_at: nowIso() }).where(where).run();
      return { id: cur.id, created: false };
    }
  }
  const row = db.insert(bankSources).values({ user_id: userId, kind, ref, raw_text: rawText }).returning({ id: bankSources.id }).get();
  return { id: row.id, created: true };
}

export function listSuggestions(userId: string, status?: BankSuggestionStatus): BankSuggestion[] {
  const where = status ? and(eq(bankSuggestions.user_id, userId), eq(bankSuggestions.status, status)) : eq(bankSuggestions.user_id, userId);
  return db.select().from(bankSuggestions).where(where).orderBy(asc(bankSuggestions.created_at)).all().map(toSuggestion);
}

export function insertSuggestion(
  userId: string,
  s: { sourceId: string; kind: BankSuggestionKind; targetEntryId: string | null; payload: BankSuggestionPayload },
): BankSuggestion {
  const row = db.insert(bankSuggestions).values({
    user_id: userId, source_id: s.sourceId, kind: s.kind, target_entry_id: s.targetEntryId, payload: s.payload,
  }).returning().get();
  return toSuggestion(row);
}

export function setSuggestionStatus(userId: string, id: string, status: BankSuggestionStatus): void {
  db.update(bankSuggestions)
    .set({ status, resolved_at: status === "pending" ? null : nowIso() })
    .where(and(eq(bankSuggestions.id, id), eq(bankSuggestions.user_id, userId))).run();
}

export function getSuggestion(userId: string, id: string): BankSuggestion | null {
  const row = db.select().from(bankSuggestions).where(and(eq(bankSuggestions.id, id), eq(bankSuggestions.user_id, userId))).get();
  return row ? toSuggestion(row) : null;
}

export function getSourceKind(userId: string, id: string): BankSourceKind | null {
  const row = db.select({ k: bankSources.kind }).from(bankSources).where(and(eq(bankSources.id, id), eq(bankSources.user_id, userId))).get();
  return row ? (row.k as BankSourceKind) : null;
}

/** The id of the user's source row for (kind, ref), or null. Used to find the active CV's source (Task 8). */
export function getSourceId(userId: string, kind: BankSourceKind, ref: string): string | null {
  const row = db.select({ id: bankSources.id }).from(bankSources)
    .where(and(eq(bankSources.user_id, userId), eq(bankSources.kind, kind), eq(bankSources.ref, ref))).get();
  return row?.id ?? null;
}
