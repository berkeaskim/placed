import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login", url.origin));
  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) return NextResponse.redirect(new URL("/login", url.origin));
  const { data: profile } = await supabase.from("profiles").select("onboarded").eq("user_id", data.user.id).single();
  return NextResponse.redirect(new URL(profile?.onboarded ? "/feed" : "/onboarding", url.origin));
}
