import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { cvs, profiles } from "@/lib/db/schema";

export { shortSchool } from "./school-name";

/** Text that looks like a university rather than a school, college course or exam board. */
const looksLikeUniversity = (s: string) => /universit|college|school of|institute|polytechnic|\bucl\b|\blse\b|\bkcl\b/i.test(s);

/**
 * The student's university: what they set in Settings, else the most recent university on their active CV, else null.
 * Used wherever Placed talks about alumni (LinkedIn searches, message drafts, plan steps); never assumed.
 */
export function universityFor(userId: string): string | null {
  const set = db.select({ university: profiles.university }).from(profiles).where(eq(profiles.user_id, userId)).get()?.university?.trim();
  if (set) return set;
  const cv = db.select({ parsed: cvs.parsed_json }).from(cvs).where(and(eq(cvs.user_id, userId), eq(cvs.is_active, true))).get();
  const school = cv?.parsed?.education?.map((e) => e.institution?.trim() ?? "").find((i) => i && looksLikeUniversity(i));
  return school || null;
}
