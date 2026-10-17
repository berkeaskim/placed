import "server-only";
import { and, count, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { awardXp } from "@/lib/db/functions";
import { badges, profiles, xpEvents } from "@/lib/db/schema";
import { todayLondon } from "@/lib/scoring/dates";
import { computeAward, levelFromXp, londonDayStart, noAward, type AwardResult, type BadgeKey, type GamifyEvent } from "./core";

const JOB_EVENTS = new Set(["job_saved", "cv_tailored", "applied", "interview", "rejected", "offer", "number_confirmed", "suggestion_edited", "cover_letter_ready"]);

/** Reads, the event row, the xp increment, the profile update and badges all run in one synchronous transaction. */
export async function awardXP(userId: string, e: GamifyEvent, jobId?: string): Promise<AwardResult> {
  if (JOB_EVENTS.has(e.type) && !jobId) throw new Error(`awardXP: ${e.type} requires a jobId`);
  if (e.type === "playbook_done" && !e.ref) throw new Error("awardXP: playbook_done requires a ref (action id)");
  const today = todayLondon();

  return db.transaction((tx) => {
    const countOf = (type: string, since?: string) => tx.select({ n: count() }).from(xpEvents)
      .where(and(eq(xpEvents.user_id, userId), eq(xpEvents.type, type), since ? gte(xpEvents.created_at, since) : undefined)).get()?.n ?? 0;
    const p = tx.select({ xp: profiles.xp, streak_days: profiles.streak_days, last_active_date: profiles.last_active_date })
      .from(profiles).where(eq(profiles.user_id, userId)).get();
    if (!p) throw new Error("awardXP: reading profile failed: profile not found");
    const owned = tx.select({ badge_key: badges.badge_key }).from(badges).where(eq(badges.user_id, userId)).all();

    // An image-only CV builds no profile: don't burn the once-per-user cv_uploaded event, so a later
    // readable CV can still earn the XP and profile_pro.
    if (e.type === "cv_uploaded" && !e.profileComplete) return noAward(p.xp, p.streak_days);

    const { result, next } = computeAward({
      xp: p.xp, streakDays: p.streak_days, lastActiveDate: p.last_active_date ?? null,
      badges: owned.map((b) => b.badge_key as BadgeKey),
      savesToday: countOf("job_saved", londonDayStart(today)), appliedCount: countOf("applied"), rejectedCount: countOf("rejected"),
      playbookDoneToday: countOf("playbook_done", londonDayStart(today)),
    }, e, today);

    // Event row first: the partial unique indexes make this the idempotency gate.
    const ins = tx.insert(xpEvents).values({ user_id: userId, type: e.type, xp: result.xpGained, job_id: jobId ?? null, ref: e.ref ?? null })
      .onConflictDoNothing().run();
    if (ins.changes === 0) return noAward(p.xp, p.streak_days);

    let newXp = next.xp;
    if (result.xpGained !== 0) newXp = awardXp(userId, result.xpGained) ?? newXp;
    const level = levelFromXp(newXp).level;
    const levelUp = level > levelFromXp(newXp - result.xpGained).level;
    tx.update(profiles).set({ level, streak_days: next.streakDays, last_active_date: today }).where(eq(profiles.user_id, userId)).run();

    let newBadges: BadgeKey[] = [];
    if (result.newBadges.length) {
      const inserted = new Set(tx.insert(badges).values(result.newBadges.map((badge_key) => ({ user_id: userId, badge_key })))
        .onConflictDoNothing().returning({ badge_key: badges.badge_key }).all().map((r) => r.badge_key as BadgeKey));
      newBadges = result.newBadges.filter((k) => inserted.has(k));
    }
    return { ...result, newXp, level, levelName: levelFromXp(newXp).name, levelUp, newBadges };
  }, { behavior: "immediate" });
}
