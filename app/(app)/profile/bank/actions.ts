"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/local-user";
import { AI_NOT_SET_UP, isAiNotSetUp } from "@/lib/ai/provider";
import { importCvPdf, importLinkedInExport, importLinkedInFromLatestCapture, importPosts } from "@/lib/bank/import";
import { parseYm } from "@/lib/bank/match";
import { acceptAllFromSource, acceptSuggestion, rejectSuggestion } from "@/lib/bank/suggestions";
import { cvSizeError } from "@/lib/cv/upload-limits";
import { addBullet, deleteBullet, getBank, insertEntry, updateBullet, updateEntry } from "@/lib/bank/store";
import { BANK_SECTION_VALUES } from "@/lib/db/schema";

export type BankActionResult = { ok: true } | { error: string };

const BANK_PATH = "/profile/bank";
const bulletText = z.string().trim().min(1, "Write something first.").max(300, "Keep a bullet to 300 characters or fewer.");
const flag = z.enum(["pinned", "hidden"]);
const entryInput = z.object({
  section: z.enum(BANK_SECTION_VALUES),
  org: z.string().trim().min(1, "Add an organisation.").max(120, "Keep the organisation to 120 characters or fewer."),
  title: z.string().trim().min(1, "Add a title.").max(120, "Keep the title to 120 characters or fewer."),
  dates: z.string().trim().max(60, "Keep the dates to 60 characters or fewer.").default(""),
  location: z.string().trim().max(120, "Keep the location to 120 characters or fewer.").default(""),
});
const fail = (e: z.ZodError): BankActionResult => ({ error: e.issues[0]?.message ?? "That doesn't look right." });
const done = (): BankActionResult => { revalidatePath(BANK_PATH); return { ok: true }; };

export async function editBullet(id: string, text: string): Promise<BankActionResult> {
  const { user } = await requireUser();
  const t = bulletText.safeParse(text);
  if (!t.success) return fail(t.error);
  updateBullet(user.id, id, { text: t.data });
  return done();
}

export async function toggleBullet(id: string, field: "pinned" | "hidden"): Promise<BankActionResult> {
  const { user } = await requireUser();
  const f = flag.safeParse(field);
  if (!f.success) return { error: "Unknown option." };
  const cur = getBank(user.id).entries.flatMap((e) => e.bullets).find((b) => b.id === id);
  if (!cur) return { error: "That bullet no longer exists." };
  updateBullet(user.id, id, { [f.data]: !cur[f.data] });
  return done();
}

export async function toggleEntry(id: string, field: "pinned" | "hidden"): Promise<BankActionResult> {
  const { user } = await requireUser();
  const f = flag.safeParse(field);
  if (!f.success) return { error: "Unknown option." };
  const cur = getBank(user.id).entries.find((e) => e.id === id);
  if (!cur) return { error: "That entry no longer exists." };
  updateEntry(user.id, id, { [f.data]: !cur[f.data] });
  return done();
}

/** Swap with the neighbour in the entry's bullet order; positions are renumbered 0..n-1 so duplicates cannot stick. */
export async function moveBullet(id: string, dir: -1 | 1): Promise<BankActionResult> {
  const { user } = await requireUser();
  if (dir !== -1 && dir !== 1) return { error: "Unknown direction." };
  const entry = getBank(user.id).entries.find((e) => e.bullets.some((b) => b.id === id));
  if (!entry) return { error: "That bullet no longer exists." };
  const ids = entry.bullets.map((b) => b.id);
  const i = ids.indexOf(id);
  const j = i + dir;
  if (j < 0 || j >= ids.length) return { ok: true };
  [ids[i], ids[j]] = [ids[j], ids[i]];
  entry.bullets.forEach((b) => { const p = ids.indexOf(b.id); if (p !== b.position) updateBullet(user.id, b.id, { position: p }); });
  return done();
}

/** Provenance for hand-written items is the literal "manual" in sourceIds, the same marker `updateBullet` adds on a text edit. */
export async function addManualEntry(input: z.input<typeof entryInput>): Promise<BankActionResult> {
  const { user } = await requireUser();
  const p = entryInput.safeParse(input);
  if (!p.success) return fail(p.error);
  const { startYm, endYm } = p.data.dates ? parseYm(p.data.dates) : { startYm: null, endYm: null };
  insertEntry(user.id, { ...p.data, startYm, endYm, pinned: false, hidden: false, sourceIds: ["manual"], bullets: [] });
  return done();
}

export async function addManualBullet(entryId: string, text: string): Promise<BankActionResult> {
  const { user } = await requireUser();
  const t = bulletText.safeParse(text);
  if (!t.success) return fail(t.error);
  const entry = getBank(user.id).entries.find((e) => e.id === entryId);
  if (!entry) return { error: "That entry no longer exists." };
  const position = entry.bullets.reduce((m, b) => Math.max(m, b.position), -1) + 1;
  const b = addBullet(user.id, entryId, { text: t.data, position, pinned: false, hidden: false, sourceIds: ["manual"], sourceText: null });
  if (!b) return { error: "That entry no longer exists." };
  return done();
}

export async function deleteBulletAction(id: string): Promise<BankActionResult> {
  const { user } = await requireUser();
  deleteBullet(user.id, id);
  return done();
}

/* ---- Imports and suggestion review ---- */

export type ImportResult = { ok: true; suggestions: number; duplicates?: number; dropped?: number } | { error: string };

const MAX_POSTS = 10;
const MAX_POST_CHARS = 5000;
const postsInput = z.array(z.string().max(MAX_POST_CHARS, `Keep each post to ${MAX_POST_CHARS} characters or fewer.`)).max(MAX_POSTS, `Paste ${MAX_POSTS} posts or fewer at a time.`);

/** Reads and checks an uploaded PDF the same way the CV upload does: type, size cap, "%PDF-" header. */
async function readPdf(formData: FormData, field: string): Promise<{ bytes: Uint8Array } | { error: string }> {
  const file = formData.get(field);
  if (!(file instanceof File) || file.size === 0) return { error: "Choose a PDF first." };
  if (file.type !== "application/pdf") return { error: "Please upload a PDF." };
  const tooBig = cvSizeError(file.size);
  if (tooBig) return { error: tooBig };
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (new TextDecoder().decode(bytes.subarray(0, 5)) !== "%PDF-") return { error: "That doesn't look like a PDF. Export it as PDF and try again." };
  return { bytes };
}

const importFailed = (e: unknown, fallback: string): { error: string } =>
  ({ error: isAiNotSetUp(e) ? AI_NOT_SET_UP : fallback });

export async function importCvAction(formData: FormData): Promise<ImportResult> {
  const { user } = await requireUser();
  const pdf = await readPdf(formData, "cv");
  if ("error" in pdf) return pdf;
  try {
    const r = await importCvPdf(user.id, pdf.bytes);
    revalidatePath(BANK_PATH);
    return { ok: true, ...r };
  } catch (e) { return importFailed(e, "We couldn't read that CV. Try exporting it as a PDF again."); }
}

export async function importLinkedInExportAction(formData: FormData): Promise<ImportResult> {
  const { user } = await requireUser();
  const pdf = await readPdf(formData, "export");
  if ("error" in pdf) return pdf;
  try {
    const r = await importLinkedInExport(user.id, pdf.bytes);
    revalidatePath(BANK_PATH);
    return { ok: true, ...r };
  } catch (e) { return importFailed(e, "We couldn't read that LinkedIn PDF. Use LinkedIn's Save to PDF."); }
}

export async function importLinkedInCaptureAction(): Promise<ImportResult> {
  const { user } = await requireUser();
  const r = importLinkedInFromLatestCapture(user.id);
  if ("error" in r) return r;
  revalidatePath(BANK_PATH);
  return r;
}

export async function importPostsAction(texts: string[]): Promise<ImportResult> {
  const { user } = await requireUser();
  const p = postsInput.safeParse(texts);
  if (!p.success) return { error: p.error.issues[0]?.message ?? "That doesn't look right." };
  const posts = p.data.map((t) => t.trim()).filter(Boolean);
  if (!posts.length) return { error: "Paste a post first." };
  try {
    const r = await importPosts(user.id, posts);
    revalidatePath(BANK_PATH);
    return { ok: true, ...r };
  } catch (e) { return importFailed(e, "We couldn't read those posts. Try again in a moment."); }
}

const id = z.string().min(1).max(100);

export async function acceptAction(suggestionId: string, opts: { editedText?: string; targetEntryId?: string } = {}): Promise<BankActionResult> {
  const { user } = await requireUser();
  if (!id.safeParse(suggestionId).success) return { error: "Unknown suggestion." };
  const text = opts.editedText === undefined ? undefined : bulletText.safeParse(opts.editedText);
  if (text && !text.success) return fail(text.error);
  try {
    acceptSuggestion(user.id, suggestionId, { editedText: text?.data, targetEntryId: opts.targetEntryId });
  } catch (e) { return { error: e instanceof Error ? e.message : "Couldn't add that." }; }
  return done();
}

export async function rejectAction(suggestionId: string): Promise<BankActionResult> {
  const { user } = await requireUser();
  rejectSuggestion(user.id, suggestionId);
  return done();
}

export async function acceptAllAction(sourceId: string): Promise<BankActionResult> {
  const { user } = await requireUser();
  try { acceptAllFromSource(user.id, sourceId); } catch (e) { return { error: e instanceof Error ? e.message : "Couldn't add those." }; }
  return done();
}
