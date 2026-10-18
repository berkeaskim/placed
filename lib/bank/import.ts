import { createHash } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { bankSources, linkedinScores } from "../db/schema";
import { getActiveCv } from "../db/queries";
import { parseCV } from "../ai/parseCV";
import { aiMode } from "../ai/config";
import { extractPostBullets } from "../ai/extractPostBullets";
import { AI_NOT_SET_UP, AiError } from "../ai/provider";
import { numberSet, unsupportedInSource } from "../verify/tailoring";
import { assignIds } from "../cv/ids";
import { extractPdf } from "../cv/pdf-text";
import { parseLinkedInExport, type ParsedLinkedIn } from "../linkedin/parse-export";
import { fromLinkedIn, fromParsedCv } from "./candidates";
import { isDupBullet, matchEntry, normOrg, sameEntry } from "./match";
import {
  addBullet, appendBulletSource, appendEntrySource, getBank, insertEntry, insertSuggestion, listSuggestions, upsertSource,
} from "./store";
import type {
  BankSourceKind, BankSuggestionKind, BankSuggestionPayload, CandidateEntry, MergeIntoPayload, NewBulletPayload, NewEntryPayload,
} from "./types";

type Source = { kind: BankSourceKind; ref: string | null; rawText: string };

const normText = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean).join(" ");
const candKey = (c: CandidateEntry) => `${normOrg(c.org)}|${c.title.toLowerCase().trim()}|${c.startYm ?? ""}`;

function payloadKey(kind: BankSuggestionKind, targetEntryId: string | null, payload: BankSuggestionPayload): string {
  const body = kind === "new_bullet" ? normText((payload as NewBulletPayload).text) : candKey((payload as NewEntryPayload | MergeIntoPayload).candidate);
  return `${kind}|${targetEntryId ?? ""}|${body}`;
}

/** De-dup keys of every pending or rejected suggestion: a re-import must not resurface them. */
function openSuggestionKeys(userId: string): Set<string> {
  return new Set(
    listSuggestions(userId).filter((s) => s.status === "rejected" || s.status === "pending")
      .map((s) => payloadKey(s.kind, s.targetEntryId, s.payload)),
  );
}

export function importCandidates(
  userId: string,
  source: Source,
  cands: CandidateEntry[],
  opts: { autoAccept: boolean },
): { suggestions: number; duplicates: number } {
  const { id: sourceId } = upsertSource(userId, source.kind, source.ref, source.rawText);
  const seen = openSuggestionKeys(userId);
  let suggestions = 0;
  let duplicates = 0;

  const suggest = (kind: BankSuggestionKind, targetEntryId: string | null, payload: BankSuggestionPayload) => {
    const key = payloadKey(kind, targetEntryId, payload);
    if (seen.has(key)) return;
    seen.add(key);
    insertSuggestion(userId, { sourceId, kind, targetEntryId, payload });
    suggestions++;
  };

  for (const c of cands) {
    const matches = matchEntry(c, getBank(userId).entries);
    if (matches.length === 0) {
      if (opts.autoAccept) {
        insertEntry(userId, {
          section: c.section, org: c.org, title: c.title, dates: c.dates, startYm: c.startYm, endYm: c.endYm, location: c.location,
          pinned: false, hidden: false, sourceIds: [sourceId],
          bullets: c.bullets.map((b, i) => ({ text: b.text, position: i, pinned: false, hidden: false, sourceIds: [sourceId], sourceText: b.sourceText })),
        });
      } else {
        suggest("new_entry", null, { candidate: c });
      }
    } else if (matches.length === 1) {
      const target = matches[0];
      const texts = target.bullets.map((b) => b.text);
      let position = target.bullets.length;
      for (const b of c.bullets) {
        const dup = target.bullets.find((x) => isDupBullet(b.text, [x.text]));
        if (dup || isDupBullet(b.text, texts)) {
          if (dup) appendBulletSource(userId, dup.id, sourceId);
          duplicates++;
        } else if (opts.autoAccept) {
          addBullet(userId, target.id, { text: b.text, position: position++, pinned: false, hidden: false, sourceIds: [sourceId], sourceText: b.sourceText });
          texts.push(b.text);
        } else {
          suggest("new_bullet", target.id, { text: b.text, sourceText: b.sourceText });
        }
      }
      appendEntrySource(userId, target.id, sourceId);
    } else {
      suggest("merge_into", null, { candidate: c, targets: matches.map((m) => m.id) });
    }
  }
  return { suggestions, duplicates };
}

export async function ensureBank(userId: string): Promise<{ bootstrapped: boolean; newCvSuggestions: number }> {
  const cv = await getActiveCv(userId);
  if (!cv) return { bootstrapped: false, newCvSuggestions: 0 };
  const source: Source = { kind: "cv", ref: cv.id, rawText: cv.rawText };
  const cvSource = (ref?: string) => db.select({ id: bankSources.id }).from(bankSources)
    .where(and(eq(bankSources.user_id, userId), eq(bankSources.kind, "cv"), ...(ref ? [eq(bankSources.ref, ref)] : []))).get();
  // Bootstrap only the first time: an empty bank with a prior cv source means the user cleared it on purpose.
  if (getBank(userId).entries.length === 0 && !cvSource()) {
    importCandidates(userId, source, fromParsedCv(cv.parsed), { autoAccept: true });
    return { bootstrapped: true, newCvSuggestions: 0 };
  }
  if (cvSource(cv.id)) return { bootstrapped: false, newCvSuggestions: 0 };
  const r = importCandidates(userId, source, fromParsedCv(cv.parsed), { autoAccept: false });
  return { bootstrapped: false, newCvSuggestions: r.suggestions };
}

export function importLinkedInFromLatestCapture(
  userId: string,
): { ok: true; suggestions: number; duplicates: number } | { error: "Capture your profile with the extension first" } {
  const row = db.select().from(linkedinScores).where(eq(linkedinScores.user_id, userId)).orderBy(desc(linkedinScores.created_at)).limit(1).get();
  if (!row) return { error: "Capture your profile with the extension first" };
  const li = row.profile_json as ParsedLinkedIn;
  const r = importCandidates(
    userId,
    { kind: "linkedin_capture", ref: li.profileUrl ?? "capture", rawText: JSON.stringify(li) },
    fromLinkedIn(li),
    { autoAccept: false },
  );
  return { ok: true, ...r };
}

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

export async function importLinkedInExport(userId: string, pdfBytes: Uint8Array) {
  const { text } = await extractPdf(pdfBytes);
  const li = parseLinkedInExport(text);
  return importCandidates(userId, { kind: "linkedin_export", ref: sha256(pdfBytes), rawText: text }, fromLinkedIn(li), { autoAccept: false });
}

export async function importCvPdf(userId: string, pdfBytes: Uint8Array) {
  const { text } = await extractPdf(pdfBytes);
  const parsed = assignIds(await parseCV({ base64: Buffer.from(pdfBytes).toString("base64"), text }));
  return importCandidates(userId, { kind: "cv", ref: sha256(pdfBytes), rawText: text }, fromParsedCv(parsed), { autoAccept: false });
}

const squash = (s: string) => s.replace(/\s+/g, " ").trim();
const MIN_EXCERPT = 15;

/** One key per bullet, so a post's bullets de-dup individually (payloadKey alone ignores a new_entry's bullets). */
function bulletKeys(kind: BankSuggestionKind, target: string | null, p: BankSuggestionPayload): string[] {
  if (kind === "new_bullet") return [`b|${target ?? ""}|${normText((p as NewBulletPayload).text)}`];
  if (kind === "new_entry") {
    const c = (p as NewEntryPayload).candidate;
    return c.bullets.map((b) => `e|${normText(c.title)}|${normText(b.text)}`);
  }
  return [];
}

const NEUTRAL_TITLE = "Project from LinkedIn post";

/** The AI's project title, kept only when every word of 3+ letters is in the post and it names no employer the post doesn't. */
function groundedTitle(title: string | null, post: string): string {
  const t = title?.trim() ?? "";
  if (!t) return NEUTRAL_TITLE;
  const postWords = new Set(normText(post).split(" "));
  const words = normText(t).split(" ").filter((w) => /[a-z]{3,}/.test(w));
  return words.every((w) => postWords.has(w)) && unsupportedInSource(t, post).length === 0 ? t : NEUTRAL_TITLE;
}

/**
 * LinkedIn posts -> pending suggestions. The AI proposes bullets; one is kept only if its excerpt (at least 15 characters)
 * is quoted from the post, every number in it appears in the post, and the gate's word-metric and known-employer checks
 * pass against the post. Anything else is counted in `dropped`. A project title not backed by the post becomes
 * "Project from LinkedIn post". Bullets for no existing entry that share a project title become one new_entry. Pending,
 * rejected and accepted suggestions, and bullets already in the bank, are never suggested again: the bank and the
 * de-dup keys are re-read after the AI call, in the same synchronous block as the inserts, so a double submit can't
 * insert twice.
 */
export async function importPosts(userId: string, posts: string[]): Promise<{ suggestions: number; dropped: number }> {
  if (aiMode() === "off") throw new AiError(AI_NOT_SET_UP);
  let suggestions = 0;
  let dropped = 0;
  for (const post of posts.map((p) => p.trim()).filter(Boolean)) {
    const { id: sourceId } = upsertSource(userId, "linkedin_post", sha256(new TextEncoder().encode(post)), post);
    const before = getBank(userId);
    const { items } = await extractPostBullets(post, before.entries.map((e) => ({ id: e.id, org: e.org, title: e.title })));
    // ---- synchronous from here to the inserts (better-sqlite3), so concurrent imports see each other's rows ----
    const bank = getBank(userId);
    const seen = new Set(listSuggestions(userId).flatMap((s) => bulletKeys(s.kind, s.targetEntryId, s.payload)));
    const flat = squash(post);
    const postNums = numberSet(post);
    const groups = new Map<string, CandidateEntry>();
    for (const it of items) {
      const text = it.text.trim();
      const excerpt = squash(it.excerpt);
      const grounded = text.length > 0 && excerpt.length >= MIN_EXCERPT && flat.includes(excerpt)
        && [...numberSet(text)].every((n) => postNums.has(n)) && unsupportedInSource(text, post).length === 0;
      if (!grounded) { dropped++; continue; }
      const target = it.entryHint
        ? bank.entries.find((e) => sameEntry({ org: it.entryHint!.org, title: it.entryHint!.title, startYm: null, endYm: null }, e))
        : undefined;
      const bullet = { text, sourceText: it.excerpt };
      if (target) {
        if (isDupBullet(text, target.bullets.map((b) => b.text))) continue;
        const payload: NewBulletPayload = bullet;
        const [key] = bulletKeys("new_bullet", target.id, payload);
        if (seen.has(key)) continue;
        seen.add(key);
        insertSuggestion(userId, { sourceId, kind: "new_bullet", targetEntryId: target.id, payload });
        suggestions++;
        continue;
      }
      const title = groundedTitle(it.newProjectTitle, post);
      const held = bank.entries.some((e) => e.section === "projects" && normText(e.title) === normText(title) && isDupBullet(text, e.bullets.map((b) => b.text)));
      const key = `e|${normText(title)}|${normText(text)}`;
      if (held || seen.has(key)) continue;
      seen.add(key);
      const g = groups.get(normText(title)) ?? {
        section: "projects", org: "", title, dates: "", startYm: null, endYm: null, location: "", bullets: [],
      } satisfies CandidateEntry;
      g.bullets.push(bullet);
      groups.set(normText(title), g);
    }
    for (const candidate of groups.values()) {
      insertSuggestion(userId, { sourceId, kind: "new_entry", targetEntryId: null, payload: { candidate } });
      suggestions++;
    }
  }
  return { suggestions, dropped };
}
