/** Shown when neither the stored name nor the job URL tells us the company. */
export const COMPANY_FALLBACK = "Company not listed";

export type CompanyDisplay = { name: string; initial: string; fallback: boolean };

/** Hosts of the ATS boards we ingest from, whose first path segment is the company's board slug. */
const SLUG_HOSTS = /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com)$/;
const WORKDAY_HOST = /^([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com$/;
/** First path segments on those hosts that are routes, not board slugs. */
const NOT_A_SLUG = new Set(["embed", "api", "v0", "v1", "jobs", "job", "boards", "posting-api", "en", "en-us", "en-gb"]);
const SLUG = /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u;

/** "wise-careers" → "Wise Careers"; already-mixed-case slugs ("ElevenLabs") keep their casing. */
function prettySlug(slug: string): string {
  return slug.split(/[-_]+/).filter(Boolean).map((w) => (w === w.toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

function safeDecode(s: string): string | null {
  try { return decodeURIComponent(s); } catch { return null; }
}

/**
 * The board slug from an ATS job URL we ingest (Greenhouse, Lever, Ashby, Workday), else null.
 * Other hosts are not guessed from: a job board or careers domain would too easily show the wrong company.
 */
function nameFromUrl(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  const wd = WORKDAY_HOST.exec(host);
  if (wd) return prettySlug(wd[1]);
  if (!SLUG_HOSTS.test(host)) return null;
  // Greenhouse embed links carry the board in ?for=<slug>.
  const candidates = [u.searchParams.get("for") ?? "", safeDecode(u.pathname.split("/").find(Boolean) ?? "") ?? ""];
  const slug = candidates.find((c) => SLUG.test(c) && !NOT_A_SLUG.has(c.toLowerCase()));
  return slug ? prettySlug(slug) : null;
}

function initialOf(name: string): string {
  const ch = name.match(/[\p{L}\p{N}]/u)?.[0];
  return ch ? ch.toLocaleUpperCase("en-GB") : "?";
}

/**
 * The company name to show on a job: the stored name, else the board slug from the job's ATS URL,
 * else {@link COMPANY_FALLBACK}.
 */
export function companyDisplay(job: { company?: string | null; url?: string | null }): CompanyDisplay {
  const stored = job.company?.trim();
  if (stored) return { name: stored, initial: initialOf(stored), fallback: false };
  const guessed = job.url ? nameFromUrl(job.url) : null;
  if (guessed) return { name: guessed, initial: initialOf(guessed), fallback: true };
  return { name: COMPANY_FALLBACK, initial: "?", fallback: true };
}
