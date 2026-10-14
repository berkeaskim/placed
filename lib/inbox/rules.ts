import type { AppStatus } from "@/lib/types";
import type { AppRef, Classification, InboxEffect, InboxKind } from "./types";

/** Below this the model's answer is shown as a suggestion, never applied (spec §2.3). */
export const AUTO_MOVE_MIN_CONFIDENCE = 0.7;

const RANK: Record<Exclude<AppStatus, "rejected">, number> = { saved: 0, applied: 1, interview: 2, offer: 3 };
const KIND_STATUS: Record<InboxKind, AppStatus | null> = {
  received: "applied", assessment: "applied", interview: "interview", offer: "offer", rejection: "rejected", other: null,
};

/**
 * Where an email of `kind` takes an application now at `current`, or null. Forward only; rejection is reachable from
 * any live status (an offer can be rescinded); a rejected application is never revived by a later email.
 */
export function targetStatus(current: AppStatus, kind: InboxKind): AppStatus | null {
  const next = KIND_STATUS[kind];
  if (!next || current === "rejected") return null;
  if (next === "rejected") return "rejected";
  return RANK[next as keyof typeof RANK] > RANK[current] ? next : null;
}

export type Decision =
  | { effect: "moved"; to: AppStatus }
  | { effect: "suggested"; reason: "low_confidence" | "unmatched" | "ambiguous" }
  | { effect: "none" };

export function decide(c: Classification, app: AppRef | null, ambiguous: boolean): Decision {
  if (c.kind === "other") return { effect: "none" };
  if (!app) return c.company || ambiguous ? { effect: "suggested", reason: ambiguous ? "ambiguous" : "unmatched" } : { effect: "none" };
  // No forward move exists: nothing to review, however unsure the model was.
  const to = targetStatus(app.status, c.kind);
  if (!to) return { effect: "none" };
  return c.confidence < AUTO_MOVE_MIN_CONFIDENCE ? { effect: "suggested", reason: "low_confidence" } : { effect: "moved", to };
}

/** Undo restores prev_status only if nothing has moved the card since (spec §2.3). */
export function canUndo(e: { effect: InboxEffect; new_status: AppStatus | null }, current: AppStatus): boolean {
  return e.effect === "moved" && e.new_status === current;
}

/** Earliest deadline on or after `today` (all YYYY-MM-DD, so string order is date order). */
export function nextDeadline(deadlines: (string | null)[], today: string): string | null {
  const future = deadlines.filter((d): d is string => !!d && d >= today).sort();
  return future[0] ?? null;
}
