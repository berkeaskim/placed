"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findUserByEmail, isAlreadyRegistered } from "@/lib/demo/admin";

/**
 * Turns the guest (anonymous) user into a real email + password account, keeping the same user id so every row they
 * made stays theirs. Done with the admin API so the email is confirmed straight away (no confirmation mail to wait on).
 */
export async function saveAccount(formData: FormData): Promise<{ error: string }> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim().slice(0, 80);
  if (!email.includes("@")) return { error: "Enter a valid email." };
  if (password.length < 8) return { error: "Use at least 8 characters for your password." };
  const { supabase, user } = await requireUser();
  if (!user.is_anonymous) redirect("/feed");
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(user.id, {
    email,
    password,
    email_confirm: true,
    user_metadata: { ...user.user_metadata, ...(name ? { full_name: name } : {}) },
  });
  if (error) {
    // A taken email comes back as a bare "Error updating user", so look it up on the failure path only.
    const taken = isAlreadyRegistered(error.message) || (await findUserByEmail(admin, email).catch(() => null)) !== null;
    if (taken) {
      return { error: "That email already has an account. Sign in from the login page instead." };
    }
    console.error("saveAccount: update failed", error.message);
    return { error: "Couldn't save your account — try again." };
  }
  // The session JWT still says is_anonymous; refresh it so the guest banner goes away immediately.
  await supabase.auth.refreshSession();
  await supabase.from("profiles").update({ display_name: name || email.split("@")[0] }).eq("user_id", user.id);
  redirect("/feed?saved=1");
}
