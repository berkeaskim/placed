import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/gmail/crypto";
import { STATE_COOKIE, exchangeCode, fetchProfileEmail, statesMatch } from "@/lib/gmail/oauth";

/** Stores the encrypted refresh token for the session user (never a user id from the query). */
export async function GET(req: NextRequest) {
  const { user } = await requireUser();
  const back = (status: string) => {
    const res = NextResponse.redirect(new URL(`/tracker?gmail=${status}`, req.url));
    res.cookies.delete({ name: STATE_COOKIE, path: "/api/gmail" });
    return res;
  };
  const q = req.nextUrl.searchParams;
  if (q.get("error")) return back("denied");
  if (!statesMatch(req.cookies.get(STATE_COOKIE)?.value, q.get("state"))) return back("error");
  const code = q.get("code");
  if (!code) return back("error");
  try {
    const { refreshToken, accessToken } = await exchangeCode(code, new URL("/api/gmail/callback", req.url).toString());
    if (!refreshToken) return back("error"); // prompt=consent should always return one
    const googleEmail = await fetchProfileEmail(accessToken);
    const { error } = await createAdminClient().from("gmail_connections").upsert({
      user_id: user.id, google_email: googleEmail, refresh_token_enc: encryptToken(refreshToken), connected_at: new Date().toISOString(),
    });
    if (error) throw new Error(error.message);
    return back("connected");
  } catch (e) {
    console.error("gmail callback failed", e instanceof Error ? e.message : e);
    return back("error");
  }
}
