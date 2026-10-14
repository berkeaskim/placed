import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  // Expired, reused or malformed link: say so on /login instead of silently dropping the user there.
  const linkFailed = () => NextResponse.redirect(new URL("/login?error=link", url.origin));
  const code = url.searchParams.get("code");
  if (!code) return linkFailed();
  const supabase = await createClient();
  let user: { id: string } | null = null;
  try {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) user = data.user;
  } catch (e) {
    console.error("auth callback: code exchange threw", e instanceof Error ? e.message : e);
  }
  if (!user) return linkFailed();
  const { data: profile } = await supabase.from("profiles").select("onboarded").eq("user_id", user.id).single();
  return NextResponse.redirect(new URL(profile?.onboarded ? "/feed" : "/onboarding", url.origin));
}
