import "server-only";
import { and, desc, eq, gt, isNull, ne } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { applications, autopilotLongAnswers, autopilotPacks, autopilotVault, companies, confirmedFacts, coverLetterOutputs, coverLetters, cvs, jobs } from "@/lib/db/schema";
import { letterFilename } from "@/lib/cover-letter/filename";
import { fileUrl } from "@/lib/files";
import { fetchForm } from "./forms";
import type { Ats, NormalizedForm } from "./forms/types";
import { classify } from "./classify";
import { draftAnswer, type DraftInput, type DraftResult } from "./drafts";
import { suggestAnswers } from "./suggest";
import { assemblePack, toFillPlan, type Answers, type Covers, type FillInstruction, type PackItem } from "./pack";
import { hashToken, safeNamePart } from "./handoff";
import { findRemembered, isComplete, normLabel, type Core, type Extra } from "./vault";
import { openAnswers, openLongAnswer, openVault } from "./vault-crypto";
import type { JobForScoring, ParsedCV } from "@/lib/types";
import type { Track } from "@/lib/cv-rules/types";
import { trackForJob } from "@/lib/tailor/track";
import { offerPrevious } from "./memory";
import { firmGuard } from "./firm-guard";

/** `employer`: the posting's own employer on a multi-employer board (TargetJobs), else the company. */
export type JobForPack = { id: string; extId: string; url: string; ats: Ats; company: string; employer: string; textLines: string[]; track: Track };
export type ClaimBody = { ats: Ats; url: string; fields: FillInstruction[]; cv: { url: string; filename: string } | null; cover: { url: string; filename: string } | null };

export async function loadJobForPack(jobId: string): Promise<JobForPack | null> {
  const r = db.select({ id: jobs.id, ext_id: jobs.ext_id, url: jobs.url, text_lines: jobs.text_lines, employment_type: jobs.employment_type, employer_name: jobs.employer_name, name: companies.name, ats: companies.ats })
    .from(jobs).innerJoin(companies, eq(companies.id, jobs.company_id)).where(eq(jobs.id, jobId)).get();
  if (!r) return null;
  return {
    id: r.id, extId: r.ext_id, url: r.url, ats: r.ats as Ats, company: r.name, employer: r.employer_name ?? r.name, textLines: r.text_lines ?? [],
    track: trackForJob({ employmentType: r.employment_type as JobForScoring["employmentType"] }),
  };
}

/** `completed` = Autopilot is unlocked: the saved core is complete right now. `completed_at` alone is only the once-only XP marker, so it never unlocks by itself. */
export async function getVault(userId: string): Promise<{ core: Partial<Core>; extra: Extra; completed: boolean }> {
  const data = db.select({ core: autopilotVault.core, extra: autopilotVault.extra, completed_at: autopilotVault.completed_at })
    .from(autopilotVault).where(eq(autopilotVault.user_id, userId)).get();
  const core = openVault("core", userId, data?.core) as Partial<Core>;
  return { core, extra: openVault("extra", userId, data?.extra) as Extra, completed: Boolean(data?.completed_at) && isComplete(core) };
}

/**
 * Looks up kept long answers from the student's OTHER jobs with the remembered-answer matching (exact normalised label,
 * else a near-identical one). The most recent answer wins per label; a row that no longer decrypts is skipped.
 * Memory rules (lib/autopilot/memory): a "Why [firm]?" answer is never offered, and a recent-news answer older than a
 * few weeks comes with a note to update it.
 */
function previousAnswers(userId: string, jobId: string, now = new Date()): (label: string) => { text: string; company: string; staleNote: string | null } | null {
  const rows = db.select().from(autopilotLongAnswers)
    .where(and(eq(autopilotLongAnswers.user_id, userId), ne(autopilotLongAnswers.job_id, jobId))).orderBy(desc(autopilotLongAnswers.updated_at)).all();
  const byLabel: Extra = {};
  const byId = new Map(rows.map((r) => [r.id, r]));
  for (const r of rows) byLabel[normLabel(r.field_label)] ??= r.id;
  return (label) => {
    const hit = findRemembered(byLabel, label);
    const r = hit && typeof hit.value === "string" ? byId.get(hit.value) : undefined;
    if (!r) return null;
    // The rule follows both the question asked now and the one the answer was written for.
    const offer = offerPrevious(label, r.updated_at, now);
    const offerOld = offerPrevious(r.field_label, r.updated_at, now);
    if (!offer || !offerOld) return null;
    try {
      return { text: openLongAnswer(userId, r.job_id, r.field_label, r.text), company: r.company, staleNote: offer.staleNote ?? offerOld.staleNote };
    } catch {
      return null;
    }
  };
}

export function findPreviousAnswer(userId: string, jobId: string, label: string): { text: string; company: string; staleNote: string | null } | null {
  return previousAnswers(userId, jobId)(label);
}

export type LongAnswerRow = { id: string; label: string; company: string; preview: string };

/** The student's kept long answers, newest first, with only the first 140 characters for the setup page. */
export function listLongAnswers(userId: string): LongAnswerRow[] {
  return db.select().from(autopilotLongAnswers).where(eq(autopilotLongAnswers.user_id, userId)).orderBy(desc(autopilotLongAnswers.updated_at)).all()
    .flatMap((r) => {
      try {
        return [{ id: r.id, label: r.field_label, company: r.company, preview: openLongAnswer(userId, r.job_id, r.field_label, r.text).slice(0, 140) }];
      } catch {
        return [{ id: r.id, label: r.field_label, company: r.company, preview: "" }];
      }
    });
}

const words = (s: string) => (s.trim() ? s.trim().split(/\s+/).length : 0);

/**
 * Fetches the form, caches CV-backed suggestions once (a computed `{}` counts), upserts autopilot_packs. Never drafts: see generateDraft.
 * Suggestions are only cached when an active CV existed and the AI call succeeded, so a later build retries.
 */
/** The student's other tracked applications, for the one-application-per-firm guard. */
function otherApplications(userId: string, jobId: string) {
  return db.select({ status: applications.status, title: jobs.title, employer_name: jobs.employer_name, company: companies.name })
    .from(applications).innerJoin(jobs, eq(jobs.id, applications.job_id)).innerJoin(companies, eq(companies.id, jobs.company_id))
    .where(and(eq(applications.user_id, userId), ne(applications.job_id, jobId))).all()
    .map((r) => ({ status: r.status, title: r.title, company: r.employer_name ?? r.company }));
}

export async function buildPack(userId: string, jobId: string): Promise<{ items: PackItem[]; answers: Answers; warnings: string[] }> {
  const job = await loadJobForPack(jobId);
  if (!job) throw new Error("Job not found");
  const { core, extra } = await getVault(userId);
  const cvRow = db.select({ parsed_json: cvs.parsed_json }).from(cvs).where(and(eq(cvs.user_id, userId), eq(cvs.is_active, true))).get();
  const existing = db.select({ form: autopilotPacks.form, answers: autopilotPacks.answers, suggestions: autopilotPacks.suggestions, drafts: autopilotPacks.drafts }).from(autopilotPacks)
    .where(and(eq(autopilotPacks.user_id, userId), eq(autopilotPacks.job_id, jobId))).get();
  const form: NormalizedForm = (existing?.form as NormalizedForm | undefined) ?? (await fetchForm(job));
  const cv = (cvRow?.parsed_json ?? null) as ParsedCV | null;
  // The row keeps EEO answers sealed (setAnswer): they are written back as stored and only opened for this call.
  const stored = existing?.answers ?? {};
  const answers = openAnswers(userId, jobId, stored);
  const drafts = existing?.drafts ?? {};
  const base = assemblePack(form, core, extra, {});
  // Questions nobody answered yet get a CV-backed suggestion, so the student only taps Confirm. Computed once, then reused.
  const toSuggest = base.filter((i) => i.group === "ask" && answers[i.field.key] === undefined && classify(i.field.label, i.field.type).kind !== "eeo");
  const computed = existing?.suggestions ?? (toSuggest.length ? await suggestAnswers({ items: toSuggest, core, extra, cv, fixtureKey: job.extId }) : {});
  const suggested = computed ?? {};
  const suggestions = existing?.suggestions ?? (cv && computed ? computed : null);
  try {
    db.insert(autopilotPacks).values({ user_id: userId, job_id: jobId, form, answers: stored, suggestions })
      .onConflictDoUpdate({ target: [autopilotPacks.user_id, autopilotPacks.job_id], set: { form, answers: stored, suggestions } }).run();
  } catch (e) {
    throw new Error(`buildPack: ${e instanceof Error ? e.message : String(e)}`);
  }
  const previous = previousAnswers(userId, jobId);
  const items = assemblePack(form, core, extra, drafts).map((i): PackItem => {
    if (i.group === "ask" && suggested[i.field.key] !== undefined) return { ...i, group: "confirm", value: suggested[i.field.key], sourceLabel: "suggested from your CV" };
    const p = i.group === "draft" ? previous(i.field.label) : null;
    return p ? { ...i, previous: { ...p, words: words(p.text) } } : i;
  });
  const guard = firmGuard({ company: job.employer, track: job.track, others: otherApplications(userId, jobId) });
  return { items, answers, warnings: guard ? [guard] : [] };
}

/** The input draftAnswer needs for one free-text field, or null when the job, active CV, pack or field is missing. */
export async function draftInputFor(userId: string, jobId: string, fieldKey: string): Promise<DraftInput | null> {
  const job = await loadJobForPack(jobId);
  if (!job) return null;
  const cvRow = db.select({ parsed_json: cvs.parsed_json }).from(cvs).where(and(eq(cvs.user_id, userId), eq(cvs.is_active, true))).get();
  const pack = db.select({ form: autopilotPacks.form }).from(autopilotPacks).where(and(eq(autopilotPacks.user_id, userId), eq(autopilotPacks.job_id, jobId))).get();
  if (!cvRow?.parsed_json || !pack) return null;
  const field = (pack.form as NormalizedForm).fields.find((f) => f.key === fieldKey);
  if (!field || classify(field.label, field.type).kind !== "freeText") return null;
  const facts = db.select({ id: confirmedFacts.id, claim: confirmedFacts.claim }).from(confirmedFacts).where(eq(confirmedFacts.user_id, userId)).all();
  return { question: field.label, wordLimit: field.wordLimit, company: job.company, jobExtId: job.extId, fieldKey, jdLines: job.textLines, cv: cvRow.parsed_json as ParsedCV, facts };
}

/** Drafts one free-text answer on demand and stores it on the pack; a stored draft (even an empty one) is returned without calling the AI. A failed draft (source "none") is returned but never stored. */
export async function generateDraft(userId: string, jobId: string, fieldKey: string): Promise<DraftResult | null> {
  const where = and(eq(autopilotPacks.user_id, userId), eq(autopilotPacks.job_id, jobId));
  const stored = db.select({ drafts: autopilotPacks.drafts }).from(autopilotPacks).where(where).get()?.drafts[fieldKey];
  if (stored) return stored;
  const input = await draftInputFor(userId, jobId, fieldKey);
  if (!input) return null;
  const draft = await draftAnswer(input);
  if (draft.source === "none") return draft;
  // Re-read so a draft stored for another field while the AI ran is not overwritten.
  const latest = db.select({ drafts: autopilotPacks.drafts }).from(autopilotPacks).where(where).get()?.drafts ?? {};
  db.update(autopilotPacks).set({ drafts: { ...latest, [fieldKey]: draft } }).where(where).run();
  return draft;
}

/**
 * Single use: bound to this exact token hash (a re-mint invalidates it), unexpired, and unused. The CV comes back as a
 * same-origin `/api/files/...` path; the extension resolves it against the Placed origin it is configured for.
 */
export async function claimPack(token: string): Promise<{ status: 200; body: ClaimBody } | { status: 404 | 410 }> {
  const hash = hashToken(token);
  const pack = db.select().from(autopilotPacks).where(eq(autopilotPacks.token_hash, hash)).get();
  if (!pack) return { status: 404 };
  if (pack.token_used_at || !pack.token_expires_at || Date.parse(pack.token_expires_at) < Date.now()) return { status: 410 };
  const nowIso = new Date().toISOString();
  const used = db.update(autopilotPacks).set({ token_used_at: nowIso, status: "claimed" })
    .where(and(eq(autopilotPacks.id, pack.id), eq(autopilotPacks.token_hash, hash), isNull(autopilotPacks.token_used_at), gt(autopilotPacks.token_expires_at, nowIso)))
    .run();
  if (used.changes === 0) return { status: 410 };
  const { core, extra } = await getVault(pack.user_id);
  const form = pack.form as NormalizedForm;
  const items = assemblePack(form, core, extra, {});
  // Ready outputs only, read-only: claiming never creates a letter.
  const letter = db.select({ id: coverLetters.id }).from(coverLetters)
    .where(and(eq(coverLetters.user_id, pack.user_id), eq(coverLetters.job_id, pack.job_id))).get();
  const ready = letter ? db.select().from(coverLetterOutputs)
    .where(and(eq(coverLetterOutputs.letter_id, letter.id), eq(coverLetterOutputs.status, "ready"))).all() : [];
  const own = (p: unknown): p is string => typeof p === "string" && p.startsWith(`${pack.user_id}/`);
  const covers: Covers = {};
  let coverPath: string | null = null;
  let coverDate = new Date();
  for (const o of ready) {
    if (o.target.kind === "upload") {
      if (own(o.pdf_path)) { covers.upload = { file: true }; coverPath = o.pdf_path; coverDate = new Date(o.updated_at); }
    } else if (o.text.trim()) covers[o.target.fieldKey] = { text: o.text };
  }
  const fields = toFillPlan(items, openAnswers(pack.user_id, pack.job_id, pack.answers), covers);
  const app = db.select({ tailored_cv_path: applications.tailored_cv_path }).from(applications)
    .where(and(eq(applications.user_id, pack.user_id), eq(applications.job_id, pack.job_id))).get();
  const cvRow = db.select({ storage_path: cvs.storage_path }).from(cvs).where(and(eq(cvs.user_id, pack.user_id), eq(cvs.is_active, true))).get();
  const [bucket, path] = own(app?.tailored_cv_path) ? (["tailored", app.tailored_cv_path] as const) : (["cvs", cvRow?.storage_path] as const);
  let cv: ClaimBody["cv"] = null;
  if (own(path)) {
    try {
      cv = { url: fileUrl(bucket, path), filename: `${safeNamePart(core.first_name, "My")}-${safeNamePart(core.last_name, "CV")}-CV.pdf` };
    } catch {
      console.error("autopilot claim: bad CV path");
    }
  }
  let cover: ClaimBody["cover"] = null;
  if (coverPath) {
    try {
      // The same name the card's Download PDF uses: First-Last_Cover-Letter_Company_YYYY-MM.pdf.
      const company = db.select({ name: companies.name }).from(jobs).innerJoin(companies, eq(companies.id, jobs.company_id)).where(eq(jobs.id, pack.job_id)).get()?.name ?? "";
      cover = { url: fileUrl("letters", coverPath), filename: letterFilename(core.first_name ?? "", core.last_name ?? "", company, coverDate) };
    } catch {
      console.error("autopilot claim: bad cover letter path");
    }
  }
  return { status: 200, body: { ats: form.ats, url: form.url, fields, cv, cover } };
}
