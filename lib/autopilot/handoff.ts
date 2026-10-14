import { createHash, randomBytes } from "node:crypto";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function mintToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token), expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() };
}
/**
 * R8/R9: only the Placed extension's service worker claims the pack, so the only allowed origin is chrome-extension://<id>.
 * ATS page origins are NOT allowed: if the extension is missing, #placed=<token> stays in the employer URL for 10 minutes
 * and scripts on that page could otherwise claim it. PLACED_EXTENSION_ID pins one exact id; without it any well-formed
 * extension id is accepted (the one-time token stays the credential).
 */
const EXTENSION_ORIGIN = /^chrome-extension:\/\/[a-p]{32}$/;
export function corsHeaders(origin: string | null): Record<string, string> {
  const pinned = process.env.PLACED_EXTENSION_ID?.trim();
  const ok = !!origin && (pinned ? origin === `chrome-extension://${pinned}` : EXTENSION_ORIGIN.test(origin));
  if (!ok) return { vary: "Origin" };
  return { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "Origin" };
}
/** Filename-safe name part: NFC, letters/marks/apostrophe/hyphen only, others collapsed to "-". */
export function safeNamePart(s: string | undefined | null, fallback: string): string {
  const out = (s ?? "").normalize("NFC").replace(/[^\p{L}\p{M}'-]+/gu, "-").replace(/-{2,}/g, "-").replace(/^-+|-+$/g, "");
  return out || fallback;
}
