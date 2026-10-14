import type { AppRef, Classification, RawEmail } from "./types";

const SUFFIX = /\b(?:ltd|limited|llp|plc|inc|llc|corp|corporation|gmbh|holdings?|group)\b/g;

export function normalizeCompany(s: string): string {
  return s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").replace(SUFFIX, " ").replace(/\s+/g, " ").trim();
}

/** Equal after normalising, or one is a whole-word run inside the other ("IMC" ⊂ "IMC Trading"). */
export function companyMatches(a: string, b: string): boolean {
  const x = normalizeCompany(a), y = normalizeCompany(b);
  if (!x || !y) return false;
  return x === y || ` ${x} `.includes(` ${y} `) || ` ${y} `.includes(` ${x} `);
}

const tokens = (s: string) => new Set(normalizeCompany(s).split(" ").filter((t) => t.length > 2));

/** Pick the one application among same-company candidates whose title shares the most words with the role hint. */
function byRole(cands: AppRef[], roleHint: string | null): AppRef | null {
  if (!roleHint) return null;
  const hint = tokens(roleHint);
  const scored = cands.map((a) => ({ a, n: [...tokens(a.title)].filter((t) => hint.has(t)).length })).sort((p, q) => q.n - p.n);
  return scored[0].n > 0 && scored[0].n > (scored[1]?.n ?? 0) ? scored[0].a : null;
}

/**
 * The application an email is about. The model's company comes first; without one, the sender and subject are
 * searched for tracked company names. Two different tracked companies in that text, or two same-company
 * applications the role hint can't separate, is ambiguous: better a suggestion than a wrong move.
 */
export function matchApplication(c: Classification, email: RawEmail, apps: AppRef[]): { app: AppRef | null; ambiguous: boolean } {
  let cands: AppRef[];
  if (c.company) cands = apps.filter((a) => companyMatches(c.company!, a.company));
  else {
    const hay = ` ${normalizeCompany(`${email.from} ${email.subject}`)} `;
    cands = apps.filter((a) => { const n = normalizeCompany(a.company); return n !== "" && hay.includes(` ${n} `); });
  }
  if (cands.length === 0) return { app: null, ambiguous: false };
  const companies = new Set(cands.map((a) => normalizeCompany(a.company)));
  if (companies.size > 1) return { app: null, ambiguous: true };
  if (cands.length === 1) return { app: cands[0], ambiguous: false };
  const picked = byRole(cands, c.roleHint);
  return picked ? { app: picked, ambiguous: false } : { app: null, ambiguous: true };
}
