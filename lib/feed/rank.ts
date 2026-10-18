import type { StudentProfile } from "@/lib/types";
import type { JobListItem } from "@/lib/db/queries";
import { computeCoverage, cvSkillSource, jdRequirementSkills, profileSkillSource, type CoverageResult, type CvSkillSource, type JdSkill, type SkillSourceCv } from "@/lib/scoring/coverage";
import { scoreFit, type FitResult } from "@/lib/scoring/fit";
import { cvGradeOf, type EligibilitySignals } from "@/lib/scoring/eligibility";
import { isOpen } from "@/lib/scoring/dates";
import { APPLY_XP } from "@/lib/gamify/core";
import type { FitLabel } from "@/lib/types";

export type Ranked = { job: JobListItem; fit: FitResult; coverage: CoverageResult };
/** `elig`: posting signals parsed once per job (the feed drops textLines). `eligibilityOverride`: the student said the gate is wrong. */
export type RankJob = JobListItem & { jdSkills?: JdSkill[]; elig?: EligibilitySignals; eligibilityOverride?: boolean };

const isSkillSource = (cv: CvSkillSource | SkillSourceCv): cv is CvSkillSource => "skillsList" in cv;

const LABEL_RANK: Record<FitLabel, number> = { "Strong fit": 0, "Good fit": 1, "Stretch": 2, "Not recommended": 3 };

/**
 * Open jobs only (past deadlines hidden; "closes today" and no-deadline stay), jobs to check eligibility on last, then
 * by fit label, then readable-requirements jobs before unreadable ones (their neutral coverage is a guess, not evidence),
 * then by urgency (closing within a week, then within two weeks or rolling), then by score. The deadline orders jobs
 * within a label but never changes a score or label (10#4).
 * `cv` is the parsed CV, an already-flattened skill source, or null (falls back to the profile's skills).
 */
export function rankJobs(student: StudentProfile, cv: CvSkillSource | SkillSourceCv | null, jobs: RankJob[], today: string, opts: { course?: string | null } = {}): Ranked[] {
  // Same for every job, so flatten the CV once rather than per job.
  const source = cv ? (isSkillSource(cv) ? cv : cvSkillSource(cv)) : profileSkillSource(student.skills);
  const cvGrade = cv && !isSkillSource(cv) ? cvGradeOf(cv) : null;
  return jobs
    .filter((j) => isOpen(j.deadline, today))
    .map((job) => {
      const coverage = computeCoverage(job.jdSkills ?? jdRequirementSkills(job.textLines, job.requirements), source);
      const fit = scoreFit(student, job, coverage, today, { signals: job.elig, cvGrade, course: opts.course, overridden: job.eligibilityOverride });
      return { job, coverage, fit };
    })
    .sort((a, b) =>
      Number(a.fit.capped) - Number(b.fit.capped) ||
      LABEL_RANK[a.fit.label] - LABEL_RANK[b.fit.label] ||
      Number(!a.coverage.readable) - Number(!b.coverage.readable) ||
      a.fit.urgency.rank - b.fit.urgency.rank ||
      b.fit.global - a.fit.global);
}

/** Flat: applying earns the same whatever the fit label, so XP never rewards the scorer's guesses (10#3). */
export const applyXp = (): number => APPLY_XP;
