import type { Archetype, ParsedCV, Year } from "@/lib/types";
import type { LiInputSource } from "@/lib/linkedin-rules/types";
import type { ParsedLinkedIn } from "@/lib/linkedin/parse-export";
import type { RuleResult, ScoredRuleResult } from "@/lib/cv-score/context";

export type { RuleResult, ScoredRuleResult };

export type LiContext = {
  li: ParsedLinkedIn;
  /** Full export text (all sections), what LLM evidence lines must quote. */
  text: string;
  /** The CV Placed already holds, for the integrity cross-check. null = no CV on file. */
  cv: ParsedCV | null;
  sector: Archetype;
  year: Year;
  /** Which input produced `li` (PDF export, data archive, extension capture, public page). */
  source?: LiInputSource;
  /** Scoring date (injected so checks are deterministic in tests). */
  today: Date;
};
