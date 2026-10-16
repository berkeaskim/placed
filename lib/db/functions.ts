import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "./client";
import { cvs, profiles } from "./schema";

/** Port of handle_new_user (0001 trigger): the profile row, display name from full name or the email's local part. No-op if it exists. */
export function ensureProfile(userId: string, email: string, fullName?: string | null): void {
  db.insert(profiles).values({ user_id: userId, display_name: fullName ?? email.split("@")[0] }).onConflictDoNothing().run();
}

/** Port of award_xp (0006): atomically adds `delta` to the user's xp. Returns the new xp, or null when the profile is missing. */
export function awardXp(userId: string, delta: number): number | null {
  const row = db.update(profiles).set({ xp: sql`${profiles.xp} + ${delta}` })
    .where(eq(profiles.user_id, userId)).returning({ xp: profiles.xp }).get();
  return row?.xp ?? null;
}

/** Port of activate_cv (0009): makes `cvId` the user's only active CV, in one transaction. Throws if the CV isn't theirs. */
export function activateCv(userId: string, cvId: string): void {
  db.transaction((tx) => {
    tx.update(cvs).set({ is_active: false }).where(and(eq(cvs.user_id, userId), eq(cvs.is_active, true), ne(cvs.id, cvId))).run();
    const res = tx.update(cvs).set({ is_active: true }).where(and(eq(cvs.id, cvId), eq(cvs.user_id, userId))).run();
    if (res.changes === 0) throw new Error(`activate_cv: cv ${cvId} not found`);
  }, { behavior: "immediate" });
}
