"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { awardXP } from "@/lib/gamify/award";
import { CoreSchema } from "@/lib/autopilot/vault";

export type SaveState = { ok: boolean; missing: string[]; unlocked: boolean; xp?: number } | null;
const KEYS = Object.keys(CoreSchema.shape) as (keyof typeof CoreSchema.shape)[];

export async function saveVault(_prev: SaveState, form: FormData): Promise<SaveState> {
  const { supabase, user } = await requireUser();
  const raw: Record<string, string> = {};
  for (const k of KEYS) { const v = form.get(k); if (typeof v === "string" && v.trim()) raw[k] = v.trim(); }
  const partial = CoreSchema.partial().safeParse(raw);
  const core = partial.success ? partial.data : Object.fromEntries(Object.entries(raw).filter(([k]) => !partial.error.issues.some((i) => i.path[0] === k)));
  const full = CoreSchema.safeParse(core);
  const missing = full.success ? [] : [...new Set(full.error.issues.map((i) => String(i.path[0])))];
  const db = createAdminClient();
  const { data: prior } = await db.from("autopilot_vault").select("completed_at").eq("user_id", user.id).maybeSingle();
  const completedAt = prior?.completed_at ?? (full.success ? new Date().toISOString() : null);
  const { error } = await db.from("autopilot_vault").upsert({ user_id: user.id, core, completed_at: completedAt, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, missing, unlocked: false };
  let xp: number | undefined;
  if (full.success && !prior?.completed_at) xp = (await awardXP(supabase, user.id, { type: "autopilot_ready" }).catch(() => null))?.xpGained;
  revalidatePath("/autopilot/setup");
  return { ok: true, missing, unlocked: Boolean(completedAt), xp };
}

export async function deleteVault(): Promise<void> {
  const { user } = await requireUser();
  const db = createAdminClient();
  await db.from("autopilot_packs").delete().eq("user_id", user.id);
  await db.from("autopilot_vault").delete().eq("user_id", user.id);
  revalidatePath("/autopilot/setup");
}
