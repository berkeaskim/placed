import { AiError } from "@/lib/ai/provider";
import type { PrepResultT, StoryT } from "@/lib/ai/interviewPrep";

export const FRESH_DAYS = 14;
export const DAILY_CAP = 10;
const DAY_MS = 86_400_000;

export type CachedPrep = PrepResultT & { createdAt: string };
export type PrepView = PrepResultT & { stories: StoryT[]; createdAt: string; cached: boolean };
export type PrepDeps = {
  readCache(): Promise<CachedPrep | null>;
  countRecent(sinceIso: string): Promise<number>;
  writeCache(r: PrepResultT, createdAt: string): Promise<void>;
  generate(): Promise<PrepResultT>;
  stories(r: PrepResultT): Promise<StoryT[]>;
  now(): Date;
};

const FAILED = "We couldn't build your interview prep right now. Try again in a moment.";

/** Shared pack from cache when fresh, otherwise generated (capped per user per day) and cached; stories are always per student. */
export async function getOrCreatePrep(d: PrepDeps): Promise<PrepView | { error: string }> {
  try {
    const now = d.now();
    const hit = await d.readCache();
    if (hit && now.getTime() - new Date(hit.createdAt).getTime() < FRESH_DAYS * DAY_MS) {
      const { createdAt, ...r } = hit;
      return { ...r, createdAt, cached: true, stories: await d.stories(r) };
    }
    if ((await d.countRecent(new Date(now.getTime() - DAY_MS).toISOString())) >= DAILY_CAP) {
      return { error: `You've built ${DAILY_CAP} new prep packs today. Packs other students already built still open, and you can build more tomorrow.` };
    }
    const r = await d.generate();
    const createdAt = now.toISOString();
    try {
      await d.writeCache(r, createdAt);
    } catch (e) {
      console.error("interview prep: cache write failed", e instanceof Error ? e.message : e);
    }
    return { ...r, createdAt, cached: false, stories: await d.stories(r) };
  } catch (e) {
    return { error: e instanceof AiError ? e.message : FAILED };
  }
}
