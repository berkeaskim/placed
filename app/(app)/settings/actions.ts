"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { and, eq } from "drizzle-orm";
import { classifyCourse } from "@/lib/ai/classifyCourse";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/local-user";
import { resetUserData } from "@/lib/db/reset";
import { isDeleteConfirmed } from "@/lib/settings/confirm";
import { fieldForCourse } from "@/lib/profile/courses";

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

export type UniversityState = { ok: true; value: string | null } | { ok: false; error: string } | null;

/** Saves the university Placed uses for alumni searches and messages; empty clears it (falls back to the CV). */
export async function saveUniversity(_prev: UniversityState, formData: FormData): Promise<UniversityState> {
  const { user } = await requireUser();
  const raw = String(formData.get("university") ?? "").replace(/\s+/g, " ").trim();
  if (raw.length > 120) return { ok: false, error: "Keep it under 120 characters." };
  if (raw && !/\p{L}/u.test(raw)) return { ok: false, error: "Enter your university's name." };
  db.update(profiles).set({ university: raw || null }).where(eq(profiles.user_id, user.id)).run();
  revalidatePath("/", "layout");
  return { ok: true, value: raw || null };
}

export type CourseState = { ok: true; value: string | null } | { ok: false; error: string } | null;

/** Saves the student's course; its broad field follows (keyword match now, the AI after the response for an unusual name). */
export async function saveCourse(_prev: CourseState, formData: FormData): Promise<CourseState> {
  const { user } = await requireUser();
  const raw = String(formData.get("course") ?? "").replace(/\s+/g, " ").trim();
  if (raw.length > 120) return { ok: false, error: "Keep it under 120 characters." };
  if (raw && !/\p{L}/u.test(raw)) return { ok: false, error: "Enter your course's name." };
  const known = raw ? fieldForCourse(raw) : null;
  db.update(profiles).set({ course: raw || null, field: raw ? known ?? "Other" : null }).where(eq(profiles.user_id, user.id)).run();
  if (raw && !known) after(async () => {
    const field = await classifyCourse(raw);
    if (field !== "Other") db.update(profiles).set({ field }).where(and(eq(profiles.user_id, user.id), eq(profiles.course, raw))).run();
  });
  revalidatePath("/", "layout");
  return { ok: true, value: raw || null };
}
