import type { SupabaseClient } from "@supabase/supabase-js";
import { todayLondon } from "@/lib/scoring/dates";
import { computeAward, type AwardResult, type BadgeKey, type GamifyEvent } from "./core";

const ONCE_PER_JOB = new Set(["job_saved", "cv_tailored", "applied", "interview", "rejected", "offer"]);

export async function awardXP(supabase: SupabaseClient, userId: string, e: GamifyEvent, jobId?: string): Promise<AwardResult> {
  const today = todayLondon();
  if (jobId && ONCE_PER_JOB.has(e.type)) {
    const { count } = await supabase.from("xp_events").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("type", e.type).eq("job_id", jobId);
    if ((count ?? 0) > 0) {
      const { data: p } = await supabase.from("profiles").select("xp, level, streak_days").eq("user_id", userId).single();
      return { xpGained: 0, newXp: p?.xp ?? 0, level: p?.level ?? 1, levelName: "", levelUp: false, streakDays: p?.streak_days ?? 0, newBadges: [] };
    }
  }
  const [{ data: p }, { data: badges }, { count: applied }, { count: rejected }, { count: saves }] = await Promise.all([
    supabase.from("profiles").select("xp, streak_days, last_active_date").eq("user_id", userId).single(),
    supabase.from("badges").select("badge_key").eq("user_id", userId),
    supabase.from("xp_events").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("type", "applied"),
    supabase.from("xp_events").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("type", "rejected"),
    supabase.from("xp_events").select("id", { count: "exact", head: true }).eq("user_id", userId).eq("type", "job_saved").gte("created_at", `${today}T00:00:00Z`),
  ]);
  const { result, next } = computeAward({
    xp: p?.xp ?? 0, streakDays: p?.streak_days ?? 0, lastActiveDate: p?.last_active_date ?? null,
    badges: (badges ?? []).map((b) => b.badge_key as BadgeKey),
    savesToday: saves ?? 0, appliedCount: applied ?? 0, rejectedCount: rejected ?? 0,
  }, e, today);

  await supabase.from("xp_events").insert({ user_id: userId, type: e.type, xp: result.xpGained, job_id: jobId ?? null });
  if (result.newBadges.length) await supabase.from("badges").insert(result.newBadges.map((badge_key) => ({ user_id: userId, badge_key })));
  await supabase.from("profiles").update({ xp: next.xp, level: result.level, streak_days: next.streakDays, last_active_date: today }).eq("user_id", userId);
  return result;
}
