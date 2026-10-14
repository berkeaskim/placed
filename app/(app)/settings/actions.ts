"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resetUserData } from "@/lib/db/reset";
import { isDeleteConfirmed } from "@/lib/settings/confirm";

export type DeleteState = { error: string } | null;

/**
 * Deletes the signed-in user's CVs, tailored PDFs and all their rows, resets their profile and sends them back to
 * onboarding (per the brief: the auth account is kept, so they stay signed in). Requires the typed confirmation
 * "DELETE" (validated here, never trusting the client's disabled button).
 */
export async function deleteMyData(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const { user } = await requireUser(); // session user only: the id is never taken from the client
  if (!isDeleteConfirmed(formData.get("confirm"))) return { error: "Type DELETE to confirm." };
  try {
    await resetUserData(createAdminClient(), user.id);
  } catch (err) {
    console.error("deleteMyData failed", err);
    return { error: "We couldn't delete everything — please try again." };
  }
  redirect("/onboarding");
}
