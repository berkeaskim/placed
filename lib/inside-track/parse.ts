export type Person = { name: string; headline: string; url: string };

const PROFILE = /^https:\/\/(?:[a-z]{2,3}\.)?linkedin\.com\/in\/([A-Za-z0-9\-_%]+)\/?$/;
const NAME = /^[\p{L}][\p{L}'’.\-]*(?: [\p{L}][\p{L}'’.\-]*){1,3}$/u;
const SUFFIX = /\s+(bank|ltd|limited|group|plc|inc)\.?$/i;
const HONORIFIC = /^(dr|mr|mrs|ms|miss|prof)\.?\s+/i;
/** A snippet can name the company for other reasons (a certificate, a past job, plain prose); only distinctive names may rely on it. */
const COMMON = new Set(["wise", "next", "arm", "three", "bloomberg", "apple", "amazon", "meta", "square", "block", "ocado", "sky", "shell", "bp", "virgin"]);

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** True when the company (or its name without a Bank/Ltd/Group suffix) appears as whole words in the text. */
export function companyMatches(text: string, company: string): boolean {
  const t = norm(text), full = norm(company), core = full.replace(SUFFIX, "");
  return [full, core].some((c) => c.length >= 2 && new RegExp(`(^|[^\\p{L}\\p{N}])${escape(c)}([^\\p{L}\\p{N}]|$)`, "u").test(t));
}

/** One Google result → a person, or null. The name is always a substring of the title; nothing is inferred. */
export function parseResult(r: { title?: string; link?: string; snippet?: string }, company: string): Person | null {
  const m = PROFILE.exec(r.link ?? "");
  if (!m) return null;
  const title = (r.title ?? "").replace(/\s*[|\-–—]\s*LinkedIn\s*$/i, "").trim();
  const parts = title.split(/\s+[-–—]\s+/).map((p) => p.trim()).filter(Boolean);
  const name = (parts[0] ?? "").replace(HONORIFIC, "").replace(/\s*\([^)]*\)\s*/g, " ").trim();
  const co = norm(company), core = co.replace(SUFFIX, "");
  if (!NAME.test(name) || name.length > 60 || norm(name) === co || norm(name) === core) return null;
  const headline = parts.slice(1).join(" ");
  const snippetOk = core.length >= 5 && !COMMON.has(core);
  if (!companyMatches(headline, company) && !(snippetOk && companyMatches(r.snippet ?? "", company))) return null;
  const shown = parts.slice(1).join(" · ").replace(/[\p{Extended_Pictographic}\uFE0F]/gu, "").replace(/\s*(\.\.\.|…)\s*$/, "").replace(/\s+/g, " ").trim();
  return { name, headline: shown, url: `https://www.linkedin.com/in/${m[1]}` };
}
