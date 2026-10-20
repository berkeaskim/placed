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
import { z } from "zod";
import { PLACEMENT_STATUSES, WORK_AUTH, YEARS } from "@/lib/types";
import { needsVisaFor } from "@/lib/profile/work-auth";
import { GradYear } from "@/lib/validation/onboarding";

const YearInput = z.enum(YEARS);
import { setSecret } from "@/lib/settings/store";
import { SERPER_SECRET } from "@/lib/inside-track/find";

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

export type StudyState = { ok: true; message: string } | { ok: false; error: string } | null;

/** Saves year of study and expected graduation year; the feed decides spring weeks vs internships from them. */
export async function saveStudy(_prev: StudyState, formData: FormData): Promise<StudyState> {
  const { user } = await requireUser();
  const year = YearInput.safeParse(formData.get("year"));
  const rawGrad = String(formData.get("grad_year") ?? "");
  const grad = rawGrad ? GradYear.safeParse(Number(rawGrad)) : null;
  if (!year.success) return { ok: false, error: "Pick your year of study." };
  if (grad && !grad.success) return { ok: false, error: "Pick a graduation year." };
  const rawAuth = String(formData.get("work_auth") ?? "");
  const auth = rawAuth ? z.enum(WORK_AUTH).safeParse(rawAuth) : null;
  if (auth && !auth.success) return { ok: false, error: "Pick your right to work." };
  const workAuth = auth?.data ?? null;
  const rawPlacement = String(formData.get("placement_status") ?? "");
  const placement = rawPlacement ? z.enum(PLACEMENT_STATUSES).safeParse(rawPlacement) : null;
  if (placement && !placement.success) return { ok: false, error: "Pick whether your degree has a placement year." };
  const rawBy = String(formData.get("placement_secure_by") ?? "").trim();
  if (rawBy && (!/^\d{4}-\d{2}-\d{2}$/.test(rawBy) || Number.isNaN(Date.parse(rawBy)))) return { ok: false, error: "Pick a valid date for your university's placement deadline." };
  db.update(profiles).set({ year: year.data, grad_year: grad?.data ?? null, placement_status: placement?.data ?? null, placement_secure_by: rawBy || null, work_auth: workAuth, needs_visa: needsVisaFor(workAuth) })
    .where(eq(profiles.user_id, user.id)).run();
  revalidatePath("/", "layout");
  return { ok: true, message: grad ? `Saved. Graduating in ${grad.data}.` : "Saved." };
}

export type SearchKeyState = { ok: true; message: string } | { ok: false; error: string } | null;

/** Saves (or, with an empty field, removes) the Serper key Inside Track uses to find people. Stored sealed like AI keys. */
export async function saveSearchKey(_prev: SearchKeyState, formData: FormData): Promise<SearchKeyState> {
  const k = String(formData.get("key") ?? "").trim();
  if (k && (k.length < 10 || k.length > 400 || /\s/.test(k))) return { ok: false, error: "That doesn't look like an API key." };
  setSecret(SERPER_SECRET, k || null);
  revalidatePath("/", "layout");
  return { ok: true, message: k ? "Key saved. Applied roles now show real people." : "Key removed." };
}
