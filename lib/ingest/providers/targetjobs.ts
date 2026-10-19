import type { RawJob } from "@/lib/types";
import { defaultSleep, getJson } from "./http";
import { KNOWN_EMPLOYERS } from "@/lib/verify/employers";

/**
 * TargetJobs (GTI) opportunity search: one listing of placements across ~200 UK employers, many of which have no
 * board Placed reads directly (Savills, MBDA, Cummins, Enterprise, BAE, Grant Thornton, RSM…).
 * research/placement-year/01-aggregators.md §1: unauthenticated JSON POST, robots allows it; the GTI terms only ban
 * commercial reproduction, so this runs locally for the one user and is never redistributed.
 * The search silently returns 0 results without browser Origin/Referer headers.
 */

export const TARGETJOBS_URL = "https://targetjobs.co.uk/ext/svc/inferno-search-service-1-0/search";
const SITE = "https://targetjobs.co.uk";
const PAGE = 100;
const DELAY_MS = 1_500;

/** Seed slug → TargetJobs opportunity type. */
const OPPORTUNITY_TYPES: Record<string, { type: string; sourceType: NonNullable<RawJob["sourceType"]> }> = {
  placement: { type: "Placement", sourceType: "placement" },
};

export type TjDoc = {
  nid: string; title: string; path: string; body?: string | null; location?: string | null;
  organisation?: { title?: string | null } | null; applicationUrl?: string | null; applicationDeadline?: string | number | null;
  applicationOpen?: boolean | null; scrapedJob?: boolean | null;
};
type TjPage = { search?: { result_count?: number; documents?: TjDoc[] } };

const FIELDS = ["nid", "uuid", "title", "parent_organisation_title", "type", "url", "application_url", "application_deadline_date",
  "opportunity_start_date", "salary_range", "location", "degree_requirements", "opportunity_type", "application_open", "scraped_job", "body", "sectors", "city"];

export function targetjobsQuery(type: string, offset: number, limit: number, nowIso: string) {
  return {
    fields: FIELDS, keys: [""], groupBy: null,
    conditionGroup: {
      conjunction: "AND", groups: [
        { conjunction: "OR", conditions: [{ name: "opportunity_type", value: type, operator: "=" }], tags: ["facet:opportunity_type"] },
        { conjunction: "OR", conditions: [{ name: "application_deadline_date", value: ["0", "NOW"], operator: "NOT BETWEEN" }], tags: ["facet:application_deadline_date"] },
        { conjunction: "OR", conditions: [{ name: "type", value: "opportunity", operator: "=" }], tags: ["facet:type"] },
      ],
    },
    facets: [], sort: [{ field: "application_deadline_date", value: "asc" }],
    conditions: [{ name: "last_published", value: nowIso, operator: "<=" }],
    limit, offset, includePromoted: true,
  };
}

const pageUrl = (path: string) => `${SITE}${path.startsWith("/") ? path : `/${path}`}`;
/** Ad-tracking redirects: the TargetJobs page links on to the employer instead. */
const AD_HOSTS = /(^|\.)(doubleclick\.net|googleadservices\.com|g\.doubleclick\.net)$/i;

/** The employer's application link, cleaned: a URL pasted twice is cut, ad redirects fall back to the TargetJobs page. */
export function cleanApplyUrl(raw: string | null | undefined, path: string): string {
  const s = raw?.trim();
  if (!s) return pageUrl(path);
  const second = s.indexOf("http", 1);
  const first = second > 0 ? s.slice(0, second) : s;
  try {
    const u = new URL(first);
    if (!/^https?:$/.test(u.protocol) || AD_HOSTS.test(u.hostname)) return pageUrl(path);
    return u.toString();
  } catch {
    return pageUrl(path);
  }
}

/** Hosts where the employer is the first label (tenant), and where it is the first path segment. */
const TENANT_HOST = /\.(myworkdayjobs\.com|teamtailor\.com|eightfold\.ai|tal\.net|contacthr\.com|eploy\.net|ciphr-irecruit\.com|pinpointhq\.com|workable\.com|bamboohr\.com|recruitee\.com|applytojob\.com)$/i;
const PATH_HOST = /^(job-boards\.greenhouse\.io|boards\.greenhouse\.io|job-boards\.eu\.greenhouse\.io|boards\.eu\.greenhouse\.io|jobs\.lever\.co|jobs\.ashbyhq\.com|jobs\.smartrecruiters\.com|careers\.smartrecruiters\.com|apply\.workable\.com)$/i;
const GENERIC = /^(www|jobs|careers|career|apply|join|recruitment|talent|work|global|uk|en|gb|portal|hr)$/i;
const SUFFIXES = /(graduates?|careers?|jobs|earlycareers|students?|people|recruitment|talent|apply|uk|site|limited|ltd|plc|web|insurance)+$/i;
/** Oracle Cloud tenants are opaque codes; these are the ones TargetJobs links to most. */
const ORACLE_HOSTS: Record<string, string> = { "fa-espx-saasfaprod1.fa.ocs.oraclecloud.com": "Cummins", "iagtme.fa.ocs.oraclecloud.com": "IAG" };

function nameFromHost(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  const host = u.hostname.toLowerCase();
  if (ORACLE_HOSTS[host]) return ORACLE_HOSTS[host];
  if (/(^|\.)targetjobs\.co\.uk$/.test(host) || /oraclecloud\.com$/.test(host) || /pageuppeople\.com$/.test(host)) return null;
  let token: string | undefined;
  if (TENANT_HOST.test(host)) token = host.split(".")[0];
  else if (PATH_HOST.test(host)) token = u.pathname.split("/").filter(Boolean)[0];
  else token = host.split(".").filter((p) => !GENERIC.test(p)).slice(-2, -1)[0] ?? host.split(".").slice(-2, -1)[0];
  if (!token) return null;
  const core = token.replace(/[-_]+/g, " ").replace(SUFFIXES, "").trim();
  return core.length >= 2 ? core : null;
}

/** ATS tenant codes that aren't the employer's name. */
const TENANT_NAMES: Record<string, string> = {
  pg: "Procter & Gamble", lbg: "Lloyds Banking Group", morganstanley: "Morgan Stanley", ms: "Morgan Stanley", jpmc: "JPMorgan",
  vrtx: "Vertex Pharmaceuticals", mottmacbentley: "Mott MacDonald Bentley", gsk: "GSK", ag: "Airbus", ngc: "Northrop Grumman",
};

const KNOWN_RES = KNOWN_EMPLOYERS.map((k) => ({
  name: k.name,
  re: new RegExp(`(?<![\\p{L}\\p{N}])(${[k.name, ...(k.aliases ?? [])].map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})(?![\\p{L}\\p{N}])`, k.caseSensitive ? "u" : "iu"),
})).sort((a, b) => b.name.length - a.name.length); // "Citadel Securities" before "Citadel"

const knownIn = (text: string) => KNOWN_RES.find((k) => k.re.test(text))?.name ?? null;

/**
 * Employer display name, in order: the organisation field; a known employer named in the title; the application
 * link's tenant (title casing wins); a known employer in the opening of the posting. Null = can't tell.
 */
export function employerFor(d: TjDoc): string | null {
  const org = d.organisation?.title?.trim();
  if (org) return org;
  const fromTitle = knownIn(d.title);
  if (fromTitle) return fromTitle;
  const token = d.applicationUrl ? nameFromHost(cleanApplyUrl(d.applicationUrl, d.path)) : null;
  if (token && TENANT_NAMES[token.toLowerCase()]) return TENANT_NAMES[token.toLowerCase()];
  if (!token) return knownIn((d.body ?? "").replace(/<[^>]+>/g, " ").slice(0, 600));
  if (Object.values(ORACLE_HOSTS).includes(token)) return token;
  // "willmottdixon" / "sellafield": the same letters as a phrase in the title or posting give the real spelling.
  const phrase = phraseFor(token, `${d.title} ${(d.body ?? "").replace(/<[^>]+>/g, " ")}`);
  if (phrase) return phrase;
  if (token.length <= 4) return token.toUpperCase();
  return token.replace(/\b\w/g, (c) => c.toUpperCase());
}

/** A capitalised run of 1–4 words whose letters equal `token` ("Willmott Dixon" for "willmottdixon"), else a word it starts with. */
function phraseFor(token: string, text: string): string | null {
  const want = token.toLowerCase().replace(/[^a-z0-9]/g, "");
  const words = text.match(/[A-Za-z0-9][A-Za-z0-9&'’.-]*/g) ?? [];
  const letters = (ws: string[]) => ws.join("").toLowerCase().replace(/[^a-z0-9]/g, "");
  for (let n = 4; n >= 1; n--) {
    for (let i = 0; i + n <= words.length; i++) {
      const ws = words.slice(i, i + n);
      if (/^[A-Z0-9]/.test(ws[0]) && letters(ws) === want) return ws.join(" ").replace(/[.’']$/, "");
    }
  }
  const prefix = words.find((w) => /^[A-Z]/.test(w) && w.length >= 5 && want.startsWith(w.toLowerCase()));
  return prefix ?? null;
}

function deadlineOf(v: TjDoc["applicationDeadline"]): string | null {
  const n = typeof v === "string" ? Number(v) : v;
  if (!n || !Number.isFinite(n)) return null;
  return new Date(n * 1000).toISOString().slice(0, 10);
}

export function normalizeTargetJobs(d: TjDoc, sourceType: NonNullable<RawJob["sourceType"]> = "placement"): RawJob | null {
  if (!d?.nid || !d.title || !d.path || d.applicationOpen === false) return null;
  return {
    extId: String(d.nid),
    title: d.title.trim(),
    url: cleanApplyUrl(d.applicationUrl, d.path),
    location: d.location?.trim() ?? "",
    remote: false,
    html: d.body ?? "",
    postedAt: null,
    deadline: deadlineOf(d.applicationDeadline),
    employerName: employerFor(d),
    sourceType,
  };
}

/** Every open listing of one opportunity type, a page at a time with a pause between requests. */
export async function fetchTargetJobs(
  slug: string, fetchImpl: typeof fetch = fetch, sleep: (ms: number) => Promise<void> = defaultSleep, pageSize = PAGE,
): Promise<RawJob[]> {
  const t = OPPORTUNITY_TYPES[slug.toLowerCase()];
  if (!t) throw new Error(`targetjobs/${slug}: unknown opportunity type (known: ${Object.keys(OPPORTUNITY_TYPES).join(", ")})`);
  const nowIso = new Date().toISOString();
  const page = (offset: number) => getJson(TARGETJOBS_URL, fetchImpl, {
    method: "POST",
    headers: { origin: SITE, referer: `${SITE}/search/jobs`, "user-agent": "Mozilla/5.0 (Placed; local)" },
    body: JSON.stringify(targetjobsQuery(t.type, offset, pageSize, nowIso)),
  }, sleep) as Promise<TjPage>;

  const first = await page(0);
  const total = first.search?.result_count ?? 0;
  // The search answers a request it doesn't like (no Origin/Referer) with 200 and nothing: never read that as "no jobs".
  if (total === 0) throw new Error(`targetjobs/${slug}: 0 results (request rejected?)`);
  const docs = [...(first.search?.documents ?? [])];
  for (let offset = pageSize; offset < total; offset += pageSize) {
    await sleep(DELAY_MS);
    docs.push(...((await page(offset)).search?.documents ?? []));
  }
  const seen = new Set<string>();
  return docs.map((d) => normalizeTargetJobs(d, t.sourceType)).filter((j): j is RawJob => j !== null && !seen.has(j.extId) && Boolean(seen.add(j.extId)));
}
