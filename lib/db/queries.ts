import type { SupabaseClient } from "@supabase/supabase-js";
import type { Archetype, ArchetypeScore, Region, StudentProfile, Year } from "@/lib/types";

export type ProfileRow = {
  user_id: string; display_name: string | null; year: Year | null; field: string | null; location_pref: Region[];
  needs_visa: boolean; target_archetype: Archetype | null; archetypes: ArchetypeScore[]; skills: string[];
  onboarded: boolean; xp: number; level: number; streak_days: number; last_active_date: string | null;
};

export async function getProfile(supabase: SupabaseClient, userId: string): Promise<ProfileRow> {
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", userId).single();
  if (error) throw error;
  return data as ProfileRow;
}

export function toStudent(p: ProfileRow): StudentProfile {
  return {
    year: p.year ?? "2nd",
    locationPref: p.location_pref ?? [],
    needsVisa: p.needs_visa,
    archetypes: [...(p.archetypes ?? [])].sort((a, b) => b.score - a.score),
    skills: p.skills ?? [],
  };
}
