import { timingSafeEqual } from "node:crypto";
import { GmailAuthError } from "./search";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const STATE_COOKIE = "gmail_oauth_state";
const TOKEN_URL = "https://oauth2.googleapis.com/token";

const clientId = () => process.env.GOOGLE_CLIENT_ID ?? "";
const clientSecret = () => process.env.GOOGLE_CLIENT_SECRET ?? "";

export function consentUrl(o: { clientId: string; redirectUri: string; state: string }): string {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.search = new URLSearchParams({
    client_id: o.clientId, redirect_uri: o.redirectUri, response_type: "code", scope: GMAIL_SCOPE,
    access_type: "offline", prompt: "consent", include_granted_scopes: "false", state: o.state,
  }).toString();
  return u.toString();
}

export function statesMatch(cookie: string | undefined, query: string | null): boolean {
  if (!cookie || !query || cookie.length !== query.length) return false;
  return timingSafeEqual(Buffer.from(cookie), Buffer.from(query));
}

async function token(params: Record<string, string>): Promise<Record<string, string>> {
  const r = await fetch(TOKEN_URL, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), ...params }), cache: "no-store",
  });
  const j = (await r.json().catch(() => ({}))) as Record<string, string>;
  if (j.error === "invalid_grant") throw new GmailAuthError("Google refused the grant (revoked or expired)");
  if (!r.ok || !j.access_token) throw new Error(`Google token endpoint failed: HTTP ${r.status} ${j.error ?? ""}`.trim());
  return j;
}

export async function exchangeCode(code: string, redirectUri: string) {
  const j = await token({ code, redirect_uri: redirectUri, grant_type: "authorization_code" });
  return { refreshToken: j.refresh_token ?? null, accessToken: j.access_token };
}

export async function refreshAccessToken(refreshToken: string): Promise<string> {
  return (await token({ refresh_token: refreshToken, grant_type: "refresh_token" })).access_token;
}

/** Best effort: a failed revoke must not block disconnecting or deleting data. */
export async function revokeToken(t: string): Promise<void> {
  try {
    await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(t)}`, { method: "POST" });
  } catch (e) {
    console.error("revokeToken failed", e instanceof Error ? e.message : e);
  }
}

export async function fetchProfileEmail(accessToken: string): Promise<string> {
  const r = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) throw new Error(`Gmail profile failed: HTTP ${r.status}`);
  return ((await r.json()) as { emailAddress: string }).emailAddress;
}
