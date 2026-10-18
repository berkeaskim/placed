import type { ParsedCV, Year } from "@/lib/types";
import type { SafetyReport } from "@/lib/cv/safety";
import type { RuleStatus, Track } from "@/lib/cv-rules/types";

export type { RuleStatus };
export type CvContext = {
  text: string;
  pageTexts: string[];
  pageCount: number;
  fileSize: number;
  cv: ParsedCV;
  year: Year;
  /** Scoring track (absent = "standard"). */
  track?: Track;
  spellingErrors: string[] | null;
  /** Upload-time scanCvSafety() report (stored in cvs.parsed_json.safety). Absent = not scanned. */
  safety?: SafetyReport;
};
export type RuleResult = {
  ruleId: string;
  status: RuleStatus;
  evidenceLine: string | null;
  fix: string | null;
  /** Optional machine-readable detail (e.g. unevidenced skills, finding spans). */
  detail?: string;
};

/**
 * Result statuses after judging. `could_not_assess` (A1 / 06 R1): the judge quoted an evidence line
 * that is not in the redacted CV, so the verdict is discarded — excluded from the denominator and
 * counted separately. Code checkers never produce it.
 */
export type ResultStatus = RuleStatus | "could_not_assess";
export type ScoredRuleResult = Omit<RuleResult, "status"> & { status: ResultStatus };
