import "server-only";
import { createHash, timingSafeEqual } from "node:crypto";
import { corsHeaders } from "@/lib/autopilot/handoff";
import { getSecret } from "@/lib/settings/store";

const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

/** True when the request was addressed to a loopback host (a rebinding page's Host header names its own domain). */
export function isLoopbackRequest(req: Request): boolean {
  try {
    return LOOPBACK.has(new URL(req.url).hostname) && LOOPBACK.has(new URL(`http://${req.headers.get("host") ?? ""}`).hostname);
  } catch {
    return false;
  }
}

const digest = (s: string) => createHash("sha256").update(s).digest();

function bearerMatches(req: Request): boolean {
  let want: string | null = null;
  try { want = getSecret("extension.token"); } catch { return false; }
  const got = req.headers.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  return !!want && !!got && timingSafeEqual(digest(got), digest(want));
}

/**
 * Whether a request may use an extension-facing route. Accepts a `Bearer` matching the `extension.token` secret (when
 * one is set), or, on a loopback server, the Placed extension's chrome-extension:// origin (pinned by
 * PLACED_EXTENSION_ID when set) or the app's own origin. Route-level credentials (capture ticket, pack token) still apply.
 */
export function verifyExtensionRequest(req: Request): boolean {
  if (bearerMatches(req)) return true;
  if (!isLoopbackRequest(req)) return false;
  const origin = req.headers.get("origin");
  if (!origin) return false;
  if (corsHeaders(origin)["access-control-allow-origin"]) return true;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}
