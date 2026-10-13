import type { AppStatus } from "@/lib/types";

/** Board column order: Saved -> Applied -> Interview -> Offer / Rejected. */
export const COLUMNS: { key: AppStatus; label: string }[] = [
  { key: "saved", label: "Saved" }, { key: "applied", label: "Applied" }, { key: "interview", label: "Interview" },
  { key: "offer", label: "Offer" }, { key: "rejected", label: "Rejected" },
];

const STATUSES: readonly string[] = COLUMNS.map((c) => c.key);

export const isAppStatus = (s: unknown): s is AppStatus => typeof s === "string" && STATUSES.includes(s);

/** Every status maps to its XP event, except "saved" (moving back never awards or removes XP). */
export const STATUS_EVENT = { applied: "applied", interview: "interview", rejected: "rejected", offer: "offer" } as const;

export function groupByStatus<T extends { status: AppStatus }>(cards: T[]): Record<AppStatus, T[]> {
  const out: Record<AppStatus, T[]> = { saved: [], applied: [], interview: [], offer: [], rejected: [] };
  for (const c of cards) out[c.status].push(c);
  return out;
}
