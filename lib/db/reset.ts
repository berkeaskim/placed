import { rm } from "node:fs/promises";
import path from "node:path";
import { eq, getTableName } from "drizzle-orm";
import { db } from "./client";
import { dataDir } from "./paths";
import {
  applications, autopilotPacks, autopilotVault, badges, confirmedFacts, cvFeedback, cvScores, cvs, linkedinScores, matches,
  outreach, playbookProgress, profiles, xpEvents,
} from "./schema";

/** Deleted in this order: cv_scores/cv_feedback reference cvs, outreach references applications. All have a user_id column. */
const TABLES = [
  autopilotPacks, autopilotVault, cvScores, cvFeedback, cvs, confirmedFacts, matches, outreach,
  applications, xpEvents, badges, playbookProgress, linkedinScores,
] as const;
export const USER_TABLES: readonly string[] = TABLES.map(getTableName);
export const USER_BUCKETS = ["cvs", "tailored"] as const;

/**
 * Removes everything the user stored: their rows and the profile's onboarding + gamification fields (one transaction),
 * then their files under `files/<bucket>/<userId>/`. Rows go first so a failure never leaves rows pointing at deleted
 * files; a file failure afterwards only leaves orphans, and a retry removes them. Shared data (jobs, companies,
 * interview preps) and app settings (AI keys) are kept.
 */
export async function resetUserData(userId: string): Promise<void> {
  if (!userId || userId.includes("/") || userId.includes("\\") || userId.startsWith(".")) throw new Error("resetUserData: userId required");
  db.transaction((tx) => {
    for (const t of TABLES) tx.delete(t).where(eq(t.user_id, userId)).run();
    tx.update(profiles).set({
      year: null, field: null, course: null, university: null, location_pref: [], needs_visa: false, target_archetype: null, archetypes: [], skills: [],
      onboarded: false, xp: 0, level: 1, streak_days: 0, last_active_date: null,
    }).where(eq(profiles.user_id, userId)).run();
  });
  for (const bucket of USER_BUCKETS) await rm(path.join(dataDir(), "files", bucket, userId), { recursive: true, force: true });
}
