import type { AppStatus } from "@/lib/types";

/**
 * After a placement offer is accepted (research/placement-year/04-timeline-process.md): the university must approve it
 * before it starts, the contract and checks follow, and other placement applications should be withdrawn so a place
 * isn't held for nothing. Placed then stops suggesting placements (DECISIONS.md §2).
 */
export const PLACEMENT_CHECKLIST = [
  { key: "uni_approval", label: "Get your university to approve it", hint: "Send your placement team the job description and contract; many also need an employer health-and-safety form." },
  { key: "contract", label: "Sign your contract", hint: "Check the start and end dates match your university's placement year." },
  { key: "checks", label: "Finish the pre-employment checks", hint: "Right to work, references and any security vetting." },
  { key: "withdraw", label: "Withdraw your other placement applications", hint: "A short, polite note to each one frees the place for someone else." },
] as const;
export type ChecklistKey = (typeof PLACEMENT_CHECKLIST)[number]["key"];
export type Checklist = Partial<Record<string, boolean>>;

const KEYS: readonly string[] = PLACEMENT_CHECKLIST.map((c) => c.key);
export const isChecklistKey = (k: unknown): k is ChecklistKey => typeof k === "string" && KEYS.includes(k);

type App = { id: string; status: AppStatus; employmentType?: string | null; acceptedAt?: string | null; company: string; title: string };

/** Only an offer can be accepted. */
export const canAccept = (status: AppStatus) => status === "offer";
/** Moving a card off Offer (back to Interview, or Rejected) undoes the acceptance. */
export const statusClearsAcceptance = (status: AppStatus) => status !== "offer";

/** The placement the student has accepted, if any. */
export function securedPlacement<T extends App>(apps: T[]): T | null {
  return apps.find((a) => a.employmentType === "placement" && a.status === "offer" && a.acceptedAt) ?? null;
}

/** Other placement applications still in play (applied, interviewing or holding an offer). */
export function otherOpenPlacements<T extends App>(apps: T[], acceptedId: string): T[] {
  return apps.filter((a) => a.id !== acceptedId && a.employmentType === "placement" && (a.status === "applied" || a.status === "interview" || a.status === "offer"));
}

export function checklistProgress(c: Checklist | null | undefined): { done: number; total: number } {
  return { done: KEYS.filter((k) => c?.[k] === true).length, total: KEYS.length };
}
