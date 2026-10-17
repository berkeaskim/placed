"use server";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { autopilotLongAnswers, autopilotPacks, autopilotVault, companies, coverLetterOutputs, coverLetters, jobs } from "@/lib/db/schema";
import { buildPack, draftInputFor, generateDraft, getVault } from "@/lib/autopilot/server";
import { suggestIdeas, type Idea } from "@/lib/autopilot/ideas";
import { reviseAnswer, type ReviseHow } from "@/lib/autopilot/revise";
import type { DraftResult } from "@/lib/autopilot/drafts";
import { canOpen, type Answers, type PackItem } from "@/lib/autopilot/pack";
import { mintToken } from "@/lib/autopilot/handoff";
import { normLabel } from "@/lib/autopilot/vault";
import { sealAnswers, sealLongAnswer, sealVault, type StoredAnswer } from "@/lib/autopilot/vault-crypto";
import { FormUnavailableError } from "@/lib/autopilot/forms/types";
import { isUuid } from "@/lib/feed/save-result";
import { env } from "@/lib/env";
import { classify } from "@/lib/autopilot/classify";
import { safeHttpUrl } from "@/lib/text/url";
import type { FormField, NormalizedForm } from "@/lib/autopilot/forms/types";

type Prepared = { locked: true } | { error: string; applyUrl: string | null } | { items: PackItem[]; answers: Answers };

const ownPack = (userId: string, jobId: string) => and(eq(autopilotPacks.user_id, userId), eq(autopilotPacks.job_id, jobId));

const MAX_TEXT = 5000, MAX_ITEMS = 50, MAX_ITEM = 500, MAX_EXTRA_KEYS = 200;

function validValue(v: unknown): v is string | string[] {
  if (typeof v === "string") return v.length <= MAX_TEXT;
  return Array.isArray(v) && v.length <= MAX_ITEMS && v.every((x) => typeof x === "string" && x.length <= MAX_ITEM);
}

/** What to remember: the chosen option LABEL(s) (from the stored form), Yes/No for booleans, or short text. */
function rememberable(field: FormField, value: string | string[]): string | string[] | null {
  if (Array.isArray(value)) {
    if (!field.options.length) return null;
    const labels = value.map((v) => field.options.find((o) => o.value === v)?.label);
    return labels.length && labels.every((l): l is string => Boolean(l)) ? labels : null;
  }
  if (field.options.length) return field.options.find((o) => o.value === value)?.label ?? null;
  if (field.type === "boolean") return value === "true" ? "Yes" : value === "false" ? "No" : null;
  const t = value.trim();
  return t && t.length <= MAX_ITEM ? t : null;
}

export async function preparePack(jobId: string): Promise<Prepared> {
  const { user } = await requireUser();
  if (!env.autopilot) return { error: "Autopilot isn't switched on.", applyUrl: null };
  if (!isUuid(jobId)) return { error: "Unknown job", applyUrl: null };
  if (!(await getVault(user.id)).completed) return { locked: true };
  try {
    return await buildPack(user.id, jobId);
  } catch (e) {
    console.error("autopilot preparePack:", e instanceof Error ? e.message : "unknown error");
    const data = db.select({ url: jobs.url }).from(jobs).where(eq(jobs.id, jobId)).get();
    return {
      error: e instanceof FormUnavailableError ? "We couldn't read this form. Here's the normal Apply link." : "Something went wrong building your pack.",
      applyUrl: safeHttpUrl(data?.url),
    };
  }
}

/**
 * Merges one answer into the pack. The field must exist in the stored form. A draft is only approved when the caller
 * says so, so editing text after approval (no `approved`) resets it. Unless `remember: false`, a short (non-free-text)
 * answer is also stored in the vault for every later form; the label and option text come from the stored form,
 * never from the client. Diversity (EEO) answers are remembered like any other (and sealed in the pack row); consent is never stored. An approved,
 * non-empty long answer is kept (encrypted) for this job so later forms can offer it again.
 */
export async function setAnswer(
  jobId: string, fieldKey: string, value: string | string[],
  opts: { approved?: boolean; remember?: boolean } = {},
): Promise<{ ok: boolean }> {
  const { user } = await requireUser();
  if (!env.autopilot || !isUuid(jobId) || typeof fieldKey !== "string" || !validValue(value)) return { ok: false };
  const vault = await getVault(user.id);
  if (!vault.completed) return { ok: false };
  const pack = db.select({ answers: autopilotPacks.answers, form: autopilotPacks.form }).from(autopilotPacks).where(ownPack(user.id, jobId)).get();
  const field = (pack?.form as NormalizedForm | null)?.fields?.find((f) => f.key === fieldKey);
  if (!pack || !field) return { ok: false };
  // Never store an answer for consent, "yours" or file fields: those stay the student's own.
  const kind = classify(field.label, field.type).kind;
  if (kind !== "vault" && kind !== "extra" && kind !== "eeo" && kind !== "freeText") return { ok: false };
  const form = pack.form as NormalizedForm;
  const answers = sealAnswers(user.id, jobId, form.fields, { ...((pack.answers ?? {}) as Record<string, StoredAnswer>), [fieldKey]: { value, approved: opts.approved ?? false } });
  try {
    db.update(autopilotPacks).set({ answers, status: "draft" }).where(ownPack(user.id, jobId)).run();
  } catch {
    return { ok: false };
  }
  if (kind === "freeText" && opts.approved === true && typeof value === "string" && value.trim()) {
    const company = db.select({ name: companies.name }).from(jobs).innerJoin(companies, eq(companies.id, jobs.company_id)).where(eq(jobs.id, jobId)).get()?.name ?? "";
    const set = { company, text: sealLongAnswer(user.id, jobId, field.label, value), updated_at: new Date().toISOString() };
    try {
      db.insert(autopilotLongAnswers).values({ user_id: user.id, job_id: jobId, field_label: field.label, ...set })
        .onConflictDoUpdate({ target: [autopilotLongAnswers.user_id, autopilotLongAnswers.job_id, autopilotLongAnswers.field_label], set }).run();
    } catch {
      return { ok: false };
    }
  }
  if (opts.remember !== false && (kind === "extra" || kind === "vault" || kind === "eeo")) {
    const text = rememberable(field, value);
    const k = normLabel(field.label);
    const same = JSON.stringify(vault.extra[k]) === JSON.stringify(text);
    if (text && !same && (k in vault.extra || Object.keys(vault.extra).length < MAX_EXTRA_KEYS)) {
      try {
        db.update(autopilotVault).set({ extra: sealVault("extra", user.id, { ...vault.extra, [k]: text }), updated_at: new Date().toISOString() })
          .where(eq(autopilotVault.user_id, user.id)).run();
      } catch {
        return { ok: false };
      }
    }
  }
  return { ok: true };
}

export async function openAndFill(jobId: string): Promise<{ url: string } | { error: string }> {
  const { user } = await requireUser();
  if (!env.autopilot) return { error: "Autopilot isn't switched on." };
  if (!isUuid(jobId)) return { error: "Unknown job" };
  if (!(await getVault(user.id)).completed) return { error: "Finish Autopilot setup first." };
  let built;
  try {
    // Drafts never block opening (unapproved ones are simply left for the student), so skip the LLM here.
    built = await buildPack(user.id, jobId);
  } catch (e) {
    console.error("autopilot openAndFill:", e instanceof Error ? e.message : "unknown error");
    return { error: "Couldn't read this form. Use the normal Apply link." };
  }
  if (!canOpen(built.items, built.answers)) return { error: "Answer the highlighted questions first." };
  const pack = db.select({ form: autopilotPacks.form }).from(autopilotPacks).where(ownPack(user.id, jobId)).get();
  const formUrl = (pack?.form as { url?: string } | null)?.url;
  if (!formUrl) return { error: "Pack not found" };
  const t = mintToken(); // a fresh token each time: re-minting invalidates the previous link
  try {
    db.update(autopilotPacks).set({ token_hash: t.hash, token_expires_at: t.expiresAt, token_used_at: null, status: "ready" })
      .where(ownPack(user.id, jobId)).run();
  } catch {
    return { error: "Couldn't create your link, please try again." };
  }
  return { url: `${formUrl}#placed=${t.token}` };
}

/** Shared guard for the draft-chat actions: feature on, valid ids, setup finished. */
async function chatUser(jobId: string, fieldKey: string): Promise<string | null> {
  const { user } = await requireUser();
  if (!env.autopilot || !isUuid(jobId) || typeof fieldKey !== "string" || !fieldKey) return null;
  return (await getVault(user.id)).completed ? user.id : null;
}

export async function draftFor(jobId: string, fieldKey: string): Promise<{ ok: true; draft: DraftResult } | { ok: false }> {
  const uid = await chatUser(jobId, fieldKey);
  if (!uid) return { ok: false };
  const draft = await generateDraft(uid, jobId, fieldKey);
  return draft ? { ok: true, draft } : { ok: false };
}

export async function ideasFor(jobId: string, fieldKey: string): Promise<{ ok: true; ideas: Idea[] } | { ok: false }> {
  const uid = await chatUser(jobId, fieldKey);
  if (!uid) return { ok: false };
  const input = await draftInputFor(uid, jobId, fieldKey);
  return input ? { ok: true, ideas: await suggestIdeas(input) } : { ok: false };
}

/** Revised text is returned, not stored: the chat saves whichever version the student picks via setAnswer. */
export async function reviseFor(jobId: string, fieldKey: string, text: string, how: ReviseHow): Promise<{ ok: true; draft: DraftResult } | { ok: false }> {
  if (typeof text !== "string" || !text.trim() || text.length > MAX_TEXT || !["shorter", "warmer", "tidy"].includes(how)) return { ok: false };
  const uid = await chatUser(jobId, fieldKey);
  if (!uid) return { ok: false };
  const input = await draftInputFor(uid, jobId, fieldKey);
  return input ? { ok: true, draft: await reviseAnswer(input, text, how) } : { ok: false };
}

/** Keys (`"upload"` or the field key, as `coverKey` names them) of this job's cover letter outputs that are marked ready. */
export async function coverReadyKeys(jobId: string): Promise<string[]> {
  const { user } = await requireUser();
  if (!env.autopilot || !isUuid(jobId)) return [];
  const letter = db.select({ id: coverLetters.id }).from(coverLetters)
    .where(and(eq(coverLetters.user_id, user.id), eq(coverLetters.job_id, jobId))).get();
  if (!letter) return [];
  return db.select({ target: coverLetterOutputs.target }).from(coverLetterOutputs)
    .where(and(eq(coverLetterOutputs.letter_id, letter.id), eq(coverLetterOutputs.status, "ready"))).all()
    .map((o) => (o.target.kind === "upload" ? "upload" : o.target.fieldKey));
}
