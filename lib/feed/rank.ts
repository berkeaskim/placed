import type { FitLabel, StudentProfile } from "@/lib/types";
import type { JobListItem } from "@/lib/db/queries";
import { computeCoverage, cvSkillSource, jdRequirementSkills, profileSkillSource, type CoverageResult, type CvSkillSource, type JdSkill, type SkillSourceCv } from "@/lib/scoring/coverage";
import { scoreFit, type FitResult } from "@/lib/scoring/fit";
import { isOpen } from "@/lib/scoring/dates";
import { APPLY_XP } from "@/lib/gamify/core";

export type Ranked = { job: JobListItem; fit: FitResult; coverage: CoverageResult };

const isSkillSource = (cv: CvSkillSource | SkillSourceCv): cv is CvSkillSource => "skillsList" in cv;

const LABEL_RANK: Record<FitLabel, number> = { "Strong fit": 0, "Good fit": 1, "Stretch": 2, "Not recommended": 3 };

/**
 * Open jobs only (past deadlines hidden; "closes today" and no-deadline stay), gated jobs last, then by fit label, then readable-requirements jobs before unreadable ones (their neutral coverage is
 * a guess, not evidence), then by score. Scores and labels themselves are untouched.
 * `cv` is the parsed CV, an already-flattened skill source, or null (falls back to the profile's skills).
 */
export function rankJobs(student: StudentProfile, cv: CvSkillSource | SkillSourceCv | null, jobs: (JobListItem & { jdSkills?: JdSkill[] })[], today: string): Ranked[] {
  // Same for every job, so flatten the CV once rather than per job.
  const source = cv ? (isSkillSource(cv) ? cv : cvSkillSource(cv)) : profileSkillSource(student.skills);
  return jobs
    .filter((j) => isOpen(j.deadline, today))
    .map((job) => {
      const coverage = computeCoverage(job.jdSkills ?? jdRequirementSkills(job.textLines, job.requirements), source);
      return { job, coverage, fit: scoreFit(student, job, coverage, today) };
    })
    .sort((a, b) =>
      Number(a.fit.capped) - Number(b.fit.capped) ||
      LABEL_RANK[a.fit.label] - LABEL_RANK[b.fit.label] ||
      Number(!a.coverage.readable) - Number(!b.coverage.readable) ||
      b.fit.global - a.fit.global);
}

export const applyXp = (l: FitLabel): number => APPLY_XP[l];
