import type { CvRule } from "./types";
import { GENERAL_RULES } from "./rules/general";
import { FINANCE_RULES } from "./rules/finance";
import { TECH_RULES } from "./rules/tech";
import { AMENDMENT_RULES } from "./rules/amendments";
import { SPRING_ADJUST, SPRING_RULES } from "./rules/spring";

export { SPRING_ADJUST };

const withSpring = (r: CvRule): CvRule =>
  SPRING_ADJUST[r.id] ? { ...r, trackAdjust: { ...r.trackAdjust, spring: SPRING_ADJUST[r.id] } } : r;

export const RULES: CvRule[] = [...GENERAL_RULES, ...FINANCE_RULES, ...TECH_RULES, ...AMENDMENT_RULES].map(withSpring).concat(SPRING_RULES);
