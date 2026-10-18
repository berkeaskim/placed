/**
 * CL-21 "another employer named" (audit 2026-10-18 09 #2). The real cause of a wrong company in a letter is copy-paste
 * from the student's previous letter, so the names that matter most are the other companies in their own tracker and
 * letters. Research rivals are added when there are any, and a static list of UK graduate employers covers the rest,
 * so the check works with no web research key at all (the local-first default).
 */
import { extractSkills } from "@/lib/skills/extract";
import { KNOWN_EMPLOYERS } from "@/lib/verify/tailoring";

/** Big UK graduate employers from the gate's list. Names that are ordinary words (Next, Wise, Apple) or tools (Bloomberg, Tableau) are left out. */
export const STATIC_EMPLOYERS: string[] = KNOWN_EMPLOYERS
  .filter((k) => !k.caseSensitive && extractSkills(k.name).length === 0)
  .flatMap((k) => [k.name, ...(k.aliases ?? []).filter((a) => a.length >= 4 && extractSkills(a).length === 0)]);

const norm = (s: string) => s.toLowerCase().replace(/[.,'’]/g, "").replace(/\b(?:plc|ltd|llc|inc|llp|limited|group|holdings|the|& co|and co|co)\b/g, " ").replace(/\s+/g, " ").trim();

/**
 * Extra names the cover-letter opening check accepts (audit 09#7) on top of the gate's KNOWN_EMPLOYERS aliases.
 * Kept here, not in the gate's list, because short forms like "JPMorganChase" only matter for naming the target firm.
 */
const EXTRA_ALIASES: Record<string, string[]> = {
  JPMorgan: ["JPMorganChase", "JPMorgan Chase & Co", "J.P. Morgan Chase"],
  PwC: ["Price Waterhouse Coopers"],
  "Bank of America": ["BofA Securities", "Bank of America Merrill Lynch"],
  McKinsey: ["McKinsey and Company"],
  "Goldman Sachs": ["Goldman Sachs International"],
};
const allNames = (e: { name: string; aliases?: string[] }) => [e.name, ...(e.aliases ?? []), ...(EXTRA_ALIASES[e.name] ?? [])];

/** Every name a company goes by (its known aliases too): "JPMorgan Chase & Co." → JPMorgan, J.P. Morgan, JPMC… */
export function companyNames(company: string): string[] {
  const n = norm(company);
  const k = KNOWN_EMPLOYERS.find((e) => allNames(e).some((a) => { const x = norm(a); return x === n || n.startsWith(`${x} `) || n.endsWith(` ${x}`); }));
  return [company, ...(k ? allNames(k) : [])];
}

/** Lowercase word tokens: possessives and dots dropped ("J.P." → "jp", "Monzo's" → "monzo"), "&" → "and", legal suffixes removed. */
const tokens = (s: string) => s.toLowerCase().replace(/['’]s\b/g, "").replace(/[.'’]/g, "").replace(/&/g, " and ")
  .replace(/[^a-z0-9]+/g, " ").replace(/\b(?:plc|ltd|llc|inc|llp|limited|group|holdings|the)\b/g, " ").replace(/\s+/g, " ").trim();

/**
 * True when `text` names `company` by any of its names, as whole words. "J.P. Morgan", "JPMorgan" and "JPMorganChase"
 * all name "JPMorgan Chase & Co."; "PwC" names "PricewaterhouseCoopers LLP"; "they" never names "EY".
 */
export function namesCompany(text: string, company: string): boolean {
  const hay = ` ${tokens(text)} `;
  return companyNames(company).some((name) => {
    const t = tokens(name);
    if (!t) return false;
    return hay.includes(` ${t} `) || hay.includes(` ${t.replace(/ /g, "")} `);
  });
}

/**
 * Names that must not appear in a letter for `company`: tracked companies, other letters' companies, research rivals
 * and the static list, minus the company itself (and its aliases), the student's own past organisations, and any
 * name the job advert itself uses.
 */
export function otherEmployerNames(i: { company: string; cvOrgs: string[]; jdLines: string[]; rivals: string[]; tracked: string[] }): string[] {
  const own = companyNames(i.company).map(norm);
  const past = i.cvOrgs.map(norm).filter(Boolean);
  const jd = norm(i.jdLines.join(" "));
  const keep = (name: string) => {
    const n = norm(name);
    if (n.length < 2) return false;
    if (own.some((o) => o === n || o.includes(n) || n.includes(o))) return false;
    if (past.some((p) => p === n || p.includes(n) || n.includes(p))) return false;
    return !` ${jd} `.includes(` ${n} `);
  };
  return [...new Set([...i.tracked, ...i.rivals, ...STATIC_EMPLOYERS].map((s) => s.trim()))].filter(keep);
}
