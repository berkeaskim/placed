import type { SupabaseClient } from "@supabase/supabase-js";

/** Deleted in this order: cv_scores/cv_feedback reference cvs, so they go first. All have a user_id column. */
export const USER_TABLES = ["cv_scores", "cv_feedback", "cvs", "confirmed_facts", "matches", "applications", "xp_events", "badges", "linkedin_scores"] as const;
/** Tables from migrations that may not be applied yet (0013): a missing table means there is nothing to delete. */
const OPTIONAL_TABLES = new Set<string>(["linkedin_scores"]);
const missingTable = (e: { code?: string }) => e.code === "42P01" || e.code === "PGRST205";
export const USER_BUCKETS = ["cvs", "tailored"] as const;

const PAGE = 100;
const MAX_PAGES = 1000; // safety stop: 100k objects per bucket per user

const fail = (what: string, e: { message: string }): never => {
  throw new Error(`resetUserData: ${what} failed: ${e.message}`);
};

/**
 * Removes everything the user stored (their rows and the profile's onboarding + gamification fields first, then the
 * storage objects under `{userId}/` in both private buckets). Rows go first so a DB failure never leaves rows
 * pointing at already-deleted files; a storage failure afterwards only leaves orphaned files, and a retry removes them.
 * The auth account itself is kept.
 * `db` must be a service-role client (RLS makes gamify state read-only for users); the caller verifies the session
 * user and passes only that user's id. No server-only import: the demo-reset script reuses this.
 */
export async function resetUserData(db: SupabaseClient, userId: string): Promise<void> {
  if (!userId) throw new Error("resetUserData: userId required");

  for (const table of USER_TABLES) {
    const { error } = await db.from(table).delete().eq("user_id", userId);
    if (error && !(OPTIONAL_TABLES.has(table) && missingTable(error))) fail(`deleting ${table}`, error);
  }

  const { error } = await db.from("profiles").update({
    year: null, field: null, location_pref: [], needs_visa: false, target_archetype: null, archetypes: [], skills: [],
    onboarded: false, xp: 0, level: 1, streak_days: 0, last_active_date: null,
  }).eq("user_id", userId);
  if (error) fail("resetting profile", error);

  for (const bucket of USER_BUCKETS) {
    for (let page = 0; page < MAX_PAGES; page++) {
      // Always list from the start: each pass removes what it listed, so the next pass sees the remainder.
      const { data, error } = await db.storage.from(bucket).list(userId, { limit: PAGE, offset: 0 });
      if (error) fail(`listing ${bucket}`, error);
      if (!data?.length) break;
      const { error: rmErr } = await db.storage.from(bucket).remove(data.map((f) => `${userId}/${f.name}`));
      if (rmErr) fail(`removing from ${bucket}`, rmErr);
    }
  }
}
