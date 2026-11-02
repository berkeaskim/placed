import { corsHeaders } from "@/lib/autopilot/handoff";
import { isExtensionVersion, lastExtensionSeen, recordExtensionSeen } from "@/lib/autopilot/extension-seen";
import { isLoopbackRequest, verifyExtensionRequest } from "@/lib/extension-auth";

export const dynamic = "force-dynamic";

/**
 * POST: the extension's service worker saying "installed, version x" (chrome-extension:// origins only, so a web page
 * can't fake it). GET: the app's own pages asking whether it has reported in, for the Mac app window, where the
 * extension can't stamp the page.
 */
export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: Request) {
  const cors = corsHeaders(req.headers.get("origin"));
  if (!cors["access-control-allow-origin"] || !verifyExtensionRequest(req)) {
    return new Response("Forbidden", { status: 403, headers: cors });
  }
  const raw = await req.text().catch(() => "");
  let version: unknown;
  try { version = raw.length <= 200 ? (JSON.parse(raw) as { version?: unknown }).version : undefined; } catch { /* below */ }
  if (!isExtensionVersion(version)) return new Response("Bad request", { status: 400, headers: cors });
  recordExtensionSeen(version);
  return new Response(null, { status: 204, headers: cors });
}

export async function GET(req: Request) {
  if (!isLoopbackRequest(req)) return new Response("Forbidden", { status: 403 });
  return Response.json({ seen: lastExtensionSeen() }, { headers: { "cache-control": "no-store" } });
}
