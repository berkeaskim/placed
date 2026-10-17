import { readFile } from "node:fs/promises";
import path from "node:path";
import { unstable_cache } from "next/cache";
import { divisionKeyword } from "@/lib/outreach/targets";
import { shortSchool } from "@/lib/profile/school-name";
import { getSecret } from "@/lib/settings/store";
import { parseResult, type Person } from "./parse";
import { GROUPS, type Found, type Group } from "./types";

export type Hit = { title?: string; link?: string; snippet?: string };
export type SearchFn = (q: string) => Promise<Hit[]>;

const CAP: Record<Group, number> = { alumni: 2, team: 2, recruiter: 1 };
/** Settings → People search saves the key here; SERPER_API_KEY in the environment wins. */
export const SERPER_SECRET = "search.serper.key";
const quote = (s: string) => `"${s.replace(/"/g, "").replace(/\s+/g, " ").trim()}"`;
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Names a result may use for the student's university: the full name, plus its acronym ("UCL", "LSE") when it has one.
 * Place-name short forms ("Manchester", "Oxford") are left out: a snippet saying "Manchester" is usually a location.
 */
export function schoolNames(school: string): string[] {
  const full = school.replace(/["()]/g, "").replace(/\s+/g, " ").trim();
  const short = shortSchool(full);
  return short !== full && /^[A-Z]{2,5}$/.test(short) ? [full, short] : [full];
}

/** "<University> alumni" is a claim: the result itself has to name the university, not just match a query that asked for it. */
const mentions = (text: string, names: string[]) =>
  names.some((n) => new RegExp(`(^|[^\\p{L}\\p{N}])${escape(n)}([^\\p{L}\\p{N}]|$)`, n === n.toUpperCase() ? "u" : "iu").test(text));

export function groupQuery(group: Group, company: string, jobTitle: string, school?: string | null): string | null {
  const c = `site:linkedin.com/in ${quote(company)}`;
  if (group === "alumni") {
    if (!school) return null;
    const names = schoolNames(school);
    return `${c} ${names.length > 1 ? `(${names.map((n, i) => (i ? n : quote(n))).join(" OR ")})` : quote(names[0])}`;
  }
  if (group === "recruiter") return `${c} ("early careers" OR "talent acquisition" OR "graduate recruitment" OR recruiter)`;
  const div = divisionKeyword(jobTitle);
  return div ? `${c} ${div}` : null;
}

/** Env first, then the key saved in Settings. Read per call, so a key saved in the UI applies without a restart. */
export function serperKey(): string | null {
  const fromEnv = process.env.SERPER_API_KEY?.trim();
  if (fromEnv) return fromEnv;
  try {
    return getSecret(SERPER_SECRET);
  } catch {
    return null;
  }
}

async function serper(q: string, key: string): Promise<Hit[]> {
  const res = await fetch("https://google.serper.dev/search", {
    method: "POST", headers: { "X-API-KEY": key, "Content-Type": "application/json" },
    body: JSON.stringify({ q, gl: "uk", hl: "en", num: 10 }), signal: AbortSignal.timeout(8000), cache: "no-store",
  });
  if (!res.ok) throw new Error(`serper ${res.status}`);
  const j = (await res.json()) as { organic?: Hit[] };
  // Throwing keeps an odd or empty answer out of the 7-day cache; the group then falls back to the LinkedIn search link.
  if (!Array.isArray(j.organic) || j.organic.length === 0) throw new Error("serper: no organic results");
  return j.organic.map(({ title, link, snippet }) => ({ title, link, snippet }));
}

/** Uncached search for callers that keep their own cache (cover-letter research caches in company_research). */
export const serperSearch = (key: string): SearchFn => (q) => serper(q, key);

/** Errors throw out of the cached function, so only successful searches are cached (7 days, shared by all users). */
const cachedSerper = (q: string, key: string) => unstable_cache(() => serper(q, key), ["inside-track", "v1", q], { revalidate: 604800 })();

async function fixture(company: string): Promise<Partial<Record<Group, Hit[]>> | null> {
  try {
    return JSON.parse(await readFile(path.join(process.cwd(), "fixtures/inside-track", `${slug(company)}.json`), "utf8"));
  } catch {
    return null;
  }
}

const empty = (): Record<Group, Person[]> => ({ alumni: [], team: [], recruiter: [] });

/**
 * Up to 2/2/1 real people per group. Names come only from search-result titles; a failed group stays empty.
 * `school` is the student's university; without it there is no alumni search.
 */
export async function findPeople(company: string, jobTitle: string, school: string | null, search?: SearchFn): Promise<Found> {
  let run: (g: Group, q: string) => Promise<Hit[]>;
  const key = process.env.AI_MODE === "fixture" ? null : serperKey();
  if (search) run = (_g, q) => search(q);
  else if (key) run = (_g, q) => cachedSerper(q, key);
  else {
    const fx = await fixture(company);
    if (!fx) return { groups: empty(), searched: false };
    run = async (g) => fx[g] ?? [];
  }
  const raw = await Promise.all(GROUPS.map(async (g) => {
    const q = groupQuery(g, company, jobTitle, school);
    if (!q) return [] as Hit[];
    try { return await run(g, q); } catch { return [] as Hit[]; }
  }));
  const seen = new Set<string>(), groups = empty(), names = school ? schoolNames(school) : [];
  GROUPS.forEach((g, i) => {
    for (const h of raw[i]) {
      if (groups[g].length >= CAP[g]) break;
      if (g === "alumni" && !mentions(`${h.title ?? ""} ${h.snippet ?? ""}`, names)) continue;
      const p = parseResult(h, company);
      if (p && !seen.has(p.url)) { seen.add(p.url); groups[g].push(p); }
    }
  });
  return { groups, searched: true };
}
