"use server";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/local-user";
import { resetUserData } from "@/lib/db/reset";
import { isDeleteConfirmed } from "@/lib/settings/confirm";

export type DeleteState = { error: string } | null;

/**
 * Wipes the local user's CVs, tailored PDFs and all their rows, resets their profile and sends them back to
 * onboarding. AI settings and the job catalogue are kept. Requires the typed confirmation "DELETE" (validated here,
 * never trusting the client's disabled button).
 */
export async function deleteMyData(_prev: DeleteState, formData: FormData): Promise<DeleteState> {
  const { user } = await requireUser();
  if (!isDeleteConfirmed(formData.get("confirm"))) return { error: "Type DELETE to confirm." };
  try {
    await resetUserData(user.id);
  } catch (err) {
    console.error("deleteMyData failed", err);
    return { error: "We couldn't delete everything — please try again." };
  }
  redirect("/onboarding");
}
