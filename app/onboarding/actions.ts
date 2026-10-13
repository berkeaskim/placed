"use server";
import { requireUser } from "@/lib/supabase/server";
import { awardXP } from "@/lib/gamify/award";
import type { AwardResult } from "@/lib/gamify/core";
import { OnboardingInput, type OnboardingInputT } from "@/lib/validation/onboarding";

export async function saveOnboarding(input: OnboardingInputT): Promise<{ award: AwardResult | null } | { error: string }> {
  const parsed = OnboardingInput.safeParse(input);
  if (!parsed.success) return { error: "Please answer every step." };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("profiles").update({
    year: parsed.data.year, field: parsed.data.field, location_pref: [...new Set(parsed.data.locationPref)],
    needs_visa: parsed.data.needsVisa, onboarded: true,
  }).eq("user_id", user.id);
  if (error) return { error: "Couldn't save — try again." };
  let award: AwardResult | null = null;
  try {
    // Idempotent: the once-per-user unique index makes repeats a zero-XP no-op.
    award = await awardXP(supabase, user.id, { type: "onboarding_complete" });
  } catch {
    award = null; // profile is saved; never block onboarding on the XP award
  }
  return { award };
}
