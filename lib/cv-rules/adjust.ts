import type { Year } from "@/lib/types";
import type { CvRule, RuleAdjust, Track } from "./types";

/** The adjustment that applies: the track's if it has one, else the year's (the track describes the application). */
export function adjustFor(rule: CvRule, year: Year, track: Track = "standard"): RuleAdjust | undefined {
  return rule.trackAdjust?.[track] ?? rule.yearAdjust?.[year];
}
