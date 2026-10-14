"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { planAction as plan, completeAction as complete, confirmSkill as confirm } from "@/lib/target/progress";

export async function planAction(id: string) {
  const { supabase, user } = await requireUser();
  const r = await plan(supabase, user.id, id);
  revalidatePath("/profile/target");
  return r;
}

export async function completeAction(id: string, note: string, url?: string) {
  const { supabase, user } = await requireUser();
  const r = await complete(supabase, user.id, id, note, url);
  revalidatePath("/profile/target");
  return r;
}

export async function confirmSkill(skill: string, note: string, url?: string) {
  const { supabase, user } = await requireUser();
  const r = await confirm(supabase, user.id, skill, note, url);
  revalidatePath("/profile/target");
  return r;
}
