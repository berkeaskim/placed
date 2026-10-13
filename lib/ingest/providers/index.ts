import type { RawJob } from "@/lib/types";
import { normalizeGreenhouse } from "./greenhouse";
import { normalizeLever } from "./lever";
import { normalizeAshby } from "./ashby";

export { normalizeGreenhouse, normalizeLever, normalizeAshby };

export type CompanySeed = { slug: string; name: string; ats: "greenhouse" | "lever" | "ashby"; apiHost?: string | null };

export class ProviderError extends Error {}

export function endpointFor(c: CompanySeed): string {
  switch (c.ats) {
    case "greenhouse":
      return `https://${c.apiHost ?? "boards-api.greenhouse.io"}/v1/boards/${c.slug}/jobs?content=true`;
    case "lever":
      return `https://${c.apiHost ?? "api.lever.co"}/v0/postings/${c.slug}?mode=json`;
    case "ashby":
      return `https://api.ashbyhq.com/posting-api/job-board/${c.slug}?includeCompensation=true`;
  }
}

export async function fetchJobs(c: CompanySeed, fetchImpl: typeof fetch = fetch): Promise<RawJob[]> {
  const url = endpointFor(c);
  let res: Response;
  try {
    res = await fetchImpl(url, { signal: AbortSignal.timeout(15_000), headers: { accept: "application/json" } });
  } catch (e) {
    throw new ProviderError(`${c.ats}/${c.slug}: ${(e as Error).message}`);
  }
  if (!res.ok) throw new ProviderError(`${c.ats}/${c.slug}: HTTP ${res.status}`);
  let json: unknown;
  try {
    json = await res.json();
  } catch (e) {
    throw new ProviderError(`${c.ats}/${c.slug}: invalid response body (${(e as Error).message})`);
  }
  if (c.ats === "greenhouse") return normalizeGreenhouse(json, c.slug);
  if (c.ats === "lever") return normalizeLever(json);
  return normalizeAshby(json);
}
