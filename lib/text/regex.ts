export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * First email address in free text (CV header). Non-global so `.match` returns the first hit.
 * Every part is length-bounded (RFC 5321 limits) and labels exclude ".", so matching is linear —
 * an unbounded local part backtracked quadratically on a long run of word chars with no "@".
 */
export const EMAIL_RE = /[\w.+-]{1,64}@[\w-]{1,63}(?:\.[\w-]{1,63}){1,8}/;
/**
 * Phone number: optional leading "+" or "(", then 10-15 digits separated by short runs of spaces,
 * brackets or dashes. Requiring 10 digits keeps year ranges ("2023 - 2026") out.
 */
export const PHONE_RE = /(?:\+|\()?\d(?:[\s()-]{0,3}\d){9,14}/;
