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

/** Every name a company goes by (its known aliases too): "JPMorgan Chase & Co." → JPMorgan, J.P. Morgan, JPMC… */
export function companyNames(company: string): string[] {
  const n = norm(company);
  const k = KNOWN_EMPLOYERS.find((e) => [e.name, ...(e.aliases ?? [])].some((a) => { const x = norm(a); return x === n || n.startsWith(`${x} `) || n.endsWith(` ${x}`); }));
  return [company, ...(k ? [k.name, ...(k.aliases ?? [])] : [])];
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
