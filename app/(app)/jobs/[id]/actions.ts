"use server";
import { requireUser } from "@/lib/supabase/server";
import { loadJobFit } from "@/lib/db/fit";
import { getActiveCv, getJob, getProfile, toStudent } from "@/lib/db/queries";
import { coverageFor } from "@/lib/scoring/coverage";
import { explainCacheKey, explainMatchWithSource, readCachedExplanation, shouldCacheExplanation, toCacheRecord } from "@/lib/ai/explainMatch";
import { aiMode } from "@/lib/env";
import { awardXP } from "@/lib/gamify/award";
import { isUuid } from "@/lib/feed/save-result";
import type { Explanation } from "@/lib/scoring/requirements";
import type { AwardResult } from "@/lib/gamify/core";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { runTailoring, type TailorOutcome } from "@/lib/tailor/run";
import { BlockedCvError, renderVerifiedPdf } from "@/lib/tailor/render";
import { normalizeTailored, tailorCV } from "@/lib/ai/tailorCV";
import { TailoredCvFixture } from "@/lib/ai/schemas";
import type { ParsedCV, TailoredCV } from "@/lib/types";
import type { VerifyReport } from "@/lib/verify/tailoring";

export type ExplanationResult = Explanation | { error: string };
export type ApplyResult = { ok: boolean; award: AwardResult | null; error?: string };

const EXPLAIN_FAILED = "We couldn't build the explanation right now. Try again in a moment.";
const APPLY_FAILED = "Couldn't record that — try again.";

/** Requirement table + why you fit + gaps for one job. Lazy (first open), cached per user/job in `matches` for the active CV. */
export async function getExplanation(jobId: string): Promise<ExplanationResult> {
  if (!isUuid(jobId)) return { error: "This role is no longer available." };
  const { supabase, user } = await requireUser();
  const [job, profile, cv, cached] = await Promise.all([
    getJob(supabase, jobId), getProfile(supabase, user.id), getActiveCv(supabase, user.id),
    supabase.from("matches").select("explanation_json").eq("user_id", user.id).eq("job_id", jobId).maybeSingle(),
  ]);
  if (!job) return { error: "This role is no longer available." };
  const student = toStudent(profile);
  const key = explainCacheKey({ mode: aiMode(), cvId: cv?.id ?? null, requirements: job.requirements, skills: student.skills });
  const hit = readCachedExplanation(cached.data?.explanation_json, key);
  if (hit) return hit;

  const coverage = coverageFor(job, cv?.parsed ?? null, student.skills);
  let r: Awaited<ReturnType<typeof explainMatchWithSource>>;
  try {
    r = await explainMatchWithSource({ cv: cv?.parsed ?? null, cvText: cv?.rawText ?? "", student, job, coverage });
  } catch (err) {
    console.error("getExplanation: explainMatch failed", err instanceof Error ? err.message : err);
    return { error: EXPLAIN_FAILED };
  }
  const { explanation: e, source } = r;
  if (!shouldCacheExplanation(source)) return e; // heuristic: cheap, and must not mask a fixture/live answer later
  const { error } = await supabase.from("matches")
    .upsert({ user_id: user.id, job_id: jobId, explanation_json: toCacheRecord(e, key, source), created_at: new Date().toISOString() }, { onConflict: "user_id,job_id" });
  if (error) console.error("getExplanation: cache write failed", error.message); // the explanation itself is fine
  return e;
}

/**
 * "Did you apply?" -> Yes. The student applied on the company's own site; we only record it.
 * The fit label (which sets the XP) is computed here from the DB, never taken from the client.
 */
export async function markApplied(jobId: string): Promise<ApplyResult> {
  if (!isUuid(jobId)) return { ok: false, award: null, error: APPLY_FAILED };
  const { supabase, user } = await requireUser();
  const [loaded, existing] = await Promise.all([
    loadJobFit(supabase, user.id, jobId),
    supabase.from("applications").select("status").eq("user_id", user.id).eq("job_id", jobId).maybeSingle(),
  ]);
  if (!loaded) return { ok: false, award: null, error: "This role is no longer available." };

  const status = existing.data?.status as string | undefined;
  // never move a later stage (interview / offer / rejected) back to "applied"
  if (!status || status === "saved") {
    const { error } = await supabase.from("applications").upsert(
      { user_id: user.id, job_id: jobId, status: "applied", updated_at: new Date().toISOString() },
      { onConflict: "user_id,job_id" },
    );
    if (error) {
      console.error("markApplied: upsert failed", error.message);
      return { ok: false, award: null, error: APPLY_FAILED };
    }
  }

  const { job, fit } = loaded;
  try {
    // `applied` is awarded once per job (unique index), so a second "Yes" earns nothing.
    const award = await awardXP(supabase, user.id, { type: "applied", fitLabel: fit.label, jobTitle: job.title, deadline: job.deadline }, jobId);
    return { ok: true, award };
  } catch (e) {
    console.error("markApplied: award failed", e instanceof Error ? e.message : e);
    return { ok: true, award: null }; // the application itself is recorded
  }
}

// ---------- Task 23a: tailoring ----------

/** What `applications.tailored_json` holds: the outcome shown on the tailoring screen, plus the student's final version once saved. */
export type StoredTailoring = { v: 1; outcome: TailorOutcome; final: TailoredCV | null };
export type TailorResult =
  | { outcome: TailorOutcome; award: AwardResult | null; pdfUrl: string; signedUrl: string | null }
  | { error: string };
export type FinalizeResult = { report: VerifyReport; pdfUrl: string; signedUrl: string | null } | { error: string; report?: VerifyReport };
export type ConfirmNumberResult = { ok: true; stored: string | null } | { error: string };

const TAILOR_FAILED = "Tailoring failed this time. Try again in a minute; your original CV is unchanged.";
const BLOCKED = "We couldn't produce a version we can stand behind, so no PDF was made. Your original CV is unchanged.";
const SIGNED_URL_SECONDS = 60;
const MAX_FACT = 300;

type TailorCtx = { userId: string; jobId: string; cv: { parsed: ParsedCV; rawText: string }; job: NonNullable<Awaited<ReturnType<typeof getJob>>>; confirmedFacts: string[] };

async function loadTailorContext(jobId: string): Promise<{ supabase: SupabaseClient; ctx: TailorCtx } | { error: string }> {
  if (!isUuid(jobId)) return { error: "This role is no longer available." };
  const { supabase, user } = await requireUser();
  const [job, cv, facts] = await Promise.all([
    getJob(supabase, jobId), getActiveCv(supabase, user.id),
    supabase.from("confirmed_facts").select("claim").eq("user_id", user.id),
  ]);
  if (!job) return { error: "This role is no longer available." };
  if (!cv) return { error: "Upload your CV first: tailoring needs it." };
  return {
    supabase,
    ctx: { userId: user.id, jobId, cv: { parsed: cv.parsed, rawText: cv.rawText ?? "" }, job, confirmedFacts: (facts.data ?? []).map((f) => f.claim as string) },
  };
}

/**
 * Render (only if the gate passes), upload to the private `tailored` bucket at {userId}/{jobId}.pdf and record the
 * path. tailored_cv_path is service-role only (migration 0008 APP CONTRACT), so the row is written with the admin
 * client, always scoped to the session user's id. `status` is never written here, so an existing stage survives.
 */
async function renderAndStore(ctx: TailorCtx, tailored: TailoredCV, stored: (report: VerifyReport) => StoredTailoring) {
  const r = await renderVerifiedPdf({ cv: ctx.cv.parsed, rawText: ctx.cv.rawText, job: ctx.job, confirmedFacts: ctx.confirmedFacts, tailored });
  const admin = createAdminClient();
  const path = `${ctx.userId}/${ctx.jobId}.pdf`;
  const up = await admin.storage.from("tailored").upload(path, r.pdf, { contentType: "application/pdf", upsert: true });
  if (up.error) throw new Error(`upload failed: ${up.error.message}`);
  const row = await admin.from("applications").upsert({
    user_id: ctx.userId, job_id: ctx.jobId, tailored_json: stored(r.report), verify_report: r.report,
    tailored_cv_path: path, updated_at: new Date().toISOString(),
  }, { onConflict: "user_id,job_id" });
  if (row.error) throw new Error(`saving application failed: ${row.error.message}`);
  const signed = await admin.storage.from("tailored").createSignedUrl(path, SIGNED_URL_SECONDS, { download: "CV-tailored.pdf" });
  return { report: r.report, signedUrl: signed.data?.signedUrl ?? null };
}

/** "Tailor my CV": tailor → gate → retry → revert → PDF (never while block) → store → +30 XP once per job. */
export async function tailorForJob(jobId: string): Promise<TailorResult> {
  const loaded = await loadTailorContext(jobId);
  if ("error" in loaded) return loaded;
  const { supabase, ctx } = loaded;
  let outcome: TailorOutcome;
  try {
    outcome = await runTailoring({ cv: ctx.cv.parsed, rawText: ctx.cv.rawText, job: ctx.job, confirmedFacts: ctx.confirmedFacts, tailor: tailorCV });
  } catch (e) {
    console.error("tailorForJob: tailoring failed", e instanceof Error ? e.message : e);
    return { error: TAILOR_FAILED };
  }
  if (outcome.report.verdict === "block") return { error: BLOCKED };
  let signedUrl: string | null;
  try {
    ({ signedUrl } = await renderAndStore(ctx, outcome.tailored, () => ({ v: 1, outcome, final: null })));
  } catch (e) {
    if (e instanceof BlockedCvError) return { error: BLOCKED };
    console.error("tailorForJob: storing failed", e instanceof Error ? e.message : e);
    return { error: TAILOR_FAILED };
  }
  let award: AwardResult | null = null;
  try {
    award = await awardXP(supabase, ctx.userId, { type: "cv_tailored" }, jobId); // unique per (user, job): once per job
  } catch (e) {
    console.error("tailorForJob: award failed", e instanceof Error ? e.message : e);
  }
  return { outcome, award, pdfUrl: `/api/tailored/${jobId}`, signedUrl };
}

/**
 * Amendment item 6: the student's final accepted/edited version. The gate re-runs on it (with the latest confirmed
 * facts) and the PDF is replaced only if it passes. No XP here (23b decides the "Made it yours" reward).
 */
export async function finalizeTailoredCv(jobId: string, edited: unknown): Promise<FinalizeResult> {
  const loaded = await loadTailorContext(jobId);
  if ("error" in loaded) return loaded;
  const { supabase, ctx } = loaded;
  const parsed = TailoredCvFixture.safeParse(edited);
  if (!parsed.success) return { error: "That version couldn't be read. Try again." };
  const tailored = normalizeTailored(parsed.data, ctx.cv.parsed);
  const prev = await supabase.from("applications").select("tailored_json").eq("user_id", ctx.userId).eq("job_id", jobId).maybeSingle();
  const prevStored = prev.data?.tailored_json as StoredTailoring | null;
  if (!prevStored?.outcome) return { error: "Tailor your CV for this role first." };
  try {
    const { report, signedUrl } = await renderAndStore(ctx, tailored, () => ({ v: 1, outcome: prevStored.outcome, final: tailored }));
    return { report, pdfUrl: `/api/tailored/${jobId}`, signedUrl };
  } catch (e) {
    if (e instanceof BlockedCvError) return { error: "Some of your edits aren't supported by your CV yet. Fix the flagged lines, then save again.", report: e.report };
    console.error("finalizeTailoredCv: failed", e instanceof Error ? e.message : e);
    return { error: TAILOR_FAILED };
  }
}

/**
 * B9 "Confirm this number": confirm/edit stores the student's statement in confirmed_facts (user client, RLS), so the
 * gate accepts it from now on. remove/keep_original store nothing. No XP here (decided in 23b).
 */
export async function confirmNumber(jobId: string, claim: string, choice: "confirm" | "edit" | "remove" | "keep_original", edited?: string): Promise<ConfirmNumberResult> {
  if (!isUuid(jobId)) return { error: "This role is no longer available." };
  if (!["confirm", "edit", "remove", "keep_original"].includes(choice)) return { error: "Unknown choice." };
  if (choice === "remove" || choice === "keep_original") return { ok: true, stored: null };
  const text = (choice === "confirm" ? claim : edited ?? "").trim().slice(0, MAX_FACT);
  if (!text) return { error: "Type the real figure first." };
  const { supabase, user } = await requireUser();
  // Only from a real tailoring of this job (23b fix 5): no stored facts or XP for jobs never tailored.
  const app = await supabase.from("applications").select("tailored_json").eq("user_id", user.id).eq("job_id", jobId).maybeSingle();
  if (!(app.data?.tailored_json as StoredTailoring | null)?.outcome) return { error: "Tailor your CV for this role first." };
  const { error } = await supabase.from("confirmed_facts").insert({ user_id: user.id, claim: text });
  if (error) {
    console.error("confirmNumber: insert failed", error.message);
    return { error: "Couldn't save that. Try again." };
  }
  return { ok: true, stored: text };
}
