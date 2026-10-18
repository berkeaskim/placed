import type { WorkAuth } from "@/lib/types";

export const WORK_AUTH_LABEL: Record<WorkAuth, string> = {
  uk_rtw: "British, Irish or settled (no visa needed)",
  student_visa: "On a Student visa",
  graduate_visa: "On a Graduate visa",
  needs_sponsorship: "I'll need a work visa for any UK job",
};

/** Anything other than unrestricted UK right to work counts as "needs a visa" for the yes/no hint. */
export const needsVisaFor = (w: WorkAuth | null | undefined) => !!w && w !== "uk_rtw";

/** Profiles saved before work_auth existed only have the old switch: on it most likely means a Student visa. */
export const workAuthOf = (p: { work_auth?: WorkAuth | null; needs_visa: boolean }): WorkAuth | null =>
  p.work_auth ?? (p.needs_visa ? "student_visa" : null);
