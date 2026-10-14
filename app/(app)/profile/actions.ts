"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/supabase/server";
import { scoreCv } from "@/lib/cv-score/run";
import { ARCHETYPES, YEARS, type Archetype, type Year } from "@/lib/types";

const isArchetype = (s: unknown): s is Archetype => typeof s === "string" && (ARCHETYPES as readonly string[]).includes(s);
const toYear = (y: unknown): Year => ((YEARS as readonly string[]).includes(y as string) ? (y as Year) : "2nd");

/** Score the active CV for `sector` (cached per CV × sector inside scoreCv). Returns false when there is no active CV. */
async function scoreActiveCv(sector: Archetype): Promise<boolean> {
  const { supabase, user } = await requireUser();
  const [{ data: cv }, { data: p }] = await Promise.all([
    supabase.from("cvs").select("id").eq("user_id", user.id).eq("is_active", true).maybeSingle<{ id: string }>(),
    supabase.from("profiles").select("year").eq("user_id", user.id).single<{ year: string | null }>(),
  ]);
  if (!cv) return false;
  await scoreCv(supabase, { userId: user.id, cvId: cv.id, sector, year: toYear(p?.year) });
  return true;
}

/** Sector switcher: saves the target sector and rescores the active CV for it. */
export async function setTargetSector(sector: Archetype): Promise<{ error: string; switched: boolean } | { ok: true }> {
  if (!isArchetype(sector)) return { error: "Pick a sector from the list.", switched: false };
  const { supabase, user } = await requireUser();
  const upd = await supabase.from("profiles").update({ target_archetype: sector }).eq("user_id", user.id);
  if (upd.error) return { error: "Couldn't switch sector — try again.", switched: false };
  let failed = false;
  try { await scoreActiveCv(sector); } catch (e) {
    console.error("setTargetSector: scoreCv failed", e);
    failed = true;
  }
  revalidatePath("/profile");
  revalidatePath("/profile/target");
  return failed ? { error: "Sector switched, but scoring didn't finish. Use “Score my CV” to try again.", switched: true } : { ok: true };
}

/** "Score my CV" fallback button (ruling C4), used when scoring on page load failed. */
export async function scoreMyCv(formData: FormData): Promise<void> {
  const sector = formData.get("sector");
  if (!isArchetype(sector)) redirect("/profile");
  let failed = false;
  try { await scoreActiveCv(sector); } catch (e) {
    console.error("scoreMyCv: scoreCv failed", e);
    failed = true;
  }
  revalidatePath("/profile");
  redirect(failed ? "/profile?score=failed" : "/profile");
}
