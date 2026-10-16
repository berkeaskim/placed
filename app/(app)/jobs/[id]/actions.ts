"use server";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { applications, confirmedFacts, matches } from "@/lib/db/schema";
import { fileUrl, putFile } from "@/lib/files";
import { getActiveCv, getJob, getProfile, toStudent } from "@/lib/db/queries";
import { coverageFor } from "@/lib/scoring/coverage";
import { explainCacheKey, explainMatchWithSource, readCachedExplanation, shouldCacheExplanation, toCacheRecord } from "@/lib/ai/explainMatch";
import { aiMode } from "@/lib/ai/config";
import { awardXP } from "@/lib/gamify/award";
import { isUuid } from "@/lib/feed/save-result";
import type { Explanation } from "@/lib/scoring/requirements";
import type { AwardResult } from "@/lib/gamify/core";
import { runTailoring, type TailorOutcome } from "@/lib/tailor/run";
import { BlockedCvError, renderVerifiedPdf } from "@/lib/tailor/render";
import { normalizeTailored, tailorCV } from "@/lib/ai/tailorCV";
import { TailoredCvFixture } from "@/lib/ai/schemas";
import type { ParsedCV, TailoredCV } from "@/lib/types";
import type { VerifyReport } from "@/lib/verify/tailoring";

/**
 * `aiWritten`: the free text (why you fit, closest experience, how to close) came from the model (live or recorded
 * fixture) and is labelled "AI-written" in the panel. `aiFailed`: the live model failed, so this is the automatic estimate.
 */
export type ExplanationView = Explanation & { aiWritten: boolean; aiFailed: boolean };
export type ExplanationResult = ExplanationView | { error: string };

const EXPLAIN_FAILED = "We couldn't build the explanation right now. Try again in a moment.";

/** Requirement table + why you fit + gaps for one job. Lazy (first open), cached per user/job in `matches` for the active CV. */
export async function getExplanation(jobId: string): Promise<ExplanationResult> {
  if (!isUuid(jobId)) return { error: "This role is no longer available." };
  const { user } = await requireUser();
  const [job, profile, cv] = await Promise.all([getJob(jobId), getProfile(user.id), getActiveCv(user.id)]);
  const cached = db.select({ explanation_json: matches.explanation_json }).from(matches)
    .where(and(eq(matches.user_id, user.id), eq(matches.job_id, jobId))).get();
  if (!job) return { error: "This role is no longer available." };
  const student = toStudent(profile);
  const key = explainCacheKey({ mode: aiMode(), cvId: cv?.id ?? null, requirements: job.requirements, skills: student.skills });
  const hit = readCachedExplanation(cached?.explanation_json, key);
  if (hit) return { ...hit, aiWritten: true, aiFailed: false }; // heuristic results are never cached

  const coverage = coverageFor(job, cv?.parsed ?? null, student.skills);
  let r: Awaited<ReturnType<typeof explainMatchWithSource>>;
  try {
    r = await explainMatchWithSource({ cv: cv?.parsed ?? null, cvText: cv?.rawText ?? "", student, job, coverage });
  } catch (err) {
    console.error("getExplanation: explainMatch failed", err instanceof Error ? err.message : err);
    return { error: EXPLAIN_FAILED };
  }
  const { explanation: e, source, aiFailed } = r;
  const view: ExplanationView = { ...e, aiWritten: source !== "heuristic", aiFailed };
  if (!shouldCacheExplanation(source)) return view; // heuristic: cheap, and must not mask a fixture/live answer later
  try {
    const row = { explanation_json: toCacheRecord(e, key, source), created_at: new Date().toISOString() };
    db.insert(matches).values({ user_id: user.id, job_id: jobId, ...row })
      .onConflictDoUpdate({ target: [matches.user_id, matches.job_id], set: row }).run();
  } catch (err) {
    console.error("getExplanation: cache write failed", err instanceof Error ? err.message : err); // the explanation itself is fine
  }
  return view;
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
const MAX_FACT = 300;

type TailorCtx = { userId: string; jobId: string; cv: { parsed: ParsedCV; rawText: string }; job: NonNullable<Awaited<ReturnType<typeof getJob>>>; confirmedFacts: string[] };

const loadFacts = (userId: string) =>
  db.select({ claim: confirmedFacts.claim }).from(confirmedFacts).where(eq(confirmedFacts.user_id, userId)).all().map((f) => f.claim);
const loadStored = (userId: string, jobId: string) =>
  (db.select({ tailored_json: applications.tailored_json }).from(applications)
    .where(and(eq(applications.user_id, userId), eq(applications.job_id, jobId))).get()?.tailored_json ?? null) as StoredTailoring | null;

async function loadTailorContext(jobId: string): Promise<{ ctx: TailorCtx } | { error: string }> {
  if (!isUuid(jobId)) return { error: "This role is no longer available." };
  const { user } = await requireUser();
  const [job, cv] = await Promise.all([getJob(jobId), getActiveCv(user.id)]);
  if (!job) return { error: "This role is no longer available." };
  if (!cv) return { error: "Upload your CV first: tailoring needs it." };
  return {
    ctx: { userId: user.id, jobId, cv: { parsed: cv.parsed, rawText: cv.rawText ?? "" }, job, confirmedFacts: loadFacts(user.id) },
  };
}

/**
 * Render (only if the gate passes), store in the local `tailored` bucket at {userId}/{jobId}.pdf and record the
 * path, always scoped to the session user's id. `status` is never written here, so an existing stage survives.
 */
async function renderAndStore(ctx: TailorCtx, tailored: TailoredCV, stored: (report: VerifyReport) => StoredTailoring) {
  const r = await renderVerifiedPdf({ cv: ctx.cv.parsed, rawText: ctx.cv.rawText, job: ctx.job, confirmedFacts: ctx.confirmedFacts, tailored });
  const path = `${ctx.userId}/${ctx.jobId}.pdf`;
  await putFile("tailored", path, r.pdf, "application/pdf");
  const set = { tailored_json: stored(r.report), verify_report: r.report, tailored_cv_path: path, updated_at: new Date().toISOString() };
  db.insert(applications).values({ user_id: ctx.userId, job_id: ctx.jobId, ...set })
    .onConflictDoUpdate({ target: [applications.user_id, applications.job_id], set }).run();
  return { report: r.report, signedUrl: `${fileUrl("tailored", path)}?download=CV-tailored.pdf` };
}

/** "Tailor my CV": tailor → gate → retry → revert → PDF (never while block) → store → +30 XP once per job. */
export async function tailorForJob(jobId: string): Promise<TailorResult> {
  const loaded = await loadTailorContext(jobId);
  if ("error" in loaded) return loaded;
  const { ctx } = loaded;
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
    award = await awardXP(ctx.userId, { type: "cv_tailored" }, jobId); // unique per (user, job): once per job
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
  const { ctx } = loaded;
  const parsed = TailoredCvFixture.safeParse(edited);
  if (!parsed.success) return { error: "That version couldn't be read. Try again." };
  const tailored = normalizeTailored(parsed.data, ctx.cv.parsed);
  const prevStored = loadStored(ctx.userId, jobId);
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
 * B9 "Confirm this number": confirm/edit stores the student's statement in confirmed_facts, so the
 * gate accepts it from now on. remove/keep_original store nothing. No XP here (decided in 23b).
 */
export async function confirmNumber(jobId: string, claim: string, choice: "confirm" | "edit" | "remove" | "keep_original", edited?: string): Promise<ConfirmNumberResult> {
  if (!isUuid(jobId)) return { error: "This role is no longer available." };
  if (!["confirm", "edit", "remove", "keep_original"].includes(choice)) return { error: "Unknown choice." };
  if (choice === "remove" || choice === "keep_original") return { ok: true, stored: null };
  const text = (choice === "confirm" ? claim : edited ?? "").trim().slice(0, MAX_FACT);
  if (!text) return { error: "Type the real figure first." };
  const { user } = await requireUser();
  // Only from a real tailoring of this job (23b fix 5): no stored facts or XP for jobs never tailored.
  if (!loadStored(user.id, jobId)?.outcome) return { error: "Tailor your CV for this role first." };
  try {
    db.insert(confirmedFacts).values({ user_id: user.id, claim: text }).run();
  } catch (e) {
    console.error("confirmNumber: insert failed", e instanceof Error ? e.message : e);
    return { error: "Couldn't save that. Try again." };
  }
  return { ok: true, stored: text };
}
