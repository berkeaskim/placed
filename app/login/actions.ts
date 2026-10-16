"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { allow, clientIp } from "@/lib/auth/rate-limit";
import { normalizeEmail } from "@/lib/auth/validate";

const TOO_MANY = "Too many attempts. Wait a few minutes and try again.";

async function origin() {
  const h = await headers();
  return h.get("origin") ?? `https://${h.get("host")}`;
}

export async function signInWithEmail(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  if (!email) return { error: "Enter a valid email." };
  if (!(await allow("otpIp", await clientIp()))) return { error: TOO_MANY };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await origin()}/auth/callback` },
  });
  // Never echo Supabase's message: it can reveal whether the address has an account.
  if (error) return { error: error.status === 429 ? TOO_MANY : "Couldn't send the sign-in link. Try again in a moment." };
  return { ok: true };
}

/**
 * Email + password sign-in for accounts Berke creates by hand (`npm run user:add`). Self sign-up stays off:
 * a wrong email or password gets one generic message so the form can't be used to probe which emails exist.
 * Limited per client IP and per target email (lib/auth/rate-limit.ts) against password guessing.
 */
export async function signInWithPassword(formData: FormData) {
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password");
  if (!email || typeof password !== "string" || !password) return { error: "Enter your email and password." };
  // Both limits are counted on every attempt, so neither reveals whether the email exists.
  const [byIp, byEmail] = await Promise.all([allow("loginIp", await clientIp()), allow("loginEmail", email)]);
  if (!byIp || !byEmail) return { error: TOO_MANY };
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user) return { error: error?.status === 429 ? TOO_MANY : "Wrong email or password." };
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
