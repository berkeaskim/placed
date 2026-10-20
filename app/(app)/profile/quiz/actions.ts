"use server";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { requireUser } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { cvs, profiles } from "@/lib/db/schema";
import { awardXP } from "@/lib/gamify/award";
import type { AwardResult } from "@/lib/gamify/core";
import { quizToArchetypes } from "@/lib/ai/quizToArchetypes";
import { QUESTIONS } from "@/lib/quiz/questions";
import { quizMayWriteArchetypes, roleCards, type RoleCard } from "@/lib/quiz/view";
import { withFieldPrior } from "@/lib/profile/field-prior";

export type SubmitQuizResult =
  | { ok: true; award: AwardResult | null; roles: RoleCard[]; skills: string[]; keptCvRoles: boolean }
  | { error: string };

/**
 * Saves quiz roles to the profile. Never overwrites CV-derived roles: when the active CV already produced
 * archetypes, the quiz result is shown but not saved (keptCvRoles), see quizMayWriteArchetypes.
 */
export async function submitQuiz(answers: Record<string, string>): Promise<SubmitQuizResult> {
  if (!answers || typeof answers !== "object") return { error: "Answer all six questions." };
  // Only known option ids get through: nothing free-form reaches the prompt or the database.
  const clean: Record<string, string> = {};
  for (const q of QUESTIONS) {
    const a = answers[q.id];
    if (typeof a !== "string" || !q.options.some((o) => o.id === a)) return { error: "Answer all six questions." };
    clean[q.id] = a;
  }
  const { user } = await requireUser();
  const r = await quizToArchetypes(clean);
  if (!r.archetypes.length) return { error: "We couldn't work out your roles. Try the quiz again." };

  let write: boolean;
  try {
    const prof = db.select({ target_archetype: profiles.target_archetype, field: profiles.field }).from(profiles).where(eq(profiles.user_id, user.id)).get();
    if (!prof) return { error: "Couldn't save your quiz — try again." };
    r.archetypes = withFieldPrior(r.archetypes, prof.field);
    const cv = db.select({ page_texts: cvs.page_texts, parsed_json: cvs.parsed_json }).from(cvs)
      .where(and(eq(cvs.user_id, user.id), eq(cvs.is_active, true))).get();
    write = quizMayWriteArchetypes(cv ?? null);
    if (write) {
      db.update(profiles).set({ archetypes: r.archetypes, target_archetype: prof.target_archetype ?? r.archetypes[0].key })
        .where(eq(profiles.user_id, user.id)).run();
    }
  } catch {
    return { error: "Couldn't save your quiz — try again." };
  }

  // quiz_done is once per user (DB unique index): a retake returns no XP rather than failing.
  let award: AwardResult | null = null;
  try {
    award = await awardXP(user.id, { type: "quiz_done", profileComplete: true });
  } catch (e) {
    console.error("awardXP failed after quiz", e);
  }
  revalidatePath("/profile");
  return { ok: true, award, roles: roleCards(r.archetypes), skills: r.skills, keptCvRoles: !write };
}
