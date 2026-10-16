"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { findUserByEmail, isAlreadyRegistered } from "@/lib/demo/admin";
import { allow, clientIp } from "@/lib/auth/rate-limit";
import { normalizeEmail, passwordProblem } from "@/lib/auth/validate";

/**
 * Turns the guest (anonymous) user into a real email + password account, keeping the same user id so every row they
 * made stays theirs. Done with the admin API so the email is confirmed straight away (no confirmation mail to wait on).
 * Limited per client IP: the "already has an account" answer would otherwise let a script test which emails exist.
 */
export async function saveAccount(formData: FormData): Promise<{ error: string }> {
  const email = normalizeEmail(formData.get("email"));
  const password = formData.get("password");
  const name = String(formData.get("name") ?? "").replace(/[\u0000-\u001f\u007f<>]/g, "").trim().slice(0, 80);
  if (!email) return { error: "Enter a valid email." };
  const pwProblem = passwordProblem(password);
  if (pwProblem || typeof password !== "string") return { error: pwProblem ?? "Enter a password." };
  const { supabase, user } = await requireUser();
  if (!user.is_anonymous) redirect("/feed");
  if (!(await allow("saveIp", await clientIp()))) return { error: "Too many attempts. Wait a while and try again." };
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
