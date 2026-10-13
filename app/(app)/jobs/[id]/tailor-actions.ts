"use server";
/**
 * Task 23b server actions for the tailoring screen. They wrap the 23a actions (finalizeTailoredCv, confirmNumber)
 * with the 23b XP decisions, and add the live preview (gate + must-haves + rules gained) and C13 questions.
 */
import { createHash } from "node:crypto";
import { requireUser } from "@/lib/supabase/server";
import { getActiveCv, getJob, getProfile, toStudent } from "@/lib/db/queries";
import { isUuid } from "@/lib/feed/save-result";
import { awardXP } from "@/lib/gamify/award";
import type { AwardResult } from "@/lib/gamify/core";
import { reverifyEdits, type BeforeAfter, type Counts } from "@/lib/tailor/run";
import { rulesGained } from "@/lib/tailor/rules-gained";
import { countStudentEdits, type RulesGained } from "@/lib/tailor/view";
import { normalizeTailored } from "@/lib/ai/tailorCV";
import { TailoredCvFixture } from "@/lib/ai/schemas";
import { defendQuestions, type DefendQuestionT } from "@/lib/ai/defendQuestions";
import type { VerifyReport } from "@/lib/verify/tailoring";
import { confirmNumber, finalizeTailoredCv, type StoredTailoring } from "./actions";

export type PreviewResult =
  | { report: VerifyReport; mustHaves: BeforeAfter<Counts>; niceToHaves: BeforeAfter<Counts>; coverageAfter: number | null; rules: RulesGained }
  | { error: string };
export type SaveResult =
  | { report: VerifyReport; pdfUrl: string; signedUrl: string | null; award: AwardResult | null }
  | { error: string; report?: VerifyReport };
export type ConfirmResult = { ok: true; stored: string | null; award: AwardResult | null } | { error: string };
export type DefendResult = { questions: DefendQuestionT[] } | { error: string };

const GONE = "This role is no longer available.";

async function load(jobId: string) {
  const { supabase, user } = await requireUser();
  const [job, cv, profile, facts] = await Promise.all([
    getJob(supabase, jobId), getActiveCv(supabase, user.id), getProfile(supabase, user.id),
    supabase.from("confirmed_facts").select("claim").eq("user_id", user.id),
  ]);
  return { supabase, user, job, cv, profile, confirmedFacts: (facts.data ?? []).map((f) => f.claim as string) };
}

/**
 * Live preview of the student's accept/edit/reject choices: the same gate as the PDF path (reverifyEdits),
 * the exact must-have recount, and rules gained per dimension. Writes nothing.
 */
export async function previewTailoring(jobId: string, edited: unknown): Promise<PreviewResult> {
  if (!isUuid(jobId)) return { error: GONE };
  const { job, cv, profile, confirmedFacts } = await load(jobId);
  if (!job) return { error: GONE };
  if (!cv) return { error: "Upload your CV first: tailoring needs it." };
  const parsed = TailoredCvFixture.safeParse(edited);
  if (!parsed.success) return { error: "That version couldn't be read." };
  const tailored = normalizeTailored(parsed.data, cv.parsed);
  const r = reverifyEdits({ cv: cv.parsed, rawText: cv.rawText ?? "", job, confirmedFacts, tailored });
  const student = toStudent(profile);
  const sector = job.archetype ?? student.archetypes[0]?.key ?? "data_analytics";
  return { report: r.report, mustHaves: r.mustHaves, niceToHaves: r.niceToHaves, coverageAfter: r.coverageAfter, rules: rulesGained(cv.parsed, r.tailored, sector, student.year) };
}

/**
 * Save the student's version: finalizeTailoredCv re-runs the gate and replaces the PDF only on pass.
 * If they rewrote a suggestion in their own words, award "suggestion_edited" (+10 XP, Made it yours badge, once per job).
 */
export async function saveTailoredVersion(jobId: string, edited: unknown): Promise<SaveResult> {
  const r = await finalizeTailoredCv(jobId, edited);
  if ("error" in r) return r;
  let award: AwardResult | null = null;
  try {
    const { supabase, user } = await requireUser();
    const [cv, app] = await Promise.all([
      getActiveCv(supabase, user.id),
      supabase.from("applications").select("tailored_json").eq("user_id", user.id).eq("job_id", jobId).maybeSingle(),
    ]);
    const stored = app.data?.tailored_json as StoredTailoring | null;
    if (cv && stored?.final && stored.outcome && countStudentEdits(stored.final, stored.outcome.tailored, cv.parsed) > 0) {
      award = await awardXP(supabase, user.id, { type: "suggestion_edited" }, jobId);
    }
  } catch (e) {
    console.error("saveTailoredVersion: award failed", e instanceof Error ? e.message : e);
  }
  return { ...r, award };
}

/** B9: store the student's figure (23a confirmNumber), then +10 XP once per job for a confirmed or corrected number. */
export async function confirmNumberWithXp(jobId: string, claim: string, choice: "confirm" | "edit" | "remove" | "keep_original", edited?: string): Promise<ConfirmResult> {
  const r = await confirmNumber(jobId, claim, choice, edited);
  if ("error" in r) return r;
  let award: AwardResult | null = null;
  if (r.stored) {
    try {
      const { supabase, user } = await requireUser();
      award = await awardXP(supabase, user.id, { type: "number_confirmed" }, jobId);
    } catch (e) {
      console.error("confirmNumberWithXp: award failed", e instanceof Error ? e.message : e);
    }
  }
  return { ...r, award };
}

const MAX_BULLETS = 12;
const MAX_TEXT = 600;

/**
 * C13 "Be ready to defend this": one likely interview question per accepted line. Lazy; cached in
 * applications.tailored_json.defend keyed by the exact lines, so a re-open costs nothing and a new save invalidates it.
 */
export async function getDefendQuestions(jobId: string, bullets: unknown): Promise<DefendResult> {
  if (!isUuid(jobId)) return { error: GONE };
  if (!Array.isArray(bullets) || bullets.length === 0 || bullets.length > MAX_BULLETS) return { error: "Nothing to prepare yet." };
  const clean = bullets.flatMap((b) => {
    const x = b as { id?: unknown; before?: unknown; after?: unknown };
    return typeof x?.id === "string" && typeof x.before === "string" && typeof x.after === "string"
      ? [{ id: x.id.slice(0, 64), before: x.before.slice(0, MAX_TEXT), after: x.after.slice(0, MAX_TEXT) }] : [];
  });
  if (!clean.length) return { error: "Nothing to prepare yet." };
  const { supabase, user } = await requireUser();
  const [job, app] = await Promise.all([
    getJob(supabase, jobId),
    supabase.from("applications").select("tailored_json").eq("user_id", user.id).eq("job_id", jobId).maybeSingle(),
  ]);
  if (!job) return { error: GONE };
  const key = createHash("sha256").update(JSON.stringify(clean)).digest("hex").slice(0, 32);
  const stored = app.data?.tailored_json as (StoredTailoring & { defend?: { key: string; questions: DefendQuestionT[] } }) | null;
  if (!stored?.outcome) return { error: "Tailor your CV for this role first." };
  // Only lines that are in the saved version (fix round 1): never generate for arbitrary client text.
  const saved = stored.final ?? stored.outcome.tailored;
  const norm = (t: string) => t.trim().replace(/\s+/g, " ");
  const lines = new Set([saved.summary ?? "", ...(["experience", "projects", "leadership"] as const)
    .flatMap((s) => saved[s].flatMap((e) => e.bullets.map((b) => b.text)))].map(norm));
  if (clean.some((b) => !lines.has(norm(b.after)))) return { error: "Save your version first, then we can prepare questions for it." };
  if (stored.defend?.key === key) return { questions: stored.defend.questions };
  try {
    const { questions } = await defendQuestions({ bullets: clean, jobTitle: job.title, company: job.company });
    {
      const { error } = await supabase.from("applications").update({ tailored_json: { ...stored, defend: { key, questions } } })
        .eq("user_id", user.id).eq("job_id", jobId);
      if (error) console.error("getDefendQuestions: cache write failed", error.message);
    }
    return { questions };
  } catch (e) {
    console.error("getDefendQuestions: failed", e instanceof Error ? e.message : e);
    return { error: "We couldn't prepare questions right now. Try again in a moment." };
  }
}
