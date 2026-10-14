"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { awardXP } from "@/lib/gamify/award";
import type { AwardResult } from "@/lib/gamify/core";
import { quizToArchetypes } from "@/lib/ai/quizToArchetypes";
import { QUESTIONS } from "@/lib/quiz/questions";
import { quizMayWriteArchetypes, roleCards, type RoleCard } from "@/lib/quiz/view";
import type { ArchetypeScore } from "@/lib/types";

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
  const { supabase, user } = await requireUser();
  const r = await quizToArchetypes(clean);
  if (!r.archetypes.length) return { error: "We couldn't work out your roles. Try the quiz again." };

  const [prof, cv] = await Promise.all([
    supabase.from("profiles").select("target_archetype").eq("user_id", user.id).single<{ target_archetype: string | null }>(),
    supabase.from("cvs").select("page_texts, parsed_json").eq("user_id", user.id).eq("is_active", true)
      .maybeSingle<{ page_texts: string[] | null; parsed_json: { archetypes?: ArchetypeScore[] } | null }>(),
  ]);
  if (prof.error || cv.error) return { error: "Couldn't save your quiz — try again." };

  const write = quizMayWriteArchetypes(cv.data);
  if (write) {
    const upd = await supabase.from("profiles").update({
      archetypes: r.archetypes,
      target_archetype: prof.data?.target_archetype ?? r.archetypes[0].key,
    }).eq("user_id", user.id);
    if (upd.error) return { error: "Couldn't save your quiz — try again." };
  }

  // quiz_done is once per user (DB unique index): a retake returns no XP rather than failing.
  let award: AwardResult | null = null;
  try {
    award = await awardXP(supabase, user.id, { type: "quiz_done", profileComplete: true });
  } catch (e) {
    console.error("awardXP failed after quiz", e);
  }
  revalidatePath("/profile");
  return { ok: true, award, roles: roleCards(r.archetypes), skills: r.skills, keptCvRoles: !write };
}
