export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** First email address in free text (CV header). Non-global so `.match` returns the first hit. */
export const EMAIL_RE = /[\w.+-]+@[\w-]+\.[\w.-]+/;
/** Phone number: optional +, at least 10 digits allowing spaces, brackets and dashes. */
export const PHONE_RE = /(\+?\d[\d\s()-]{8,}\d)/;
