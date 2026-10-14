"use server";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildPack, getVault } from "@/lib/autopilot/server";
import { canOpen, type Answers, type PackItem } from "@/lib/autopilot/pack";
import { mintToken } from "@/lib/autopilot/handoff";
import { isEeoLabel, normLabel } from "@/lib/autopilot/vault";
import { FormUnavailableError } from "@/lib/autopilot/forms/types";
import { isUuid } from "@/lib/feed/save-result";

type Prepared = { locked: true } | { error: string; applyUrl: string } | { items: PackItem[]; answers: Answers };

export async function preparePack(jobId: string): Promise<Prepared> {
  const { user } = await requireUser();
  if (!isUuid(jobId)) return { error: "Unknown job", applyUrl: "/feed" };
  const db = createAdminClient();
  if (!(await getVault(db, user.id)).completed) return { locked: true };
  try {
    return await buildPack(user.id, jobId);
  } catch (e) {
    const { data } = await db.from("jobs").select("url").eq("id", jobId).maybeSingle();
    return {
      error: e instanceof FormUnavailableError ? "We couldn't read this form. Here's the normal Apply link." : "Something went wrong building your pack.",
      applyUrl: data?.url ?? "/feed",
    };
  }
}

/**
 * Merges one answer into the pack. A draft is only approved when the caller says so, so editing text after approval
 * (which passes no `approved`) always resets it to "not approved". Ask-once answers are also remembered in the vault,
 * except EEO questions, which are never stored.
 */
export async function setAnswer(
  jobId: string, fieldKey: string, value: string | string[],
  opts: { approved?: boolean; rememberLabel?: string; rememberText?: string } = {},
): Promise<{ ok: boolean }> {
  const { user } = await requireUser();
  if (!isUuid(jobId)) return { ok: false };
  const db = createAdminClient();
  const { data: pack } = await db.from("autopilot_packs").select("answers").eq("user_id", user.id).eq("job_id", jobId).maybeSingle();
  const answers = { ...((pack?.answers ?? {}) as Answers), [fieldKey]: { value, approved: opts.approved ?? false } };
  await db.from("autopilot_packs").update({ answers, status: "draft" }).eq("user_id", user.id).eq("job_id", jobId);
  if (opts.rememberLabel && !isEeoLabel(opts.rememberLabel)) {
    const { extra } = await getVault(db, user.id);
    const remembered = opts.rememberText ?? (Array.isArray(value) ? value.join(", ") : value);
    await db.from("autopilot_vault")
      .update({ extra: { ...extra, [normLabel(opts.rememberLabel)]: remembered }, updated_at: new Date().toISOString() })
      .eq("user_id", user.id);
  }
  return { ok: true };
}

export async function openAndFill(jobId: string): Promise<{ url: string } | { error: string }> {
  const { user } = await requireUser();
  if (!isUuid(jobId)) return { error: "Unknown job" };
  // Drafts never block opening (unapproved ones are simply left for the student), so skip the LLM here.
  const { items, answers } = await buildPack(user.id, jobId, { withDrafts: false });
  if (!canOpen(items, answers)) return { error: "Answer the highlighted questions first." };
  const db = createAdminClient();
  const { data: pack } = await db.from("autopilot_packs").select("form").eq("user_id", user.id).eq("job_id", jobId).maybeSingle();
  const formUrl = (pack?.form as { url?: string } | null)?.url;
  if (!formUrl) return { error: "Pack not found" };
  const t = mintToken(); // a fresh token each time: re-minting invalidates the previous link
  await db.from("autopilot_packs")
    .update({ token_hash: t.hash, token_expires_at: t.expiresAt, token_used_at: null, status: "ready" })
    .eq("user_id", user.id).eq("job_id", jobId);
  return { url: `${formUrl}#placed=${t.token}` };
}
