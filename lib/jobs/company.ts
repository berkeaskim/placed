/** Shown when neither the stored name nor the job URL tells us the company. */
export const COMPANY_FALLBACK = "Company not listed";

export type CompanyDisplay = { name: string; initial: string; fallback: boolean };

/** ATS hosts whose first path segment is the company's board slug. */
const SLUG_HOSTS = /(^|\.)(greenhouse\.io|lever\.co|ashbyhq\.com)$/;
const WORKDAY_HOST = /^([a-z0-9-]+)\.wd\d+\.myworkdayjobs\.com$/;
/** Leading host labels that are never the brand ("careers.monzo.com" → "monzo"). */
const GENERIC_LABELS = new Set(["www", "careers", "career", "jobs", "job", "apply", "boards", "join", "work"]);
/** Second-level labels under a country TLD ("revolut.co.uk"). */
const SECOND_LEVEL = new Set(["co", "com", "org", "net", "ac", "gov"]);

/** "wise-careers" → "Wise Careers"; already-mixed-case slugs ("ElevenLabs") keep their casing. */
function prettySlug(slug: string): string {
  return slug.split(/[-_]+/).filter(Boolean).map((w) => (w === w.toLowerCase() ? w[0].toUpperCase() + w.slice(1) : w)).join(" ");
}

function nameFromUrl(url: string): string | null {
  let u: URL;
  try { u = new URL(url); } catch { return null; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  const wd = WORKDAY_HOST.exec(host);
  if (wd) return prettySlug(wd[1]);
  if (SLUG_HOSTS.test(host)) {
    const slug = decodeURIComponent(u.pathname.split("/").find(Boolean) ?? "");
    return /^[\p{L}\p{N}][\p{L}\p{N}_-]*$/u.test(slug) ? prettySlug(slug) : null;
  }
  const labels = host.split(".");
  if (labels.length < 2) return null;
  labels.pop(); // TLD
  if (labels.length > 1 && SECOND_LEVEL.has(labels[labels.length - 1])) labels.pop();
  const brand = labels.reverse().find((l) => !GENERIC_LABELS.has(l));
  return brand ? prettySlug(brand) : null;
}

function initialOf(name: string): string {
  const ch = name.match(/[\p{L}\p{N}]/u)?.[0];
  return ch ? ch.toLocaleUpperCase("en-GB") : "?";
}

/**
 * The company name to show on a job: the stored name, else a best guess from the job URL
 * (ATS board slug or the company's own careers domain), else {@link COMPANY_FALLBACK}.
 */
export function companyDisplay(job: { company?: string | null; url?: string | null }): CompanyDisplay {
  const stored = job.company?.trim();
  if (stored) return { name: stored, initial: initialOf(stored), fallback: false };
  const guessed = job.url ? nameFromUrl(job.url) : null;
  if (guessed) return { name: guessed, initial: initialOf(guessed), fallback: true };
  return { name: COMPANY_FALLBACK, initial: "?", fallback: true };
}
