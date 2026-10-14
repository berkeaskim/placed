import type { AppStatus } from "@/lib/types";
import { OTHER, guardClassification } from "./classify";
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

/** Model calls in flight at once during a sync. */
export const CLASSIFY_CONCURRENCY = 6;
/** New emails classified per sync; the rest wait for the next sync. */
export const MAX_NEW_PER_SYNC = 40;

/**
 * The unseen emails this sync handles: the newest `max` (so a fresh interview or offer is never stuck behind a backlog),
 * returned oldest first for the rules pass, plus how many unseen ones are left for the next sync.
 */
export function unseenBatch(emails: RawEmail[], seen: ReadonlySet<string>, max = MAX_NEW_PER_SYNC): { batch: RawEmail[]; remaining: number } {
  const unseen = emails.filter((e) => !seen.has(e.id)).sort((a, b) => a.date.localeCompare(b.date));
  const keep = Math.max(0, max);
  return { batch: unseen.slice(unseen.length - Math.min(keep, unseen.length)), remaining: unseen.length - Math.min(keep, unseen.length) };
}

/** Runs `fn` over `items` with at most `limit` calls in flight; results keep the input order. */
export async function mapLimit<T, R>(items: T[], limit: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Classifies the unseen batch (see unseenBatch) with bounded concurrency, then applies the rules oldest first against a
 * running copy of the board, so "received" then "interview" lands on interview. Pure apart from `classify`; the caller
 * writes the result.
 */
export async function planInboxEvents(d: {
  apps: AppRef[]; emails: RawEmail[]; seen: ReadonlySet<string>; classify: (e: RawEmail) => Promise<Classified>; max?: number;
}): Promise<PlannedEvent[]> {
  const board = d.apps.map((a) => ({ ...a }));
  const { batch } = unseenBatch(d.emails, d.seen, d.max);
  const classified = await mapLimit(batch, CLASSIFY_CONCURRENCY, d.classify);
  const out: PlannedEvent[] = [];
  batch.forEach((email, i) => {
    const { failed, ...c } = classified[i];
    const { app, ambiguous } = matchApplication(c, email, board);
    const decision = decide(c, app, ambiguous);
    const prevStatus = decision.effect === "moved" && app ? app.status : null;
    if (decision.effect === "moved" && app) app.status = decision.to;
    out.push({ email, c, appId: app?.id ?? null, jobId: app?.jobId ?? null, decision, prevStatus, failed: !!failed });
  });
  return out;
}

/**
 * The classifier a sync uses. The demo account always gets its scripted classification (through the same guard as a model
 * answer) and never reaches the model, whatever the AI mode, so the stage demo is deterministic.
 */
export function classifierFor(
  isDemo: boolean, demoById: ReadonlyMap<string, Classification>, live: (e: RawEmail) => Promise<Classification>,
): (e: RawEmail) => Promise<Classification> {
  if (!isDemo) return live;
  return async (e) => {
    const d = demoById.get(e.id);
    if (!d) return OTHER;
    return guardClassification({ kind: d.kind, company: d.company, role_hint: d.roleHint, deadline: d.deadline, action_url: d.actionUrl, confidence: d.confidence }, e);
  };
}

/** What the claim row says before any move is confirmed: never "moved", so a crash can't leave a log entry without a move. */
export function claimEffect(d: Decision): "none" | "suggested" {
  return d.effect === "suggested" ? "suggested" : "none";
}
