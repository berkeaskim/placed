import type { FitLabel } from "@/lib/types";
import { daysUntil } from "@/lib/scoring/dates";

export type XpEventType = "onboarding_complete" | "cv_uploaded" | "quiz_done" | "job_saved" | "cv_tailored" | "applied" | "interview" | "rejected" | "offer"
  // Task 23b: tailoring screen. Job-scoped, so xp_events_once_per_job (0002) makes each once per job.
  | "number_confirmed" | "suggestion_edited"
  // Task 19b: Target Role. Action-scoped via xp_events.ref (0010).
  | "playbook_done"
  // Autopilot: Answer Vault completed. Awarded once (the setup action checks completed_at).
  | "autopilot_ready"
  // Cover letter writer: an output marked Ready. Job-scoped, so xp_events_once_per_job makes it once per job.
  | "cover_letter_ready";
export type BadgeKey = "profile_pro" | "first_shot" | "spring_week_hunter" | "early_bird" | "bounce_back" | "made_it_yours" | "gap_closer";

export const BADGES: Record<BadgeKey, { name: string; description: string }> = {
  profile_pro: { name: "Profile Pro", description: "Built your profile from a CV or the quiz" },
  first_shot: { name: "First Shot", description: "Sent your first application" },
  spring_week_hunter: { name: "Spring Week Hunter", description: "Applied to a spring week or insight programme" },
  early_bird: { name: "Early Bird", description: "Applied more than 7 days before the deadline" },
  bounce_back: { name: "Bounce Back", description: "Applied again after a rejection" },
  made_it_yours: { name: "Made it yours", description: "Edited a tailored line into your own words" },
  gap_closer: { name: "Gap Closer", description: "Closed your first skill gap from a Role Playbook" },
};

export const LEVEL_NAMES = ["Explorer", "Applicant", "Contender", "Shortlisted", "Placed"] as const;

export type GamifyState = { xp: number; streakDays: number; lastActiveDate: string | null; badges: BadgeKey[]; savesToday: number; appliedCount: number; rejectedCount: number; playbookDoneToday?: number };
export type GamifyEvent = { type: XpEventType; fitLabel?: FitLabel; jobTitle?: string; deadline?: string | null; profileComplete?: boolean; ref?: string };
export type AwardResult = { xpGained: number; newXp: number; level: number; levelName: string; levelUp: boolean; streakDays: number; newBadges: BadgeKey[] };

export function levelFromXp(xp: number) {
  let level = 1, rem = xp;
  while (rem >= 100 * level) { rem -= 100 * level; level++; }
  return { level, name: LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)], intoLevel: rem, needed: 100 * level };
}

/** Programme phrases only, on word boundaries: "Data Insights Analyst" and "Springer Nature" don't count. */
const SPRING_PROGRAMME = /\b(spring\s+(week|insights?|internship|programme|program|scheme)|insights?\s+(day|days|week|weeks|programme|program|event|scheme))\b/i;

/** Flat (audit 10#3): scaling by fit label rewarded the scorer's guesses and paid less for roles a gate wrongly flagged. */
export const APPLY_XP = 50;

export const PLAYBOOK_DONE_DAILY_CAP = 3;

export function xpFor(e: GamifyEvent, s: GamifyState): number {
  switch (e.type) {
    case "onboarding_complete": return 50;
    case "cv_uploaded": case "quiz_done": return 100;
    case "job_saved": return s.savesToday < 10 ? 5 : 0;
    case "cv_tailored": return 30;
    case "applied": return APPLY_XP;
    case "interview": return 100;
    case "rejected": return 20;
    case "offer": return 300;
    case "number_confirmed": case "suggestion_edited": return 10;
    case "playbook_done": return (s.playbookDoneToday ?? 0) < PLAYBOOK_DONE_DAILY_CAP ? 40 : 0;
    case "autopilot_ready": return 50;
    case "cover_letter_ready": return 20;
  }
}

export function computeAward(state: GamifyState, e: GamifyEvent, today: string) {
  const sameDay = state.lastActiveDate === today;
  const s = { ...state, savesToday: sameDay ? state.savesToday : 0, playbookDoneToday: sameDay ? state.playbookDoneToday ?? 0 : 0 };
  const xpGained = xpFor(e, s);
  const before = levelFromXp(s.xp);
  const after = levelFromXp(s.xp + xpGained);
  const streakDays = s.lastActiveDate === today ? Math.max(1, s.streakDays)
    : s.lastActiveDate && daysUntil(today, s.lastActiveDate) === 1 ? s.streakDays + 1 : 1;

  const earned = new Set(s.badges);
  const candidates: BadgeKey[] = [];
  if ((e.type === "cv_uploaded" || e.type === "quiz_done") && e.profileComplete) candidates.push("profile_pro");
  if (e.type === "applied") {
    if (s.appliedCount === 0) candidates.push("first_shot");
    if (e.jobTitle && SPRING_PROGRAMME.test(e.jobTitle)) candidates.push("spring_week_hunter");
    if (e.deadline && daysUntil(e.deadline, today) > 7) candidates.push("early_bird");
    if (s.rejectedCount > 0) candidates.push("bounce_back");
  }
  if (e.type === "suggestion_edited") candidates.push("made_it_yours");
  if (e.type === "playbook_done") candidates.push("gap_closer");
  const newBadges = candidates.filter((b) => !earned.has(b));

  const next: GamifyState = {
    xp: s.xp + xpGained, streakDays, lastActiveDate: today, badges: [...s.badges, ...newBadges],
    savesToday: s.savesToday + (e.type === "job_saved" ? 1 : 0),
    appliedCount: s.appliedCount + (e.type === "applied" ? 1 : 0),
    rejectedCount: s.rejectedCount + (e.type === "rejected" ? 1 : 0),
    playbookDoneToday: s.playbookDoneToday + (e.type === "playbook_done" ? 1 : 0),
  };
  const result: AwardResult = {
    xpGained, newXp: next.xp, level: after.level, levelName: after.name, levelUp: after.level > before.level, streakDays, newBadges,
  };
  return { result, next };
}

/** UTC instant (ISO) at which the given London calendar day (YYYY-MM-DD) starts. */
export function londonDayStart(day: string): string {
  const midnightUtc = new Date(`${day}T00:00:00Z`);
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", hourCycle: "h23" }).format(midnightUtc));
  // At 00:00Z London is either GMT (hour 0) or BST (hour 1); local midnight is `hour` hours earlier.
  return new Date(midnightUtc.getTime() - hour * 3_600_000).toISOString();
}

/** Zero-XP result reflecting current state (duplicate events). */
export function noAward(xp: number, streakDays: number): AwardResult {
  const l = levelFromXp(xp);
  return { xpGained: 0, newXp: xp, level: l.level, levelName: l.name, levelUp: false, streakDays, newBadges: [] };
}
