import type { AppStatus } from "@/lib/types";
import type { OutreachPurpose } from "./draft";
import type { OutreachTarget } from "./targets";

export const FOLLOW_UP_DAYS = 21;
export type Nudge = { text: string; target: OutreachTarget; purpose: OutreachPurpose };

/** The one networking step that fits where this application is now (spec §3.4), or null. */
export function nudgeFor(a: { status: AppStatus; company: string; lastEventAt: string | null; updatedAt: string }, now: Date): Nudge | null {
  if (a.status === "interview") return { text: `Interview at ${a.company}: ask a UCL alumnus there a prep question.`, target: "alumni", purpose: "interview_prep" };
  if (a.status !== "applied") return null;
  const since = (now.getTime() - Date.parse(a.lastEventAt ?? a.updatedAt)) / 86_400_000;
  return since >= FOLLOW_UP_DAYS
    ? { text: `No news from ${a.company} for 3 weeks: send the recruiter a polite follow-up.`, target: "recruiter", purpose: "follow_up" }
    : null;
}
