"use server";
import { requireUser } from "@/lib/supabase/server";
import { getActiveCv, getJob, getProfile, toStudent } from "@/lib/db/queries";
import { coverageFor } from "@/lib/scoring/coverage";
import { scoreFit } from "@/lib/scoring/fit";
import { todayLondon } from "@/lib/scoring/dates";
import { explainCacheKey, explainMatchWithSource, readCachedExplanation, shouldCacheExplanation, toCacheRecord } from "@/lib/ai/explainMatch";
import { aiMode } from "@/lib/env";
import { awardXP } from "@/lib/gamify/award";
import { isUuid } from "@/lib/feed/save-result";
import type { Explanation } from "@/lib/scoring/requirements";
import type { AwardResult } from "@/lib/gamify/core";

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
  const [job, profile, cv, existing] = await Promise.all([
    getJob(supabase, jobId), getProfile(supabase, user.id), getActiveCv(supabase, user.id),
    supabase.from("applications").select("status").eq("user_id", user.id).eq("job_id", jobId).maybeSingle(),
  ]);
  if (!job) return { ok: false, award: null, error: "This role is no longer available." };

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

  const student = toStudent(profile);
  const fit = scoreFit(student, job, coverageFor(job, cv?.parsed ?? null, student.skills), todayLondon());
  try {
    // `applied` is awarded once per job (unique index), so a second "Yes" earns nothing.
    const award = await awardXP(supabase, user.id, { type: "applied", fitLabel: fit.label, jobTitle: job.title, deadline: job.deadline }, jobId);
    return { ok: true, award };
  } catch (e) {
    console.error("markApplied: award failed", e instanceof Error ? e.message : e);
    return { ok: true, award: null }; // the application itself is recorded
  }
}
