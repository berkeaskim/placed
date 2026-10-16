"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { cvs, profiles } from "@/lib/db/schema";
import { scoreCv } from "@/lib/cv-score/run";
import { ARCHETYPES, YEARS, type Archetype, type Year } from "@/lib/types";

const isArchetype = (s: unknown): s is Archetype => typeof s === "string" && (ARCHETYPES as readonly string[]).includes(s);
const toYear = (y: unknown): Year => ((YEARS as readonly string[]).includes(y as string) ? (y as Year) : "2nd");

/** Score the active CV for `sector` (cached per CV × sector inside scoreCv). Returns false when there is no active CV. */
async function scoreActiveCv(sector: Archetype): Promise<boolean> {
  const { user } = await requireUser();
  const cv = db.select({ id: cvs.id }).from(cvs).where(and(eq(cvs.user_id, user.id), eq(cvs.is_active, true))).get();
  const p = db.select({ year: profiles.year }).from(profiles).where(eq(profiles.user_id, user.id)).get();
  if (!cv) return false;
  await scoreCv({ userId: user.id, cvId: cv.id, sector, year: toYear(p?.year) });
  return true;
}

/** Sector switcher: saves the target sector and rescores the active CV for it. */
export async function setTargetSector(sector: Archetype): Promise<{ error: string; switched: boolean } | { ok: true }> {
  if (!isArchetype(sector)) return { error: "Pick a sector from the list.", switched: false };
  const { user } = await requireUser();
  try {
    db.update(profiles).set({ target_archetype: sector }).where(eq(profiles.user_id, user.id)).run();
  } catch {
    return { error: "Couldn't switch sector — try again.", switched: false };
  }
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
