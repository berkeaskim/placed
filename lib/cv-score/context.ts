import type { ParsedCV, Year } from "@/lib/types";
import type { SafetyReport } from "@/lib/cv/safety";
import type { RuleStatus } from "@/lib/cv-rules/types";

export type { RuleStatus };
export type CvContext = {
  text: string;
  pageTexts: string[];
  pageCount: number;
  fileSize: number;
  cv: ParsedCV;
  year: Year;
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
