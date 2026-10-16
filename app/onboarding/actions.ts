"use server";
import { eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { awardXP } from "@/lib/gamify/award";
import type { AwardResult } from "@/lib/gamify/core";
import { OnboardingInput, type OnboardingInputT } from "@/lib/validation/onboarding";

export async function saveOnboarding(input: OnboardingInputT): Promise<{ award: AwardResult | null } | { error: string }> {
  const parsed = OnboardingInput.safeParse(input);
  if (!parsed.success) return { error: "Please answer every step." };
  const { user } = await requireUser();
  try {
    db.update(profiles).set({
      year: parsed.data.year, field: parsed.data.field, location_pref: [...new Set(parsed.data.locationPref)],
      needs_visa: parsed.data.needsVisa, onboarded: true,
    }).where(eq(profiles.user_id, user.id)).run();
  } catch {
    return { error: "Couldn't save — try again." };
  }
  let award: AwardResult | null = null;
  try {
    // Idempotent: the once-per-user unique index makes repeats a zero-XP no-op.
    award = await awardXP(user.id, { type: "onboarding_complete" });
  } catch {
    award = null; // profile is saved; never block onboarding on the XP award
  }
  return { award };
}
