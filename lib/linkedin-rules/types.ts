import type { Archetype, Year } from "@/lib/types";
import type { Citation, Evidence, Severity } from "@/lib/cv-rules/types";

export type { Citation, Evidence, Severity };

/** LinkedIn dimensions (docs/research/linkedin/00-playbook.md §3). `presence` is advisory: weight 0, never scored. */
export const LI_DIMS = ["integrity", "proof", "findability", "narrative", "polish", "presence"] as const;
export type LiDimension = (typeof LI_DIMS)[number];

/** Where a rule's evidence comes from. Only `pdf_export` (or a rule listing it in altInputs) is checked today. */
export type LiInput = "pdf_export" | "screenshot" | "self_report";

/** `hybrid` rules are judged by the LLM; their llmGuidance already describes the code pre-filter. */
export type LiCheck = "code" | "llm" | "hybrid";

type YearAdjust = Partial<Record<Year, { severity?: Severity; threshold?: number; skip?: boolean }>>;
type Params = { threshold?: number; majorThreshold?: number };

/** One rule as stored in rules.json (generated from docs/research/linkedin/linkedin-rules.json). */
export type LiRule = {
  id: string;
  sectors: Archetype[] | "all";
  dimension: LiDimension;
  statement: string;
  check: LiCheck;
  input: LiInput;
  altInputs?: LiInput[];
  severity: Severity;
  evidence: Evidence;
  sourceIds: string[];
  yearAdjust?: YearAdjust;
  sectorAdjust?: Partial<Record<Archetype, { severity?: Severity }>>;
  params?: Params;
  sectorParams?: Partial<Record<Archetype, Params>>;
  /** Generic rule switched off for these sectors because the named sector rule does the same job. */
  replacedBy?: Partial<Record<Archetype, string>>;
  llmGuidance?: string;
  passExample?: string;
  failExample?: string;
  allowPartial?: true;
  /** Presence tips: rendered on a separate card, never scored. */
  advisory?: true;
  /** Integrity risk: a failed critical riskFlag rule caps the score. */
  riskFlag?: true;
  /** The PDF export may not carry the section this rule reads (unconfirmed until real fixtures exist). */
  pdfContested?: true;
};

export type LiSource = { id: string; title: string; publisher: string; year: string; url: string };

/** A rule resolved for one sector: citations attached, sector params applied. */
export type LiResolvedRule = Omit<LiRule, "sectorParams" | "replacedBy"> & { citations: Citation[] };
