import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { STATE_COOKIE, consentUrl } from "@/lib/gmail/oauth";
import { isDemoEmail } from "@/lib/demo/is-demo";

export async function GET(req: NextRequest) {
  const { user } = await requireUser();
  // The demo account reads the sample inbox; it must never hold a real Google token.
  if (isDemoEmail(user.email)) return NextResponse.redirect(new URL("/tracker?gmail=demo", req.url));
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL("/tracker?gmail=unconfigured", req.url));
  const state = randomBytes(24).toString("base64url");
  const redirectUri = new URL("/api/gmail/callback", req.url).toString();
  const res = NextResponse.redirect(consentUrl({ clientId, redirectUri, state }));
  res.cookies.set(STATE_COOKIE, state, { httpOnly: true, secure: req.nextUrl.protocol === "https:", sameSite: "lax", path: "/api/gmail", maxAge: 600 });
  return res;
}
