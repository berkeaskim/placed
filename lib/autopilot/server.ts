import "server-only";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { applications, autopilotPacks, autopilotVault, companies, confirmedFacts, coverLetterOutputs, coverLetters, cvs, jobs } from "@/lib/db/schema";
import { fileUrl } from "@/lib/files";
import { fetchForm } from "./forms";
import type { Ats, NormalizedForm } from "./forms/types";
import { classify } from "./classify";
import { draftAnswer, type DraftResult } from "./drafts";
import { suggestAnswers } from "./suggest";
import { assemblePack, toFillPlan, type Answers, type Covers, type FillInstruction, type PackItem } from "./pack";
import { hashToken, safeNamePart } from "./handoff";
import { isComplete, type Core, type Extra } from "./vault";
import { openVault } from "./vault-crypto";
import type { ParsedCV } from "@/lib/types";

export type JobForPack = { id: string; extId: string; url: string; ats: Ats; company: string; textLines: string[] };
export type ClaimBody = { ats: Ats; url: string; fields: FillInstruction[]; cv: { url: string; filename: string } | null; cover: { url: string; filename: string } | null };

export async function loadJobForPack(jobId: string): Promise<JobForPack | null> {
  const r = db.select({ id: jobs.id, ext_id: jobs.ext_id, url: jobs.url, text_lines: jobs.text_lines, name: companies.name, ats: companies.ats })
    .from(jobs).innerJoin(companies, eq(companies.id, jobs.company_id)).where(eq(jobs.id, jobId)).get();
  if (!r) return null;
  return { id: r.id, extId: r.ext_id, url: r.url, ats: r.ats as Ats, company: r.name, textLines: r.text_lines ?? [] };
}

/** `completed` = Autopilot is unlocked: the saved core is complete right now. `completed_at` alone is only the once-only XP marker, so it never unlocks by itself. */
export async function getVault(userId: string): Promise<{ core: Partial<Core>; extra: Extra; completed: boolean }> {
  const data = db.select({ core: autopilotVault.core, extra: autopilotVault.extra, completed_at: autopilotVault.completed_at })
    .from(autopilotVault).where(eq(autopilotVault.user_id, userId)).get();
  const core = openVault("core", userId, data?.core) as Partial<Core>;
  return { core, extra: openVault("extra", userId, data?.extra) as Extra, completed: Boolean(data?.completed_at) && isComplete(core) };
}

/** Fetches the form, (optionally) drafts free-text answers, upserts autopilot_packs. `withDrafts: false` never calls the LLM. */
export async function buildPack(userId: string, jobId: string, opts: { withDrafts?: boolean } = {}): Promise<{ items: PackItem[]; answers: Answers }> {
  const withDrafts = opts.withDrafts ?? true;
  const job = await loadJobForPack(jobId);
  if (!job) throw new Error("Job not found");
  const { core, extra } = await getVault(userId);
  const cvRow = db.select({ parsed_json: cvs.parsed_json }).from(cvs).where(and(eq(cvs.user_id, userId), eq(cvs.is_active, true))).get();
  const facts = db.select({ id: confirmedFacts.id, claim: confirmedFacts.claim }).from(confirmedFacts).where(eq(confirmedFacts.user_id, userId)).all();
  const existing = db.select({ form: autopilotPacks.form, answers: autopilotPacks.answers }).from(autopilotPacks)
    .where(and(eq(autopilotPacks.user_id, userId), eq(autopilotPacks.job_id, jobId))).get();
  const form: NormalizedForm = (existing?.form as NormalizedForm | undefined) ?? (await fetchForm(job));
  const cv = (cvRow?.parsed_json ?? null) as ParsedCV | null;
  const drafts: Record<string, DraftResult> = {};
  const answers = (existing?.answers ?? {}) as Answers;
  const base = assemblePack(form, core, extra, {});
  // Questions nobody answered yet get a CV-backed suggestion, so the student only taps Confirm.
  const toSuggest = base.filter((i) => i.group === "ask" && answers[i.field.key] === undefined);
  const suggesting = withDrafts && toSuggest.length ? suggestAnswers({ items: toSuggest, core, extra, cv, fixtureKey: job.extId }) : Promise.resolve({});
  if (withDrafts && cv) {
    for (const f of form.fields) if (classify(f.label, f.type).kind === "freeText") {
      drafts[f.key] = await draftAnswer({ question: f.label, wordLimit: f.wordLimit, company: job.company, jobExtId: job.extId, fieldKey: f.key,
        jdLines: job.textLines, cv, facts });
    }
  }
  const suggested: Record<string, string | string[]> = await suggesting;
  try {
    db.insert(autopilotPacks).values({ user_id: userId, job_id: jobId, form, answers })
      .onConflictDoUpdate({ target: [autopilotPacks.user_id, autopilotPacks.job_id], set: { form, answers } }).run();
  } catch (e) {
    throw new Error(`buildPack: ${e instanceof Error ? e.message : String(e)}`);
  }
  const items = assemblePack(form, core, extra, drafts).map((i) =>
    i.group === "ask" && suggested[i.field.key] !== undefined ? { ...i, group: "confirm" as const, value: suggested[i.field.key], sourceLabel: "suggested from your CV" } : i);
  return { items, answers };
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
  for (const o of ready) {
    if (o.target.kind === "upload") {
      if (own(o.pdf_path)) { covers.upload = { file: true }; coverPath = o.pdf_path; }
    } else if (o.text.trim()) covers[o.target.fieldKey] = { text: o.text };
  }
  const fields = toFillPlan(items, pack.answers as Answers, covers);
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
      cover = { url: fileUrl("letters", coverPath), filename: `${safeNamePart(core.first_name, "My")}-${safeNamePart(core.last_name, "Cover")}-Cover-Letter.pdf` };
    } catch {
      console.error("autopilot claim: bad cover letter path");
    }
  }
  return { status: 200, body: { ats: form.ats, url: form.url, fields, cv, cover } };
}
