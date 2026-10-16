"use server";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPack, getVault } from "@/lib/autopilot/server";
import { canOpen, type Answers, type PackItem } from "@/lib/autopilot/pack";
import { mintToken } from "@/lib/autopilot/handoff";
import { isEeoLabel, normLabel } from "@/lib/autopilot/vault";
import { sealVault } from "@/lib/autopilot/vault-crypto";
import { FormUnavailableError } from "@/lib/autopilot/forms/types";
import { isUuid } from "@/lib/feed/save-result";
import { env } from "@/lib/env";
import { classify } from "@/lib/autopilot/classify";
import { safeHttpUrl } from "@/lib/text/url";
import type { FormField, NormalizedForm } from "@/lib/autopilot/forms/types";

type Prepared = { locked: true } | { error: string; applyUrl: string | null } | { items: PackItem[]; answers: Answers };

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
  const db = createAdminClient();
  if (!(await getVault(db, user.id)).completed) return { locked: true };
  try {
    return await buildPack(user.id, jobId);
  } catch (e) {
    console.error("autopilot preparePack:", e instanceof Error ? e.message : "unknown error");
    const { data } = await db.from("jobs").select("url").eq("id", jobId).maybeSingle();
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
 * never from the client, and EEO is never stored.
 */
export async function setAnswer(
  jobId: string, fieldKey: string, value: string | string[],
  opts: { approved?: boolean; remember?: boolean } = {},
): Promise<{ ok: boolean }> {
  const { user } = await requireUser();
  if (!env.autopilot || !isUuid(jobId) || typeof fieldKey !== "string" || !validValue(value)) return { ok: false };
  const db = createAdminClient();
  const vault = await getVault(db, user.id);
  if (!vault.completed) return { ok: false };
  const { data: pack } = await db.from("autopilot_packs").select("answers, form").eq("user_id", user.id).eq("job_id", jobId).maybeSingle();
  const field = (pack?.form as NormalizedForm | null)?.fields?.find((f) => f.key === fieldKey);
  if (!pack || !field) return { ok: false };
  // Never store an answer for diversity, consent, "yours" or file fields: those stay the student's own.
  const kind = classify(field.label, field.type).kind;
  if (kind !== "vault" && kind !== "extra" && kind !== "freeText") return { ok: false };
  const answers = { ...((pack.answers ?? {}) as Answers), [fieldKey]: { value, approved: opts.approved ?? false } };
  const { error } = await db.from("autopilot_packs").update({ answers, status: "draft" }).eq("user_id", user.id).eq("job_id", jobId);
  if (error) return { ok: false };
  if (opts.remember !== false && !isEeoLabel(field.label) && (kind === "extra" || kind === "vault")) {
    const text = rememberable(field, value);
    const k = normLabel(field.label);
    const same = JSON.stringify(vault.extra[k]) === JSON.stringify(text);
    if (text && !same && (k in vault.extra || Object.keys(vault.extra).length < MAX_EXTRA_KEYS)) {
      const { error: e2 } = await db.from("autopilot_vault")
        .update({ extra: sealVault("extra", user.id, { ...vault.extra, [k]: text }), updated_at: new Date().toISOString() }).eq("user_id", user.id);
      if (e2) return { ok: false };
    }
  }
  return { ok: true };
}

export async function openAndFill(jobId: string): Promise<{ url: string } | { error: string }> {
  const { user } = await requireUser();
  if (!env.autopilot) return { error: "Autopilot isn't switched on." };
  if (!isUuid(jobId)) return { error: "Unknown job" };
  const db = createAdminClient();
  if (!(await getVault(db, user.id)).completed) return { error: "Finish Autopilot setup first." };
  let built;
  try {
    // Drafts never block opening (unapproved ones are simply left for the student), so skip the LLM here.
    built = await buildPack(user.id, jobId, { withDrafts: false });
  } catch (e) {
    console.error("autopilot openAndFill:", e instanceof Error ? e.message : "unknown error");
    return { error: "Couldn't read this form. Use the normal Apply link." };
  }
  if (!canOpen(built.items, built.answers)) return { error: "Answer the highlighted questions first." };
  const { data: pack } = await db.from("autopilot_packs").select("form").eq("user_id", user.id).eq("job_id", jobId).maybeSingle();
  const formUrl = (pack?.form as { url?: string } | null)?.url;
  if (!formUrl) return { error: "Pack not found" };
  const t = mintToken(); // a fresh token each time: re-minting invalidates the previous link
  const { error } = await db.from("autopilot_packs")
    .update({ token_hash: t.hash, token_expires_at: t.expiresAt, token_used_at: null, status: "ready" })
    .eq("user_id", user.id).eq("job_id", jobId);
  if (error) return { error: "Couldn't create your link, please try again." };
  return { url: `${formUrl}#placed=${t.token}` };
}
