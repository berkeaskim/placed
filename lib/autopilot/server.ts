import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchForm } from "./forms";
import type { Ats, NormalizedForm } from "./forms/types";
import { classify } from "./classify";
import { draftAnswer, type DraftResult } from "./drafts";
import { assemblePack, toFillPlan, type Answers, type FillInstruction, type PackItem } from "./pack";
import { hashToken, safeNamePart } from "./handoff";
import { isComplete, type Core } from "./vault";
import type { ParsedCV } from "@/lib/types";

export type JobForPack = { id: string; extId: string; url: string; ats: Ats; company: string; textLines: string[] };
export type ClaimBody = { ats: Ats; url: string; fields: FillInstruction[]; cv: { url: string; filename: string } | null };

export async function loadJobForPack(db: SupabaseClient, jobId: string): Promise<JobForPack | null> {
  const { data } = await db.from("jobs").select("id, ext_id, url, text_lines, companies(name, ats)").eq("id", jobId).maybeSingle();
  if (!data) return null;
  const c = (Array.isArray(data.companies) ? data.companies[0] : data.companies) as { name: string; ats: Ats } | null;
  if (!c) return null;
  return { id: data.id, extId: data.ext_id, url: data.url, ats: c.ats, company: c.name, textLines: data.text_lines ?? [] };
}

/** `completed` = Autopilot is unlocked: the saved core is complete right now. `completed_at` alone is only the once-only XP marker, so it never unlocks by itself. */
export async function getVault(db: SupabaseClient, userId: string): Promise<{ core: Partial<Core>; extra: Record<string, string>; completed: boolean }> {
  const { data } = await db.from("autopilot_vault").select("core, extra, completed_at").eq("user_id", userId).maybeSingle();
  return { core: (data?.core ?? {}) as Partial<Core>, extra: (data?.extra ?? {}) as Record<string, string>, completed: Boolean(data?.completed_at) && isComplete(data?.core) };
}

/** Fetches the form, (optionally) drafts free-text answers, upserts autopilot_packs. `withDrafts: false` never calls the LLM. */
export async function buildPack(userId: string, jobId: string, opts: { withDrafts?: boolean } = {}): Promise<{ items: PackItem[]; answers: Answers }> {
  const withDrafts = opts.withDrafts ?? true;
  const db = createAdminClient();
  const job = await loadJobForPack(db, jobId);
  if (!job) throw new Error("Job not found");
  const [{ core, extra }, cvRow, factsRow, existing] = await Promise.all([
    getVault(db, userId),
    db.from("cvs").select("parsed_json").eq("user_id", userId).eq("is_active", true).maybeSingle(),
    db.from("confirmed_facts").select("id, claim").eq("user_id", userId),
    db.from("autopilot_packs").select("form, answers").eq("user_id", userId).eq("job_id", jobId).maybeSingle(),
  ]);
  const form: NormalizedForm = (existing.data?.form as NormalizedForm | undefined) ?? (await fetchForm(job));
  const cv = (cvRow.data?.parsed_json ?? null) as ParsedCV | null;
  const drafts: Record<string, DraftResult> = {};
  if (withDrafts && cv) {
    for (const f of form.fields) if (classify(f.label, f.type).kind === "freeText") {
      drafts[f.key] = await draftAnswer({ question: f.label, wordLimit: f.wordLimit, company: job.company, jobExtId: job.extId, fieldKey: f.key,
        jdLines: job.textLines, cv, facts: factsRow.data ?? [] });
    }
  }
  const answers = (existing.data?.answers ?? {}) as Answers;
  const { error } = await db.from("autopilot_packs").upsert({ user_id: userId, job_id: jobId, form, answers }, { onConflict: "user_id,job_id" });
  if (error) throw new Error(`buildPack: ${error.message}`);
  return { items: assemblePack(form, core, extra, drafts), answers };
}

export async function claimPack(token: string): Promise<{ status: 200; body: ClaimBody } | { status: 404 | 410 }> {
  const db = createAdminClient();
  const hash = hashToken(token);
  const { data: pack } = await db.from("autopilot_packs").select("id, user_id, job_id, form, answers, token_expires_at, token_used_at").eq("token_hash", hash).maybeSingle();
  if (!pack) return { status: 404 };
  if (pack.token_used_at || !pack.token_expires_at || Date.parse(pack.token_expires_at) < Date.now()) return { status: 410 };
  // Atomic single use: bound to this exact token hash (a re-mint invalidates it), unexpired, and unused.
  const { data: used } = await db.from("autopilot_packs").update({ token_used_at: new Date().toISOString(), status: "claimed" })
    .eq("id", pack.id).eq("token_hash", hash).is("token_used_at", null).gt("token_expires_at", new Date().toISOString()).select("id");
  if (!used?.length) return { status: 410 };
  const { core, extra } = await getVault(db, pack.user_id);
  const form = pack.form as NormalizedForm;
  const items = assemblePack(form, core, extra, {});
  const fields = toFillPlan(items, pack.answers as Answers);
  const [{ data: app }, { data: cvRow }] = await Promise.all([
    db.from("applications").select("tailored_cv_path").eq("user_id", pack.user_id).eq("job_id", pack.job_id).maybeSingle(),
    db.from("cvs").select("storage_path").eq("user_id", pack.user_id).eq("is_active", true).maybeSingle(),
  ]);
  const own = (p: unknown): p is string => typeof p === "string" && p.startsWith(`${pack.user_id}/`);
  const [bucket, path] = own(app?.tailored_cv_path) ? ["tailored", app?.tailored_cv_path as string] : ["cvs", cvRow?.storage_path];
  let cv: ClaimBody["cv"] = null;
  if (own(path)) {
    const { data: signed } = await db.storage.from(bucket).createSignedUrl(path, 60);
    if (signed?.signedUrl) cv = { url: signed.signedUrl, filename: `${safeNamePart(core.first_name, "My")}-${safeNamePart(core.last_name, "CV")}-CV.pdf` };
    else console.error("autopilot claim: could not sign CV url");
  }
  return { status: 200, body: { ats: form.ats, url: form.url, fields, cv } };
}
