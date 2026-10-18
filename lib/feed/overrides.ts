import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { eligibilityOverrides } from "@/lib/db/schema";

/** Jobs whose eligibility check the student marked as wrong ("This is wrong", audit 10#3). */
export function eligibilityOverrideIds(userId: string): Set<string> {
  return new Set(db.select({ job_id: eligibilityOverrides.job_id }).from(eligibilityOverrides).where(eq(eligibilityOverrides.user_id, userId)).all().map((r) => r.job_id));
}

export function hasEligibilityOverride(userId: string, jobId: string): boolean {
  return Boolean(db.select({ job_id: eligibilityOverrides.job_id }).from(eligibilityOverrides)
    .where(and(eq(eligibilityOverrides.user_id, userId), eq(eligibilityOverrides.job_id, jobId))).get());
}

export function setEligibilityOverride(userId: string, jobId: string, on: boolean): void {
  if (on) db.insert(eligibilityOverrides).values({ user_id: userId, job_id: jobId }).onConflictDoNothing().run();
  else db.delete(eligibilityOverrides).where(and(eq(eligibilityOverrides.user_id, userId), eq(eligibilityOverrides.job_id, jobId))).run();
}
