import type { CvRule } from "./types";
import { GENERAL_RULES } from "./rules/general";
import { FINANCE_RULES } from "./rules/finance";
import { TECH_RULES } from "./rules/tech";

export const RULES: CvRule[] = [...GENERAL_RULES, ...FINANCE_RULES, ...TECH_RULES];
