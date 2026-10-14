"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function origin() {
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

export async function signInWithEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) return { error: "Enter a valid email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await origin()}/auth/callback` },
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function signInWithGoogle() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await origin()}/auth/callback` },
  });
  if (error || !data.url) return { error: error?.message ?? "Google sign-in unavailable." };
  redirect(data.url);
}

/**
 * "Try the demo" (spec §12): signs in as the FICTIONAL demo persona. Only when NEXT_PUBLIC_DEMO_MODE=1; the
 * credentials are server-only env (DEMO_EMAIL / DEMO_PASSWORD) and never reach the client.
 */
export async function signInDemo() {
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== "1") return { error: "Demo mode is off." };
  const email = process.env.DEMO_EMAIL?.trim();
  const password = process.env.DEMO_PASSWORD;
  if (!email || !password) return { error: "The demo account isn't set up on this server yet." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: "Couldn't open the demo right now. Try again in a moment." };
  const { data: profile } = await supabase.from("profiles").select("onboarded").eq("user_id", data.user.id).maybeSingle();
  redirect(profile?.onboarded ? "/feed" : "/onboarding");
}
