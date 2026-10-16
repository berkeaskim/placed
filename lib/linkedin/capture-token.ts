import "server-only";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { getSecret, setSecret } from "@/lib/settings/store";
import { ARCHETYPES, YEARS, type Archetype, type Year } from "@/lib/types";

/**
 * Signed, short-lived ticket that lets the Placed extension post the student's own LinkedIn profile (read in their
 * logged-in tab) back to Placed. Stateless: an HMAC over {user, sector, year, nonce, expiry}. Single use is enforced
 * at scoring time by refusing a nonce that already has a saved score (see scoreLinkedInCapture).
 */
export type CaptureClaims = { userId: string; sector: Archetype; year: Year; nonce: string; exp: number };

const TTL_MS = 10 * 60_000;
export const CAPTURE_TOKEN_RE = /^[A-Za-z0-9_-]{20,400}\.[A-Za-z0-9_-]{43}$/;

/** LINKEDIN_CAPTURE_SECRET overrides; otherwise a random local secret, generated on first use and stored sealed in settings. */
function localSecret(): string {
  const have = getSecret("capture.hmac");
  if (have) return have;
  setSecret("capture.hmac", randomBytes(32).toString("base64url"));
  return getSecret("capture.hmac")!;
}

function key(): Buffer {
  const secret = process.env.LINKEDIN_CAPTURE_SECRET || localSecret();
  return createHmac("sha256", secret).update("placed:linkedin-capture:v1").digest();
}
const sign = (body: string) => createHmac("sha256", key()).update(body).digest("base64url");

export function mintCaptureToken(i: { userId: string; sector: Archetype; year: Year }, now = Date.now()): string {
  const claims: CaptureClaims = { ...i, nonce: randomBytes(12).toString("base64url"), exp: now + TTL_MS };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  return `${body}.${sign(body)}`;
}

/** Claims when the token is well-formed, correctly signed and unexpired; otherwise null. */
export function verifyCaptureToken(token: unknown, now = Date.now()): CaptureClaims | null {
  if (typeof token !== "string" || !CAPTURE_TOKEN_RE.test(token)) return null;
  const [body, sig] = token.split(".");
  const want = Buffer.from(sign(body)), got = Buffer.from(sig);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  let c: CaptureClaims;
  try { c = JSON.parse(Buffer.from(body, "base64url").toString("utf8")); } catch { return null; }
  if (typeof c?.userId !== "string" || typeof c.nonce !== "string" || typeof c.exp !== "number") return null;
  if (!(ARCHETYPES as readonly string[]).includes(c.sector) || !(YEARS as readonly string[]).includes(c.year)) return null;
  if (c.exp < now) return null;
  return c;
}
