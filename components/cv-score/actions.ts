"use server";
import { z } from "zod";
import { requireUser } from "@/lib/supabase/server";
import { RULES_BY_ID } from "@/lib/cv-rules";
import { ARCHETYPES } from "@/lib/types";

const Input = z.object({ cvId: z.uuid(), ruleId: z.string().min(1).max(64), sector: z.enum(ARCHETYPES) });

/** "I disagree" on a CV Score fix: records the disagreement (cv_feedback, RLS own_insert) and changes nothing else. */
export async function disagreeWithFix(input: { cvId: string; ruleId: string; sector: string }): Promise<{ ok: true } | { error: string }> {
  const p = Input.safeParse(input);
  if (!p.success || !RULES_BY_ID.has(p.data.ruleId)) return { error: "Couldn't record that." };
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from("cv_feedback").insert({ user_id: user.id, cv_id: p.data.cvId, rule_id: p.data.ruleId, sector: p.data.sector });
  if (error) { console.error("cv_feedback insert failed", error); return { error: "Couldn't record that — try again." }; }
  return { ok: true };
}
