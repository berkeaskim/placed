import type { AppStatus } from "@/lib/types";
import { OTHER } from "./classify";
import { matchApplication } from "./match";
import { decide, type Decision } from "./rules";
import type { AppRef, Classification, RawEmail } from "./types";

export type PlannedEvent = {
  email: RawEmail; c: Classification; appId: string | null; jobId: string | null; decision: Decision; prevStatus: AppStatus | null;
  /** The classifier threw: the caller must not record the message, so the next sync retries it. */
  failed: boolean;
};

export type Classified = Classification & { failed?: true };

/**
 * One email's failure (an AI error, a malformed fixture) must never abort the whole sync: it becomes OTHER, which
 * moves nothing and is flagged `failed` so it is not stored (a transient error must not mark mail seen forever). Logs the message id only, never email content.
 */
export function safeClassify(fn: (e: RawEmail) => Promise<Classification>): (e: RawEmail) => Promise<Classified> {
  return async (e) => {
    try { return await fn(e); } catch (err) {
      console.error("classify failed for message", e.id, err instanceof Error ? err.name : "error");
      return { ...OTHER, failed: true };
    }
  };
}

/**
 * Classifies unseen emails oldest first and applies the rules against a running copy of the board, so "received"
 * then "interview" lands on interview. Pure apart from `classify`; the caller writes the result.
 */
export async function planInboxEvents(d: {
  apps: AppRef[]; emails: RawEmail[]; seen: Set<string>; classify: (e: RawEmail) => Promise<Classified>;
}): Promise<PlannedEvent[]> {
  const board = d.apps.map((a) => ({ ...a }));
  const fresh = d.emails.filter((e) => !d.seen.has(e.id)).sort((a, b) => a.date.localeCompare(b.date));
  const out: PlannedEvent[] = [];
  for (const email of fresh) {
    const { failed, ...c } = await d.classify(email);
    const { app, ambiguous } = matchApplication(c, email, board);
    const decision = decide(c, app, ambiguous);
    const prevStatus = decision.effect === "moved" && app ? app.status : null;
    if (decision.effect === "moved" && app) app.status = decision.to;
    out.push({ email, c, appId: app?.id ?? null, jobId: app?.jobId ?? null, decision, prevStatus, failed: !!failed });
  }
  return out;
}

/** What the claim row says before any move is confirmed: never "moved", so a crash can't leave a log entry without a move. */
export function claimEffect(d: Decision): "none" | "suggested" {
  return d.effect === "suggested" ? "suggested" : "none";
}
