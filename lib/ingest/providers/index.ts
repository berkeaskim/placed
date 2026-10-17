import type { RawJob } from "@/lib/types";
import { normalizeGreenhouse } from "./greenhouse";
import { normalizeLever } from "./lever";
import { normalizeAshby } from "./ashby";
import { fetchWorkday, workdayBase } from "./workday";
import { fetchSmartRecruiters, srPostingsUrl } from "./smartrecruiters";
import { fetchOracle, oracleListUrl } from "./oracle";
import type { AtsKind } from "@/lib/db/schema";
import { passesTitleFilter } from "../filter";
import { loadProgrammes, programmeToRawJob, visibleProgrammes } from "../curated";
import { todayLondon } from "@/lib/scoring/dates";
import { readFileSync } from "node:fs";

export { normalizeGreenhouse, normalizeLever, normalizeAshby };

export type Ats = AtsKind;
export type CompanySeed = { slug: string; name: string; ats: Ats; apiHost?: string | null; employer?: string | null; transport?: "stealth" | null };

export class ProviderError extends Error {}

const PROGRAMMES_PATH_LABEL = "file:seed/programmes.yml";

/** Curated programmes live in a local file, not behind an endpoint. PLACED_PROGRAMMES_FILE overrides the path (tests). */
function fetchCurated(slug: string): RawJob[] {
  const file = process.env.PLACED_PROGRAMMES_FILE || "seed/programmes.yml";
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (e) {
    throw new ProviderError(`curated/${slug}: cannot read ${file} (${(e as Error).message})`);
  }
  return visibleProgrammes(loadProgrammes(text), todayLondon()).filter((p) => p.employer === slug).map(programmeToRawJob);
}

export function endpointFor(c: CompanySeed): string {
  switch (c.ats) {
    case "greenhouse":
      return `https://${c.apiHost ?? "boards-api.greenhouse.io"}/v1/boards/${c.slug}/jobs?content=true`;
    case "lever":
      return `https://${c.apiHost ?? "api.lever.co"}/v0/postings/${c.slug}?mode=json`;
    case "ashby":
      return `https://api.ashbyhq.com/posting-api/job-board/${c.slug}?includeCompensation=true`;
    case "workday":
      if (!c.apiHost) throw new ProviderError(`workday/${c.slug}: apiHost ({tenant}.wdN.myworkdayjobs.com) is required`);
      return `${workdayBase(c.slug, c.apiHost)}/jobs`;
    case "smartrecruiters":
      return srPostingsUrl(c.slug);
    case "oracle":
      if (!c.apiHost) throw new ProviderError(`oracle/${c.slug}: apiHost ({tenant}.fa.{region}.oraclecloud.com) is required`);
      return oracleListUrl(c.slug, c.apiHost, 0);
    case "curated":
      return PROGRAMMES_PATH_LABEL;
    case "amazon":
      throw new ProviderError(`${c.ats}/${c.slug}: provider not implemented yet`);
  }
}

export async function fetchJobs(c: CompanySeed, fetchImpl: typeof fetch = fetch): Promise<RawJob[]> {
  if (c.ats === "curated") return fetchCurated(c.slug);
  const url = endpointFor(c);
  if (c.ats === "workday") {
    // Paged list + per-posting detail; the title filter runs before detail calls to keep request count low.
    try {
      return (await fetchWorkday(c.slug, c.apiHost as string, passesTitleFilter, fetchImpl)).jobs;
    } catch (e) {
      throw new ProviderError(`workday/${c.slug}: ${(e as Error).message}`);
    }
  }
  if (c.ats === "smartrecruiters") {
    // The list has no descriptions; details are fetched only for titles that pass, as for Workday.
    try {
      return (await fetchSmartRecruiters(c.slug, passesTitleFilter, fetchImpl)).jobs;
    } catch (e) {
      throw new ProviderError(`smartrecruiters/${c.slug}: ${(e as Error).message}`);
    }
  }
  if (c.ats === "oracle") {
    try {
      return (await fetchOracle(c.slug, c.apiHost as string, passesTitleFilter, fetchImpl)).jobs;
    } catch (e) {
      throw new ProviderError(`oracle/${c.slug}: ${(e as Error).message}`);
    }
  }
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
