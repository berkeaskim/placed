import { db } from "../db/client";
import { isDupBullet } from "./match";
import {
  addBullet, appendBulletSource, appendEntrySource, getBank, getSourceKind, getSuggestion, insertEntry, listSuggestions, setSuggestionStatus,
} from "./store";
import type { BankSuggestion, MergeIntoPayload, NewBulletPayload, NewEntryPayload } from "./types";

function addToEntry(userId: string, entryId: string, texts: { text: string; sourceText: string }[], sourceId: string, manual: boolean): void {
  const entry = getBank(userId).entries.find((e) => e.id === entryId);
  if (!entry) throw new Error("Entry not found");
  const existing = entry.bullets.map((b) => b.text);
  let position = entry.bullets.reduce((m, b) => Math.max(m, b.position + 1), 0);
  for (const b of texts) {
    const dup = entry.bullets.find((x) => isDupBullet(b.text, [x.text]));
    if (dup || isDupBullet(b.text, existing)) {
      if (dup) appendBulletSource(userId, dup.id, sourceId);
      continue;
    }
    addBullet(userId, entryId, {
      text: b.text, position: position++, pinned: false, hidden: false,
      sourceIds: manual ? [sourceId, "manual"] : [sourceId], sourceText: b.sourceText,
    });
    existing.push(b.text);
  }
  appendEntrySource(userId, entryId, sourceId);
}

function apply(userId: string, s: BankSuggestion, opts: { editedText?: string; targetEntryId?: string }): void {
  if (s.kind === "new_entry") {
    const c = (s.payload as NewEntryPayload).candidate;
    insertEntry(userId, {
      section: c.section, org: c.org, title: c.title, dates: c.dates, startYm: c.startYm, endYm: c.endYm, location: c.location,
      pinned: false, hidden: false, sourceIds: [s.sourceId],
      bullets: c.bullets.map((b, i) => ({ text: b.text, position: i, pinned: false, hidden: false, sourceIds: [s.sourceId], sourceText: b.sourceText })),
    });
  } else if (s.kind === "new_bullet") {
    const p = s.payload as NewBulletPayload;
    if (!s.targetEntryId) throw new Error("Suggestion has no target entry");
    const edited = opts.editedText !== undefined && opts.editedText !== p.text;
    const text = opts.editedText ?? p.text;
    const entry = getBank(userId).entries.find((e) => e.id === s.targetEntryId);
    if (!entry) throw new Error("Entry not found");
    const position = entry.bullets.reduce((m, b) => Math.max(m, b.position + 1), 0);
    const added = addBullet(userId, entry.id, {
      text, position, pinned: false, hidden: false, sourceIds: edited ? [s.sourceId, "manual"] : [s.sourceId], sourceText: p.sourceText,
    });
    if (!added) throw new Error("Entry not found");
    appendEntrySource(userId, entry.id, s.sourceId);
  } else {
    const p = s.payload as MergeIntoPayload;
    if (!opts.targetEntryId || !p.targets.includes(opts.targetEntryId)) throw new Error("Pick one of the matching entries to merge into");
    addToEntry(userId, opts.targetEntryId, p.candidate.bullets, s.sourceId, false);
  }
}

/** Resolved or unknown suggestions are a no-op. Each accept is atomic with its status change. */
export function acceptSuggestion(userId: string, id: string, opts: { editedText?: string; targetEntryId?: string } = {}): void {
  if (opts.editedText !== undefined && !opts.editedText.trim()) throw new Error("Bullet text can't be empty");
  db.transaction(() => {
    const s = getSuggestion(userId, id);
    if (!s || s.status !== "pending") return;
    apply(userId, s, opts);
    setSuggestionStatus(userId, id, "accepted");
  });
}

export function rejectSuggestion(userId: string, id: string): void {
  const s = getSuggestion(userId, id);
  if (!s || s.status !== "pending") return;
  setSuggestionStatus(userId, id, "rejected");
}

/** Accepts this source's pending suggestions; merge_into needs a human-picked target so it stays pending and is not counted. */
export function acceptAllFromSource(userId: string, sourceId: string): number {
  if (getSourceKind(userId, sourceId) === "linkedin_post") throw new Error("Posts are reviewed one by one");
  let n = 0;
  for (const s of listSuggestions(userId, "pending")) {
    if (s.sourceId !== sourceId || s.kind === "merge_into") continue;
    if (s.kind === "new_bullet" && !getBank(userId).entries.some((e) => e.id === s.targetEntryId)) {
      rejectSuggestion(userId, s.id); // orphaned: its target entry was deleted
      continue;
    }
    try {
      acceptSuggestion(userId, s.id);
      n++;
    } catch {
      // the transaction rolled back; leave this one pending and carry on
    }
  }
  return n;
}
