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
