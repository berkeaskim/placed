import type { ParsedCV, Year } from "@/lib/types";
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
};
export type RuleResult = {
  ruleId: string;
  status: RuleStatus;
  evidenceLine: string | null;
  fix: string | null;
  /** Optional machine-readable detail (e.g. unevidenced skills, "pending cv-modules"). */
  detail?: string;
};
