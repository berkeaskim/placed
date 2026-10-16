import type { AppStatus } from "@/lib/types";
import type { OutreachPurpose } from "./draft";
import type { OutreachTarget } from "./targets";
import { shortSchool } from "@/lib/profile/school-name";

export const FOLLOW_UP_DAYS = 21;
export type Nudge = { text: string; target: OutreachTarget; purpose: OutreachPurpose };

/** The newest of the last email and the last card change; a manual move after an email restarts the clock. */
function lastActivity(lastEventAt: string | null, updatedAt: string): number {
  const times = [lastEventAt ? Date.parse(lastEventAt) : NaN, Date.parse(updatedAt)].filter((t) => !Number.isNaN(t));
  return times.length ? Math.max(...times) : NaN;
}

/**
 * The one networking step that fits where this application is now (spec §3.4), or null. `sentTargets` holds the targets
 * the student has already messaged for this job; a nudge toward one of them is not repeated.
 */
export function nudgeFor(
  a: { status: AppStatus; company: string; lastEventAt: string | null; updatedAt: string },
  now: Date,
  sentTargets?: ReadonlySet<OutreachTarget>,
  school?: string | null,
): Nudge | null {
  const nudge = pick(a, now, school ? shortSchool(school) : null);
  return nudge && sentTargets?.has(nudge.target) ? null : nudge;
}

function pick(a: { status: AppStatus; company: string; lastEventAt: string | null; updatedAt: string }, now: Date, school: string | null): Nudge | null {
  if (a.status === "interview") {
    const who = school ? `an alumnus from ${school}` : "an alumnus from your university";
    return { text: `Interview at ${a.company}: ask ${who} there a prep question.`, target: "alumni", purpose: "interview_prep" };
  }
  if (a.status !== "applied") return null;
  const since = (now.getTime() - lastActivity(a.lastEventAt, a.updatedAt)) / 86_400_000;
  return since >= FOLLOW_UP_DAYS
    ? { text: `No news from ${a.company} for 3 weeks: send the recruiter a polite follow-up.`, target: "recruiter", purpose: "follow_up" }
    : null;
}
