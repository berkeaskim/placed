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

/**
 * Email + password sign-in for accounts Berke creates by hand (`npm run user:add`). Self sign-up stays off:
 * a wrong email or password gets one generic message so the form can't be used to probe which emails exist.
 */
export async function signInWithPassword(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email.includes("@") || !password) return { error: "Enter your email and password." };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    return { error: error?.status === 429 ? "Too many attempts. Wait a minute and try again." : "Wrong email or password." };
  }
  const { data: profile } = await supabase.from("profiles").select("onboarded").eq("user_id", data.user.id).maybeSingle();
  redirect(profile?.onboarded ? "/feed" : "/onboarding");
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
