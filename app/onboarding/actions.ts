"use server";
import { and, eq } from "drizzle-orm";
import { after } from "next/server";
import { classifyCourse } from "@/lib/ai/classifyCourse";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { awardXP } from "@/lib/gamify/award";
import { fieldForCourse } from "@/lib/profile/courses";
import { needsVisaFor } from "@/lib/profile/work-auth";
import { canonicalUniversity } from "@/lib/profile/uk-universities";
import type { AwardResult } from "@/lib/gamify/core";
import { OnboardingInput, type OnboardingInputT } from "@/lib/validation/onboarding";

export async function saveOnboarding(input: OnboardingInputT): Promise<{ award: AwardResult | null } | { error: string }> {
  const parsed = OnboardingInput.safeParse(input);
  if (!parsed.success) return { error: "Please answer every step." };
  const { user } = await requireUser();
  const { course } = parsed.data;
  const known = fieldForCourse(course);
  try {
    db.update(profiles).set({
      university: canonicalUniversity(parsed.data.university) ?? parsed.data.university,
      course, field: known ?? "Other",
      year: parsed.data.year, grad_year: parsed.data.gradYear ?? null, placement_status: parsed.data.placementStatus ?? null, location_pref: [...new Set(parsed.data.locationPref)],
      needs_visa: parsed.data.workAuth ? needsVisaFor(parsed.data.workAuth) : parsed.data.needsVisa,
      work_auth: parsed.data.workAuth ?? (parsed.data.needsVisa ? "student_visa" : null), onboarded: true,
    }).where(eq(profiles.user_id, user.id)).run();
  } catch {
    return { error: "Couldn't save — try again." };
  }
  // An unusual course goes to the AI after the response, so a slow local model never holds up onboarding.
  if (!known) after(async () => {
    const field = await classifyCourse(course);
    // Only if the course is still the one classified: a quick edit in Settings must not be overwritten.
    if (field !== "Other") db.update(profiles).set({ field }).where(and(eq(profiles.user_id, user.id), eq(profiles.course, course))).run();
  });
  let award: AwardResult | null = null;
  try {
    // Idempotent: the once-per-user unique index makes repeats a zero-XP no-op.
    award = await awardXP(user.id, { type: "onboarding_complete" });
  } catch {
    award = null; // profile is saved; never block onboarding on the XP award
  }
  return { award };
}
