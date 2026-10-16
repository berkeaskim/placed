import { corsHeaders } from "@/lib/autopilot/handoff";
import { verifyExtensionRequest } from "@/lib/extension-auth";
import { verifyCaptureToken } from "@/lib/linkedin/capture-token";
import { CapturePayloadSchema } from "@/lib/linkedin/parse-capture";
import { CaptureUsedError, NotYourProfileError, scoreLinkedInCapture } from "@/lib/linkedin-score/run";

export const maxDuration = 120;

/**
 * Called cross-origin by the Placed extension's service worker with the profile it read in the student's own
 * logged-in LinkedIn tab. The signed ticket from /profile/linkedin is the credential and names the user, sector and
 * year; verifyExtensionRequest gates who may call at all. Only chrome-extension:// origins get CORS headers.
 */
export async function OPTIONS(req: Request) {
  return new Response(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

const MAX_BODY = 200_000;

export async function POST(req: Request) {
  const cors = corsHeaders(req.headers.get("origin"));
  if (!verifyExtensionRequest(req)) return new Response("Forbidden", { status: 403, headers: cors });
  const raw = await req.text().catch(() => "");
  if (!raw || raw.length > MAX_BODY) return new Response("Bad request", { status: 400, headers: cors });
  let body: { token?: unknown; profile?: unknown };
  try { body = JSON.parse(raw); } catch { return new Response("Bad request", { status: 400, headers: cors }); }

  const claims = verifyCaptureToken(body.token);
  if (!claims) return new Response("This link expired. Press the button in Placed again.", { status: 410, headers: cors });
  const parsed = CapturePayloadSchema.safeParse(body.profile);
  if (!parsed.success) return new Response("Bad request", { status: 400, headers: cors });

  try {
    const data = await scoreLinkedInCapture({ userId: claims.userId, nonce: claims.nonce, payload: parsed.data, sector: claims.sector, year: claims.year });
    return Response.json({ ok: true, total: data.total, label: data.label, saved: data.saved }, { headers: { ...cors, "cache-control": "no-store" } });
  } catch (e) {
    if (e instanceof CaptureUsedError) return new Response("Already scored. Press the button in Placed again to rescore.", { status: 410, headers: cors });
    if (e instanceof NotYourProfileError) return new Response("The name on this LinkedIn profile doesn't match the CV in Placed. Score your own profile, or upload your own CV in Profile first.", { status: 409, headers: cors });
    console.error("linkedin capture failed", e);
    return new Response("We couldn't score this profile right now. Try again in a minute.", { status: 500, headers: cors });
  }
}
