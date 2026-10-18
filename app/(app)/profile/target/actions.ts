"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/local-user";
import { planAction as plan, completeAction as complete, confirmSkill as confirm } from "@/lib/target/progress";

export async function planAction(id: string) {
  const { user } = await requireUser();
  const r = await plan(user.id, id);
  revalidatePath("/profile/target");
  return r;
}

export async function completeAction(id: string, note: string, url?: string, covers?: string[]) {
  const { user } = await requireUser();
  const r = await complete(user.id, id, note, url, covers);
  revalidatePath("/profile/target");
  return r;
}

export async function confirmSkill(skill: string, note: string, url?: string) {
  const { user } = await requireUser();
  const r = await confirm(user.id, skill, note, url);
  revalidatePath("/profile/target");
  return r;
}
