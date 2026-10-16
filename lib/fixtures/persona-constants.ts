/** Fixture persona constants (Task 25). Import-light on purpose: tsx scripts load this without pulling PDF libraries. */
import type { Archetype } from "@/lib/types";

export const DEMO_SECTORS = ["data_analytics", "consulting", "finance_banking"] as const satisfies readonly Archetype[];
export const DEMO_PERSONA_PATH = "seed/demo/ayse.json";
export const DEMO_CV_PATH = "seed/demo/ayse-demir-cv.pdf";
export const DEMO_JUDGE_LABELS_PATH = "seed/demo/judge-labels.json";

/**
 * The demo job: Lendable, "Credit Analyst Intern (June 2027)", London, penultimate/2nd year (seed/jobs.json).
 * Its tagged must-haves are Python, SQL (the persona has both) and "Case Interviews" (she has none: it stays ❌).
 */
export const DEMO_JOB_EXT_ID = "a2214edc-39e3-4c70-8a09-875bb991062f";
/** Second real Lendable posting ("Summer Intern 2027", same JD text): the clean, passing tailoring run. */
export const DEMO_PASS_JOB_EXT_ID = "e001dc0b-6e0f-46a7-95ba-38a3733db2f4";
