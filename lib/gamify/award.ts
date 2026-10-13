import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { todayLondon } from "@/lib/scoring/dates";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeAward, levelFromXp, londonDayStart, noAward, type AwardResult, type BadgeKey, type GamifyEvent } from "./core";

const JOB_EVENTS = new Set(["job_saved", "cv_tailored", "applied", "interview", "rejected", "offer", "number_confirmed", "suggestion_edited"]);

function fail(what: string, error: { message: string }): never {
  throw new Error(`awardXP: ${what} failed: ${error.message}`);
}

/**
 * `supabase` is the user's session client: it proves who the user is and does the reads.
 * Writes go through `writer` (service role), because RLS makes gamify state read-only for users (0003).
 */
export async function awardXP(
  supabase: SupabaseClient, userId: string, e: GamifyEvent, jobId?: string, writer?: SupabaseClient,
): Promise<AwardResult> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user || auth.user.id !== userId) throw new Error("awardXP: userId does not match the session user");
  if (JOB_EVENTS.has(e.type) && !jobId) throw new Error(`awardXP: ${e.type} requires a jobId`);
  const admin = writer ?? createAdminClient();

  const today = todayLondon();
  const count = (type: string, since?: string) => {
    let q = supabase.from("xp_events").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("type", type);
    if (since) q = q.gte("created_at", since);
    return q;
  };
  const [p, badges, applied, rejected, saves] = await Promise.all([
    supabase.from("profiles").select("xp, streak_days, last_active_date").eq("user_id", userId).single(),
    supabase.from("badges").select("badge_key").eq("user_id", userId),
    count("applied"), count("rejected"), count("job_saved", londonDayStart(today)),
  ]);
  if (p.error) fail("reading profile", p.error);
  if (badges.error) fail("reading badges", badges.error);
  if (applied.error) fail("counting applications", applied.error);
  if (rejected.error) fail("counting rejections", rejected.error);
  if (saves.error) fail("counting saves", saves.error);

  // An image-only CV builds no profile: don't burn the once-per-user cv_uploaded event, so a later
  // readable CV can still earn the XP and profile_pro.
  if (e.type === "cv_uploaded" && !e.profileComplete) return noAward(p.data?.xp ?? 0, p.data?.streak_days ?? 0);

  const { result, next } = computeAward({
    xp: p.data?.xp ?? 0, streakDays: p.data?.streak_days ?? 0, lastActiveDate: p.data?.last_active_date ?? null,
    badges: (badges.data ?? []).map((b) => b.badge_key as BadgeKey),
    savesToday: saves.count ?? 0, appliedCount: applied.count ?? 0, rejectedCount: rejected.count ?? 0,
  }, e, today);

  // Event row first: unique indexes make this the idempotency gate.
  const ins = await admin.from("xp_events").insert({ user_id: userId, type: e.type, xp: result.xpGained, job_id: jobId ?? null });
  if (ins.error) {
    if (ins.error.code === "23505") return noAward(p.data?.xp ?? 0, p.data?.streak_days ?? 0);
    fail("recording event", ins.error);
  }

  let newXp = next.xp;
  if (result.xpGained !== 0) {
    const inc = await admin.rpc("award_xp", { p_user: userId, p_delta: result.xpGained });
    if (inc.error) fail("incrementing xp", inc.error);
    if (typeof inc.data === "number") newXp = inc.data;
  }
  const level = levelFromXp(newXp).level;
  // From award_xp's result, not the pre-read XP: a concurrent award may already have crossed the boundary.
  const levelUp = level > levelFromXp(newXp - result.xpGained).level;
  const upd = await admin.from("profiles").update({ level, streak_days: next.streakDays, last_active_date: today }).eq("user_id", userId);
  if (upd.error) fail("updating profile", upd.error);

  // ON CONFLICT DO NOTHING ... RETURNING yields only the rows this call inserted, so a badge a concurrent
  // award already saved isn't reported as new twice.
  let newBadges: BadgeKey[] = [];
  if (result.newBadges.length) {
    const b = await admin.from("badges")
      .upsert(result.newBadges.map((badge_key) => ({ user_id: userId, badge_key })), { onConflict: "user_id,badge_key", ignoreDuplicates: true })
      .select("badge_key");
    if (b.error) fail("saving badges", b.error);
    const inserted = new Set((b.data ?? []).map((r) => r.badge_key as BadgeKey));
    newBadges = result.newBadges.filter((k) => inserted.has(k));
  }
  return { ...result, newXp, level, levelName: levelFromXp(newXp).name, levelUp, newBadges };
}
