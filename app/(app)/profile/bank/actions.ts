"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireUser } from "@/lib/auth/local-user";
import { parseYm } from "@/lib/bank/match";
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
