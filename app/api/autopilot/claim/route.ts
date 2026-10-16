import { claimPack } from "@/lib/autopilot/server";
import { corsHeaders } from "@/lib/autopilot/handoff";
import { verifyExtensionRequest } from "@/lib/extension-auth";

/**
 * Called by the Placed extension's service worker. There is no session: the one-time token is the credential. The
 * request must reach a loopback host (verifyExtensionRequest, so a DNS-rebinding page can't call it) from the
 * Placed extension's chrome-extension:// origin (R9: never the ATS page origins, nor the app's own pages). The
 * response carries one form's fill plan only.
 */
export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

export async function POST(req: Request) {
  const cors = corsHeaders(req.headers.get("origin"));
  if (!cors["access-control-allow-origin"] || !verifyExtensionRequest(req)) return new Response("Forbidden", { status: 403, headers: cors });
  const body = (await req.json().catch(() => null)) as { token?: unknown } | null;
  if (typeof body?.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(body.token)) return new Response("Bad request", { status: 400, headers: cors });
  const r = await claimPack(body.token);
  if (r.status !== 200) return new Response(r.status === 410 ? "This link was already used or expired. Re-open from Placed." : "Not found", { status: r.status, headers: cors });
  return Response.json(r.body, { headers: { ...cors, "cache-control": "no-store" } });
}
