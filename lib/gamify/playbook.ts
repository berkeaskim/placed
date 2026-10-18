/**
 * XP for a finished Role Playbook step, scaled by what it takes and what it proves (06#7, 07#18).
 * A 90-minute course and a term-long client project are not the same work, and practice that never goes on a
 * CV (case drills, arithmetic games) earns a token amount. A real https evidence link adds a little.
 */
export type PlaybookEffort = "weekend" | "2-4 weeks" | "term";
export type PlaybookSignalValue = "cv_high" | "cv_medium" | "cv_low" | "interview_prep" | "test_prep";

export const PLAYBOOK_XP = { weekend: 15, "2-4 weeks": 40, term: 80 } as const;
export const PLAYBOOK_PRACTICE_XP = 10;
export const PLAYBOOK_EVIDENCE_BONUS = 10;

export function playbookXp(e: { effort?: PlaybookEffort; signalValue?: PlaybookSignalValue; hasEvidence?: boolean }): number {
  const practice = e.signalValue === "interview_prep" || e.signalValue === "test_prep";
  const base = practice ? PLAYBOOK_PRACTICE_XP : PLAYBOOK_XP[e.effort ?? "weekend"];
  return base + (e.hasEvidence && !practice ? PLAYBOOK_EVIDENCE_BONUS : 0);
}
