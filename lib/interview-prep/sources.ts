import { z } from "zod";
import type { GroundedChunk } from "@/lib/ai/provider";
import { safeHttpUrl } from "@/lib/text/url";

export const PrepCategory = z.enum(["behavioural", "technical", "motivational", "case"]);
export const PrepStage = z.object({ stage: z.string(), note: z.string() });

/** What the structure call returns: sources only by index into the list we gave it, never as URLs. */
export const PrepModelOutput = z.object({
  process: z.array(PrepStage).max(8),
  questions: z.array(z.object({
    question: z.string(), category: PrepCategory, reported: z.boolean(), sourceIndex: z.number().int().nullable(),
    whyTheyAsk: z.string(), prepTip: z.string(),
  })).max(15),
  tips: z.array(z.string()).max(5),
});
export const PrepQuestion = z.object({
  question: z.string(), category: PrepCategory, reported: z.boolean(), sourceUrl: z.string().nullable(),
  whyTheyAsk: z.string(), prepTip: z.string(),
});
export const PrepPack = z.object({ process: z.array(PrepStage), questions: z.array(PrepQuestion), tips: z.array(z.string()) });
export const PrepSource = z.object({ url: z.string(), title: z.string() });

export type PrepModelOutputT = z.infer<typeof PrepModelOutput>;
export type PrepQuestionT = z.infer<typeof PrepQuestion>;
export type PrepPackT = z.infer<typeof PrepPack>;
export type PrepSourceT = z.infer<typeof PrepSource>;

const MAX_SOURCES = 12;
const RESOLVE_TIMEOUT_MS = 4000;
const REDIRECT_HOST = "vertexaisearch.cloud.google.com";

/** Cache key: the job's role family. Reuses the tagger's archetype, so no new normalisation. */
export const roleKey = (job: { archetype: string | null; employmentType: string }) => `${job.archetype ?? "general"}:${job.employmentType}`;

async function resolveOne(c: GroundedChunk, fetchImpl: typeof fetch): Promise<PrepSourceT | null> {
  let host: string;
  try { host = new URL(c.uri).hostname; } catch { return null; }
  if (host !== REDIRECT_HOST) {
    const direct = safeHttpUrl(c.uri);
    return direct ? { url: direct, title: c.title || host } : null;
  }
  try {
    const res = await fetchImpl(c.uri, { method: "HEAD", redirect: "manual", signal: AbortSignal.timeout(RESOLVE_TIMEOUT_MS) });
    const url = safeHttpUrl(res.headers.get("location"));
    return url ? { url, title: c.title || new URL(url).hostname } : null;
  } catch {
    return null;
  }
}

/** Grounding chunk links are Google redirects; resolve each to the real page so links are readable and do not expire. */
export async function resolveSources(chunks: GroundedChunk[], fetchImpl: typeof fetch = fetch): Promise<PrepSourceT[]> {
  const resolved = await Promise.all(chunks.slice(0, MAX_SOURCES).map((c) => resolveOne(c, fetchImpl)));
  const seen = new Set<string>();
  return resolved.filter((s): s is PrepSourceT => s !== null && !seen.has(s.url) && (seen.add(s.url), true));
}

/** Only a question the model marks reported, with an index into our resolved list, gets a link. */
export function attachSources(raw: PrepModelOutputT, sources: PrepSourceT[], grounded: boolean): PrepPackT {
  return {
    process: raw.process,
    tips: raw.tips,
    questions: raw.questions.map(({ sourceIndex, reported, ...q }) => {
      const src = grounded && reported && sourceIndex !== null && sourceIndex >= 0 ? sources[sourceIndex] : undefined;
      return { ...q, reported: Boolean(src), sourceUrl: src?.url ?? null };
    }),
  };
}
