import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * "Get started": straight into onboarding as an anonymous Supabase user, no sign-in first. The account is saved at
 * the end (/save turns the same user into an email + password one, so nothing they did is lost). POST only, so a
 * link prefetch or crawler can't mint guest users.
 */
export async function POST(request: Request) {
  const origin = new URL(request.url).origin;
  const go = (path: string) => NextResponse.redirect(new URL(path, origin), 303);
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  let userId = data.user?.id;
  if (!userId) {
    const { data: anon, error } = await supabase.auth.signInAnonymously();
    if (error || !anon.user) {
      console.error("start: anonymous sign-in failed", error?.message);
      return go("/login?error=guest");
    }
    userId = anon.user.id;
  }
  const { data: profile } = await supabase.from("profiles").select("onboarded").eq("user_id", userId).maybeSingle();
  return go(profile?.onboarded ? "/feed" : "/onboarding");
}
