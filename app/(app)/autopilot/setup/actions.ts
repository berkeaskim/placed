"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { awardXP } from "@/lib/gamify/award";
import { CoreSchema } from "@/lib/autopilot/vault";
import { openVault, sealVault } from "@/lib/autopilot/vault-crypto";
import { env } from "@/lib/env";

export type SaveState = {
  ok: boolean;
  /** Required fields still empty in the merged core. */
  missing: string[];
  /** Fields that were posted but rejected by validation (the previously saved value, if any, is kept). */
  invalid: string[];
  /** Currently complete, i.e. isComplete(merged core). `completed_at` is only the once-only XP marker. */
  unlocked: boolean;
  xp?: number;
  /** What to show in the form after the action: the merged core, with rejected posted values overlaid so the user's typing isn't lost. */
  values?: Record<string, string>;
} | null;
export type DeleteResult = { ok: boolean; error?: string };
const KEYS = Object.keys(CoreSchema.shape) as (keyof typeof CoreSchema.shape)[];

export async function saveVault(_prev: SaveState, form: FormData): Promise<SaveState> {
  const { supabase, user } = await requireUser();
  if (!env.autopilot) return { ok: false, missing: [], invalid: [], unlocked: false };
  const db = createAdminClient();
  const { data: prior } = await db.from("autopilot_vault").select("core, completed_at").eq("user_id", user.id).maybeSingle();
  const merged: Record<string, unknown> = { ...openVault("core", user.id, prior?.core) };
  const invalid: string[] = [];
  const rejected: Record<string, string> = {};
  for (const k of KEYS) {
    const v = form.get(k);
    if (typeof v !== "string") continue; // not posted: keep what is saved
    const t = v.trim();
    if (!t) { delete merged[k]; continue; } // explicitly cleared
    const r = CoreSchema.shape[k].safeParse(t);
    if (r.success && r.data !== undefined) merged[k] = r.data;
    else { invalid.push(k); rejected[k] = t; }
  }
  const full = CoreSchema.safeParse(merged);
  const missing = full.success ? [] : [...new Set(full.error.issues.map((i) => String(i.path[0])))];
  const unlocked = full.success;
  const completedAt = prior?.completed_at ?? (unlocked ? new Date().toISOString() : null);
  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...merged, ...rejected })) if (typeof v === "string") values[k] = v;
  const { error } = await db.from("autopilot_vault").upsert({ user_id: user.id, core: sealVault("core", user.id, merged), completed_at: completedAt, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, missing, invalid, unlocked: false, values };
  let xp: number | undefined;
  if (unlocked && !prior?.completed_at) {
    xp = (await awardXP(supabase, user.id, { type: "autopilot_ready" }).catch((e) => {
      console.error("autopilot_ready XP award failed:", e instanceof Error ? e.message : "unknown error");
      return null;
    }))?.xpGained;
  }
  revalidatePath("/autopilot/setup");
  return { ok: true, missing, invalid, unlocked, xp, values };
}

export async function deleteVault(): Promise<DeleteResult> {
  const { user } = await requireUser();
  if (!env.autopilot) return { ok: false, error: "Autopilot isn't switched on." };
  const db = createAdminClient();
  const packs = await db.from("autopilot_packs").delete().eq("user_id", user.id);
  if (packs.error) return { ok: false, error: "We couldn't delete your Autopilot data. Please try again." };
  const vault = await db.from("autopilot_vault").delete().eq("user_id", user.id);
  if (vault.error) return { ok: false, error: "We couldn't delete your Autopilot data. Please try again." };
  revalidatePath("/autopilot/setup");
  return { ok: true };
}

/** Forgets one remembered form answer; the next form that asks it will ask again. */
export async function forgetAnswer(key: string): Promise<{ ok: boolean }> {
  const { user } = await requireUser();
  if (!env.autopilot || typeof key !== "string" || key.length > 500) return { ok: false };
  const db = createAdminClient();
  const { data } = await db.from("autopilot_vault").select("extra").eq("user_id", user.id).maybeSingle();
  const extra = { ...openVault("extra", user.id, data?.extra) };
  if (!Object.hasOwn(extra, key)) return { ok: true };
  delete extra[key];
  const { error } = await db.from("autopilot_vault").update({ extra: sealVault("extra", user.id, extra), updated_at: new Date().toISOString() }).eq("user_id", user.id);
  if (error) return { ok: false };
  revalidatePath("/autopilot/setup");
  return { ok: true };
}
