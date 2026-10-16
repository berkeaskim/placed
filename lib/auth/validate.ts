/** Input rules shared by /login and /save. Pure, so tests cover them directly. */
export const PASSWORD_MIN = 8;
/** Supabase hashes with bcrypt, which silently ignores bytes past 72: refuse longer instead of truncating. */
export const PASSWORD_MAX_BYTES = 72;
const EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/;

export function normalizeEmail(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

export function passwordProblem(pw: unknown): string | null {
  if (typeof pw !== "string" || pw.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters for your password.`;
  if (Buffer.byteLength(pw, "utf8") > PASSWORD_MAX_BYTES) return `Use at most ${PASSWORD_MAX_BYTES} characters for your password.`;
  return null;
}
