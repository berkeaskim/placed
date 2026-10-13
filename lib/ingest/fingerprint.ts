import { createHash } from "node:crypto";

const TRACKING = /^(utm_|gh_src|gh_jid|lever-|source|ref|src)/i;

export function normalizeUrl(url: string): string {
  const u = new URL(url);
  u.hash = "";
  u.hostname = u.hostname.toLowerCase();
  for (const key of [...u.searchParams.keys()]) if (TRACKING.test(key)) u.searchParams.delete(key);
  const out = u.toString().replace(/\?$/, "");
  return out.endsWith("/") ? out.slice(0, -1) : out;
}

function norm(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function jobFingerprint(companySlug: string, title: string, location: string): string {
  return createHash("sha1").update(`${norm(companySlug)}|${norm(title)}|${norm(location)}`).digest("hex").slice(0, 16);
}

export function contentHash(text: string): string {
  return createHash("sha1").update(text).digest("hex");
}
