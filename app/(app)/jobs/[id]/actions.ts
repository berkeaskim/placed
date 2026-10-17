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
import { coverageSummary, reverifyEdits, runTailoring, type ReverifyResult, type RevertedChange, type TailorOutcome } from "@/lib/tailor/run";
import { BlockedCvError, renderVerifiedPdf } from "@/lib/tailor/render";
import { normalizeTailored, tailorCV } from "@/lib/ai/tailorCV";
import { TailoredCvFixture } from "@/lib/ai/schemas";
import type { ParsedCV, TailoredBullet, TailoredCV } from "@/lib/types";
import { revertBlocked, type VerifyReport } from "@/lib/verify/tailoring";
import { extractPdf } from "@/lib/cv/pdf-text";
import { fillRatio, overflowCandidates } from "@/lib/bank/fit";
import type { Selection, SelectionReport } from "@/lib/bank/select";
import { getBank } from "@/lib/bank/store";
import { bankStamp, cvForJob, NO_OVERRIDES, SECTIONS, type BankOverrides, type StoredTailoring as StoredTailoringT } from "@/lib/bank/tailor-context";

/**
 * `aiWritten`: the free text (why you fit, closest experience, how to close) came from the model (live or recorded
 * fixture) and is labelled "AI-written" in the panel. `aiFailed`: the live model failed, so this is the automatic estimate.
 * `aiOff`: no AI is set up at all, so the panel points to Settings → AI instead of "try again later".
 */
export type ExplanationView = Explanation & { aiWritten: boolean; aiFailed: boolean; aiOff: boolean };
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
  if (hit) return { ...hit, aiWritten: true, aiFailed: false, aiOff: false }; // heuristic results are never cached

  const coverage = coverageFor(job, cv?.parsed ?? null, student.skills);
  let r: Awaited<ReturnType<typeof explainMatchWithSource>>;
  try {
    r = await explainMatchWithSource({ cv: cv?.parsed ?? null, cvText: cv?.rawText ?? "", student, job, coverage });
  } catch (err) {
    console.error("getExplanation: explainMatch failed", err instanceof Error ? err.message : err);
    return { error: EXPLAIN_FAILED };
  }
  const { explanation: e, source, aiFailed } = r;
  const view: ExplanationView = { ...e, aiWritten: source !== "heuristic", aiFailed, aiOff: aiMode() === "off" };
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

// ---------- Task 23a: tailoring (Experience Bank: Task 8) ----------

/**
 * What `applications.tailored_json` holds: the outcome shown on the tailoring screen, plus the student's final version
 * once saved. v2 adds the frozen bank selection (`base`, its grounding text, report, scores, per-job overrides, stamp).
 */
export type StoredTailoring = StoredTailoringT;
/** What the "From your bank" block needs after a tailor, re-select or swap. */
export type BankView = { report: SelectionReport; stale: boolean; newCvSuggestions: number };
/** The rendered version is over one page: nothing was stored; the UI offers the 3 lowest-scoring bullets to remove. */
export type OverflowResult = { error: "overflow"; message: string; pages: number; remove: { bulletId: string; text: string }[] };
export type TailorResult =
  | { outcome: TailorOutcome; award: AwardResult | null; pdfUrl: string; signedUrl: string | null; bank: BankView | null;
    /** Swaps only: the student's saved version carried onto the new selection, so the panel keeps their edits without a reload. */
    final?: TailoredCV }
  | OverflowResult
  | { error: string };
export type FinalizeResult = { report: VerifyReport; pdfUrl: string; signedUrl: string | null } | OverflowResult | { error: string; report?: VerifyReport };
export type ConfirmNumberResult = { ok: true; stored: string | null } | { error: string };

const TAILOR_FAILED = "Tailoring failed this time. Try again in a minute; your original CV is unchanged.";
const BLOCKED = "We couldn't produce a version we can stand behind, so no PDF was made. Your original CV is unchanged.";
const NO_FIT = "We couldn't fit your CV on one page for this role. Hide or remove a few items in your bank, then try again.";
const NOT_TAILORED = "Tailor your CV for this role first.";
const MAX_FACT = 300;

type TailorCtx = {
  userId: string; jobId: string; job: NonNullable<Awaited<ReturnType<typeof getJob>>>; confirmedFacts: string[];
  cv: { parsed: ParsedCV; rawText: string; selection: Selection | null };
  stored: StoredTailoring | null; overrides: BankOverrides; newCvSuggestions: number;
};

const loadFacts = (userId: string) =>
  db.select({ claim: confirmedFacts.claim }).from(confirmedFacts).where(eq(confirmedFacts.user_id, userId)).all().map((f) => f.claim);
const loadStored = (userId: string, jobId: string) =>
  (db.select({ tailored_json: applications.tailored_json }).from(applications)
    .where(and(eq(applications.user_id, userId), eq(applications.job_id, jobId))).get()?.tailored_json ?? null) as StoredTailoring | null;

/**
 * The single place tailoring gets its CV (via cvForJob). "fresh": a new one-page bank selection, with `overrides` or else
 * the stored per-job overrides. "stored": the stored tailoring's frozen `base` (v2) or the active CV (v1); with nothing
 * stored there is nothing to finalize, so it errors instead of running a selection.
 */
async function loadTailorContext(jobId: string, mode: "stored" | "fresh", overrides?: BankOverrides): Promise<{ ctx: TailorCtx } | { error: string }> {
  if (!isUuid(jobId)) return { error: "This role is no longer available." };
  const { user } = await requireUser();
  const job = await getJob(jobId);
  if (!job) return { error: "This role is no longer available." };
  const stored = loadStored(user.id, jobId);
  if (mode === "stored" && !stored?.outcome) return { error: NOT_TAILORED };
  const o = overrides ?? (stored?.v === 2 ? stored.overrides : NO_OVERRIDES);
  let cv: Awaited<ReturnType<typeof cvForJob>>;
  try {
    cv = await cvForJob(user.id, job, mode === "fresh" ? null : stored, mode === "fresh" ? o : undefined);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/fit your CV on one page/.test(msg)) return { error: NO_FIT };
    console.error("loadTailorContext: selection failed", msg);
    return { error: TAILOR_FAILED };
  }
  if (!cv) return { error: "Upload your CV first: tailoring needs it." };
  return {
    ctx: {
      userId: user.id, jobId, job, confirmedFacts: loadFacts(user.id), cv: { parsed: cv.parsed, rawText: cv.rawText, selection: cv.selection },
      stored, overrides: o, newCvSuggestions: cv.newCvSuggestions,
    },
  };
}

/** Selection scores for the overflow offer: the fresh selection's, else the stored v2 ones, else none (v1: page order). */
const scoresOf = (ctx: TailorCtx) => ctx.cv.selection?.scores ?? (ctx.stored?.v === 2 ? ctx.stored.scores : {});

/** Real page count with one decimal, rounded up (never "1.0" for an overflow). */
async function overflowOf(ctx: TailorCtx, tailored: TailoredCV, pages: number): Promise<OverflowResult> {
  const last = await fillRatio(tailored, ctx.cv.parsed); // 1 + share of the last page when it spilled
  const exact = Math.max(1.1, Math.ceil((pages - 2 + last) * 10) / 10);
  return { error: "overflow", message: `This is ${exact.toFixed(1)} pages — remove one of these`, pages: exact, remove: overflowCandidates(tailored, scoresOf(ctx)) };
}

/**
 * Render (only if the gate passes), refuse anything over one page (nothing stored then), store in the local
 * `tailored` bucket at {userId}/{jobId}.pdf and record the path, always scoped to the session user's id.
 * `status` is never written here, so an existing stage survives.
 */
async function renderAndStore(ctx: TailorCtx, tailored: TailoredCV, stored: (report: VerifyReport) => StoredTailoring):
  Promise<{ report: VerifyReport; signedUrl: string } | { overflow: OverflowResult }> {
  const r = await renderVerifiedPdf({ cv: ctx.cv.parsed, rawText: ctx.cv.rawText, job: ctx.job, confirmedFacts: ctx.confirmedFacts, tailored });
  const { pageCount } = await extractPdf(new Uint8Array(r.pdf));
  if (pageCount > 1) return { overflow: await overflowOf(ctx, r.tailored, pageCount) };
  const path = `${ctx.userId}/${ctx.jobId}.pdf`;
  await putFile("tailored", path, r.pdf, "application/pdf");
  const set = { tailored_json: stored(r.report), verify_report: r.report, tailored_cv_path: path, updated_at: new Date().toISOString() };
  db.insert(applications).values({ user_id: ctx.userId, job_id: ctx.jobId, ...set })
    .onConflictDoUpdate({ target: [applications.user_id, applications.job_id], set }).run();
  return { report: r.report, signedUrl: `${fileUrl("tailored", path)}?download=CV-tailored.pdf` };
}

/**
 * The row for a fresh selection (tailorForJob, swapBankItem): v2 with the frozen base. With no selection (the student
 * emptied their bank, so cvForJob used the active CV) it is a v1 row, exactly as before the bank.
 */
function storedFresh(ctx: TailorCtx, outcome: TailorOutcome, final: TailoredCV | null = null): StoredTailoring {
  const sel = ctx.cv.selection;
  if (!sel) return { v: 1, outcome, final };
  return {
    v: 2, outcome, final, base: ctx.cv.parsed, rawText: ctx.cv.rawText, report: sel.report, scores: sel.scores,
    overrides: ctx.overrides, bankStamp: bankStamp(getBank(ctx.userId), ctx.cv.parsed),
  };
}
const bankView = (ctx: TailorCtx): BankView | null =>
  ctx.cv.selection ? { report: ctx.cv.selection.report, stale: false, newCvSuggestions: ctx.newCvSuggestions } : null;

/**
 * "Tailor my CV": bank selection → tailor → gate → retry → revert → PDF (never while block, never over one page) →
 * store v2 → +30 XP once per job. The stored per-job overrides (Add back / Remove) are kept, so "Tailor again to polish"
 * keeps an item the student added back.
 */
export async function tailorForJob(jobId: string, opts?: { extraExcluded?: string[] }): Promise<TailorResult> {
  // extraExcluded: "Remove" on a first-tailor overflow (nothing stored yet), merged into the per-job overrides.
  const extra = Array.isArray(opts?.extraExcluded) ? opts.extraExcluded.filter((x): x is string => typeof x === "string").slice(0, 20) : [];
  let overrides: BankOverrides | undefined;
  if (extra.length) {
    const { user } = await requireUser();
    const prev = isUuid(jobId) ? loadStored(user.id, jobId) : null;
    const o = prev?.v === 2 ? prev.overrides : NO_OVERRIDES;
    overrides = { pinned: o.pinned.filter((x) => !extra.includes(x)), excluded: [...o.excluded.filter((x) => !extra.includes(x)), ...new Set(extra)] };
  }
  const loaded = await loadTailorContext(jobId, "fresh", overrides);
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
    const res = await renderAndStore(ctx, outcome.tailored, () => storedFresh(ctx, outcome));
    if ("overflow" in res) return res.overflow;
    ({ signedUrl } = res);
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
  return { outcome, award, pdfUrl: `/api/tailored/${jobId}`, signedUrl, bank: bankView(ctx) };
}

/** "Re-select" on the stale banner: a fresh selection and tailoring with the stored per-job overrides. */
export async function reselectFromBank(jobId: string): Promise<TailorResult> {
  return tailorForJob(jobId);
}

/**
 * The previous tailored bullets carried onto a new `base` without the AI: a tailored bullet stays while every line it
 * came from is still in its entry; a base bullet nothing covers goes in at its base position with its bank text,
 * `changeType: "kept"` and `untailored: true`. Entries follow `base`; summary and skills are kept.
 */
function carryTailored(base: ParsedCV, prev: TailoredCV): TailoredCV {
  const prevEntries = new Map(SECTIONS.flatMap((s) => prev[s].map((e) => [e.id, e] as const)));
  const out: TailoredCV = { ...prev };
  for (const s of SECTIONS) {
    out[s] = base[s].map((e) => {
      const ids = new Set(e.bullets.map((b) => b.id));
      const kept = (prevEntries.get(e.id)?.bullets ?? [])
        .filter((b) => (b.sourceRefs.length ? b.sourceRefs : [b.id]).every((r) => ids.has(r)));
      const covered = new Set(kept.flatMap((b) => [b.id, ...b.sourceRefs]));
      const bullets: TailoredBullet[] = [...kept];
      e.bullets.forEach((b, i) => {
        if (!covered.has(b.id)) bullets.splice(Math.min(i, bullets.length), 0, { id: b.id, text: b.text, sourceRefs: [b.id], changeType: "kept", untailored: true });
      });
      return { id: e.id, org: e.org, title: e.title, dates: e.dates, location: e.location, bullets };
    });
  }
  const present = new Set(SECTIONS.flatMap((s) => out[s].flatMap((e) => e.bullets.map((b) => b.id))));
  out.changes = prev.changes.filter((c) => present.has(c.bulletId) || c.bulletId === "skills" || c.bulletId === "summary");
  return out;
}

/** reverifyEdits on a carried-over CV, plus one revertBlocked pass if the gate blocks (its reverts are returned). */
function recheck(ctx: TailorCtx, tailored: TailoredCV): { r: ReverifyResult; reverted: RevertedChange[] } {
  const g = { cv: ctx.cv.parsed, rawText: ctx.cv.rawText, job: ctx.job, confirmedFacts: ctx.confirmedFacts };
  const r = reverifyEdits({ ...g, tailored });
  if (r.report.verdict !== "block") return { r, reverted: [] };
  const text = (t: TailoredCV, id: string) => SECTIONS.flatMap((s) => t[s].flatMap((e) => e.bullets)).find((b) => b.id === id)?.text ?? null;
  const rb = revertBlocked(r.tailored, ctx.cv.parsed, r.report.issues);
  const reverted = rb.reverted.map((x) => ({ ...x, attempted: text(r.tailored, x.bulletId) ?? "", restored: text(rb.tailored, x.bulletId) }));
  return { r: reverifyEdits({ ...g, tailored: rb.tailored }), reverted };
}

/**
 * A full TailorOutcome for a swap, with no AI: the carried-over AI version is re-checked by reverifyEdits (report,
 * changes, needsNumber); coverage and tailoredFor come from coverageSummary against the new base; one revertBlocked
 * pass if the gate blocks; the rest (attempts, fallback flags, unconfirmed numbers) is the stored outcome's.
 */
function swapOutcome(ctx: TailorCtx, prev: TailorOutcome): TailorOutcome {
  const { r, reverted: added } = recheck(ctx, carryTailored(ctx.cv.parsed, prev.tailored));
  const ids = new Set(SECTIONS.flatMap((s) => r.tailored[s].flatMap((e) => e.bullets.map((b) => b.id))));
  const reverted = [...prev.reverted.filter((x) => x.bulletId === "skills" || ids.has(x.bulletId)), ...added];
  return {
    ...prev, ...coverageSummary(ctx.cv.parsed, ctx.job, r.tailored),
    tailored: r.tailored, report: r.report, changes: r.changes, reverted, needsNumber: r.needsNumber,
  };
}

/**
 * One-click "Add back" / "Remove" for a bank item on this job, with no AI call: re-select with the stored overrides plus
 * this change, keep the tailored bullets still in the new base, add new ones untailored, re-check and render.
 */
export async function swapBankItem(jobId: string, itemId: string, op: "add" | "remove"): Promise<TailorResult> {
  if (!isUuid(jobId)) return { error: "This role is no longer available." };
  if (op !== "add" && op !== "remove") return { error: "Unknown choice." };
  const { user } = await requireUser();
  const prev = loadStored(user.id, jobId);
  if (!prev?.outcome) return { error: NOT_TAILORED };
  if (prev.v !== 2) return { error: "Tailor again to choose what goes in from your bank." };
  const bank = getBank(user.id);
  if (typeof itemId !== "string" || !bank.entries.some((e) => e.id === itemId || e.bullets.some((b) => b.id === itemId))) {
    return { error: "That item is no longer in your bank." };
  }
  const without = (xs: string[]) => xs.filter((x) => x !== itemId);
  const overrides: BankOverrides = op === "add"
    ? { pinned: [...without(prev.overrides.pinned), itemId], excluded: without(prev.overrides.excluded) }
    : { pinned: without(prev.overrides.pinned), excluded: [...without(prev.overrides.excluded), itemId] };
  const loaded = await loadTailorContext(jobId, "fresh", overrides);
  if ("error" in loaded) return loaded;
  const { ctx } = loaded;
  if (!ctx.cv.selection) return { error: "Your bank is empty, so there is nothing to add or remove. Tailor again to use your CV." };
  try {
    // outcome: the AI version carried over (drives the change cards). final: the student's saved version carried over
    // (or the AI version if they never saved), which is what gets rendered, so their accepted/edited lines survive.
    const outcome = swapOutcome(ctx, prev.outcome);
    if (outcome.report.verdict === "block") return { error: BLOCKED };
    const final = prev.final ? recheck(ctx, carryTailored(ctx.cv.parsed, prev.final)).r.tailored : outcome.tailored;
    const res = await renderAndStore(ctx, final, () => storedFresh(ctx, outcome, final));
    if ("overflow" in res) return res.overflow;
    return { outcome, award: null, pdfUrl: `/api/tailored/${jobId}`, signedUrl: res.signedUrl, bank: bankView(ctx), final };
  } catch (e) {
    if (e instanceof BlockedCvError) return { error: BLOCKED };
    console.error("swapBankItem: failed", e instanceof Error ? e.message : e);
    return { error: TAILOR_FAILED };
  }
}

/**
 * Amendment item 6: the student's final accepted/edited version. The gate re-runs on it (with the latest confirmed
 * facts) against the stored base, and the PDF is replaced only if it passes and fits one page. No XP here (23b decides
 * the "Made it yours" reward).
 */
export async function finalizeTailoredCv(jobId: string, edited: unknown): Promise<FinalizeResult> {
  const loaded = await loadTailorContext(jobId, "stored");
  if ("error" in loaded) return loaded;
  const { ctx } = loaded;
  const prevStored = ctx.stored!;
  const parsed = TailoredCvFixture.safeParse(edited);
  if (!parsed.success) return { error: "That version couldn't be read. Try again." };
  const tailored = normalizeTailored(parsed.data, ctx.cv.parsed);
  const next = (): StoredTailoring => (prevStored.v === 2
    ? {
      v: 2, outcome: prevStored.outcome, final: tailored, base: prevStored.base, rawText: prevStored.rawText, report: prevStored.report,
      scores: prevStored.scores, overrides: prevStored.overrides, bankStamp: prevStored.bankStamp,
    }
    : { v: 1, outcome: prevStored.outcome, final: tailored });
  try {
    const res = await renderAndStore(ctx, tailored, next);
    if ("overflow" in res) return res.overflow;
    return { report: res.report, pdfUrl: `/api/tailored/${jobId}`, signedUrl: res.signedUrl };
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
