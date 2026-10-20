import { AiError } from "@/lib/ai/provider";
import type { PrepResultT, StoryT } from "@/lib/ai/interviewPrep";
import type { TrackBank } from "./banks";

export const FRESH_DAYS = 14;
/** A pack built without public reports is retried sooner: search coverage changes, and it should not block a sourced one. */
export const UNGROUNDED_FRESH_DAYS = 2;
export const DAILY_CAP = 10;
const DAY_MS = 86_400_000;

export type CachedPrep = PrepResultT & { createdAt: string };
/** `bank`: the curated spring/placement question bank (lib/interview-prep/banks), added by the caller; never cached. */
export type PrepView = PrepResultT & { stories: StoryT[]; createdAt: string; cached: boolean; bank?: TrackBank | null };
export type PrepDeps = {
  /** Cache key `${companyId}:${roleKey}`: concurrent misses for the same key on one instance share one generation. */
  key: string;
  /** false in fixture mode: a recorded pack must never reach (or come from) the shared cache. Defaults to true. */
  cache?: boolean;
  readCache(): Promise<CachedPrep | null>;
  countRecent(sinceIso: string): Promise<number>;
  writeCache(r: PrepResultT, createdAt: string): Promise<void>;
  generate(): Promise<PrepResultT>;
  stories(r: PrepResultT): Promise<StoryT[]>;
  now(): Date;
};

const FAILED = "We couldn't build your interview prep right now. Try again in a moment.";

// Concurrent misses for one company + role on this instance share a generation (no double spend on double clicks).
const inflight = new Map<string, Promise<PrepResultT>>();

/** Shared pack from cache when fresh, otherwise generated (capped per user per day) and cached; stories are always per student. */
export async function getOrCreatePrep(d: PrepDeps): Promise<PrepView | { error: string }> {
  try {
    const now = d.now();
    const cache = d.cache !== false;
    const hit = cache ? await d.readCache() : null;
    const freshMs = (hit?.grounded ? FRESH_DAYS : UNGROUNDED_FRESH_DAYS) * DAY_MS;
    if (hit && now.getTime() - new Date(hit.createdAt).getTime() < freshMs) {
      const { createdAt, ...r } = hit;
      return { ...r, createdAt, cached: true, stories: await d.stories(r) };
    }
    const createdAt = now.toISOString();
    let pending = inflight.get(d.key);
    if (!pending) {
      // Throws (and so refuses) when the count cannot be read: the cap fails closed.
      if (cache && (await d.countRecent(new Date(now.getTime() - DAY_MS).toISOString())) >= DAILY_CAP) {
        return { error: `You've built ${DAILY_CAP} new prep packs today. Packs other students already built still open, and you can build more tomorrow.` };
      }
      // Another request for this key may have started while we counted.
      pending = inflight.get(d.key);
    }
    if (!pending) {
      pending = (async () => {
        const r = await d.generate();
        if (cache) {
          try {
            await d.writeCache(r, createdAt);
          } catch (e) {
            console.error("interview prep: cache write failed", e instanceof Error ? e.message : e);
          }
        }
        return r;
      })();
      inflight.set(d.key, pending);
      pending.finally(() => inflight.delete(d.key)).catch(() => {});
    }
    const r = await pending;
    return { ...r, createdAt, cached: false, stories: await d.stories(r) };
  } catch (e) {
    return { error: e instanceof AiError ? e.message : FAILED };
  }
}
