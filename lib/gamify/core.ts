import type { FitLabel } from "@/lib/types";
import { daysUntil } from "@/lib/scoring/dates";

export type XpEventType = "onboarding_complete" | "cv_uploaded" | "quiz_done" | "job_saved" | "cv_tailored" | "applied" | "interview" | "rejected" | "offer";
export type BadgeKey = "profile_pro" | "first_shot" | "spring_week_hunter" | "early_bird" | "bounce_back";

export const BADGES: Record<BadgeKey, { name: string; description: string }> = {
  profile_pro: { name: "Profile Pro", description: "Built your profile from a CV or the quiz" },
  first_shot: { name: "First Shot", description: "Sent your first application" },
  spring_week_hunter: { name: "Spring Week Hunter", description: "Applied to a spring week or insight programme" },
  early_bird: { name: "Early Bird", description: "Applied more than 7 days before the deadline" },
  bounce_back: { name: "Bounce Back", description: "Applied again after a rejection" },
};

export const LEVEL_NAMES = ["Explorer", "Applicant", "Contender", "Shortlisted", "Placed"] as const;

export type GamifyState = { xp: number; streakDays: number; lastActiveDate: string | null; badges: BadgeKey[]; savesToday: number; appliedCount: number; rejectedCount: number };
export type GamifyEvent = { type: XpEventType; fitLabel?: FitLabel; jobTitle?: string; deadline?: string | null; profileComplete?: boolean };
export type AwardResult = { xpGained: number; newXp: number; level: number; levelName: string; levelUp: boolean; streakDays: number; newBadges: BadgeKey[] };

export function levelFromXp(xp: number) {
  let level = 1, rem = xp;
  while (rem >= 100 * level) { rem -= 100 * level; level++; }
  return { level, name: LEVEL_NAMES[Math.min(level - 1, LEVEL_NAMES.length - 1)], intoLevel: rem, needed: 100 * level };
}

export const APPLY_XP: Record<FitLabel, number> = { "Strong fit": 50, "Good fit": 50, Stretch: 25, "Not recommended": 10 };

export function xpFor(e: GamifyEvent, s: GamifyState): number {
  switch (e.type) {
    case "onboarding_complete": return 50;
    case "cv_uploaded": case "quiz_done": return 100;
    case "job_saved": return s.savesToday < 10 ? 5 : 0;
    case "cv_tailored": return 30;
    case "applied": return e.fitLabel ? APPLY_XP[e.fitLabel] : 25;
    case "interview": return 100;
    case "rejected": return 20;
    case "offer": return 300;
  }
}

export function computeAward(state: GamifyState, e: GamifyEvent, today: string) {
  const s = { ...state, savesToday: state.lastActiveDate === today ? state.savesToday : 0 };
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
    if (e.jobTitle && /spring|insight/i.test(e.jobTitle)) candidates.push("spring_week_hunter");
    if (e.deadline && daysUntil(e.deadline, today) > 7) candidates.push("early_bird");
    if (s.rejectedCount > 0) candidates.push("bounce_back");
  }
  const newBadges = candidates.filter((b) => !earned.has(b));

  const next: GamifyState = {
    xp: s.xp + xpGained, streakDays, lastActiveDate: today, badges: [...s.badges, ...newBadges],
    savesToday: s.savesToday + (e.type === "job_saved" ? 1 : 0),
    appliedCount: s.appliedCount + (e.type === "applied" ? 1 : 0),
    rejectedCount: s.rejectedCount + (e.type === "rejected" ? 1 : 0),
  };
  const result: AwardResult = {
    xpGained, newXp: next.xp, level: after.level, levelName: after.name, levelUp: after.level > before.level, streakDays, newBadges,
  };
  return { result, next };
}
