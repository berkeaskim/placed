import type { CvRule } from "./types";
import { GENERAL_RULES } from "./rules/general";
import { FINANCE_RULES } from "./rules/finance";
import { TECH_RULES } from "./rules/tech";
import { AMENDMENT_RULES } from "./rules/amendments";
import { SPRING_ADJUST, SPRING_RULES } from "./rules/spring";

export { SPRING_ADJUST };

const withSpring = (r: CvRule): CvRule =>
  SPRING_ADJUST[r.id] ? { ...r, trackAdjust: { ...r.trackAdjust, spring: SPRING_ADJUST[r.id] } } : r;

/**
 * An llm rule may return not_applicable only when its question says when (audit 04#1): "Not applicable if…" or
 * "Bonus rule: … not_applicable". Every other not_applicable from the judge becomes could_not_assess.
 */
const NA_WORDING = /not[ _]applicable/i;
const withNa = (r: CvRule): CvRule => (r.check === "llm" && !r.naAllowed && NA_WORDING.test(r.llmGuidance) ? { ...r, naAllowed: true } : r);

export const RULES: CvRule[] = [...GENERAL_RULES, ...FINANCE_RULES, ...TECH_RULES, ...AMENDMENT_RULES].map(withSpring).concat(SPRING_RULES).map(withNa);
