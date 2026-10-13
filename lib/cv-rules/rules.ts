import type { CvRule } from "./types";
import { GENERAL_RULES } from "./rules/general";
import { FINANCE_RULES } from "./rules/finance";

export const RULES: CvRule[] = [...GENERAL_RULES, ...FINANCE_RULES];
