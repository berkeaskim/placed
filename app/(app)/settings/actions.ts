"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resetUserData } from "@/lib/db/reset";

/**
 * Deletes the signed-in user's CVs, tailored PDFs and all their rows, resets their profile and sends them back to
 * onboarding (per the brief: the auth account is kept, so they stay signed in).
 */
export async function deleteMyData(): Promise<void> {
  const { user } = await requireUser(); // session user only: the id is never taken from the client
  await resetUserData(createAdminClient(), user.id);
  redirect("/onboarding");
}
