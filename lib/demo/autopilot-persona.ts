import type { SupabaseClient } from "@supabase/supabase-js";
import { CoreSchema, isComplete, type Core } from "@/lib/autopilot/vault";
import { sealVault } from "@/lib/autopilot/vault-crypto";

/**
 * The FICTIONAL demo persona Ayşe Demir's Autopilot Answer Vault: the same values e2e/autopilot.spec.ts types into
 * /autopilot/setup. demo:reset re-seeds it (lib/db/reset.ts wipes autopilot_vault) so demo step 10 starts at the pack,
 * not at "Set up Autopilot first". Right to work and sponsorship are Ayşe's own (fictional) answers, nothing is assumed.
 */
export const AYSE_VAULT_CORE: Core = {
  first_name: "Ayşe", last_name: "Demir", email: "ayse.demir.demo@example.com", phone: "+44 7700 900123",
  university: "University College London", degree: "BSc Economics", year_of_study: "2nd",
  grad_month: "June", grad_year: "2028", country: "United Kingdom", city: "London",
  rtw_uk: "citizen_or_settled", needs_sponsorship: "no", start_date: "2027-06-01", heard_about: "Placed",
};

/** Idempotent. completed_at is set so no "Autopilot ready" XP fires on stage. Service-role client only (the table has no write policy). */
export async function seedAyseVault(db: SupabaseClient, userId: string, now = new Date()): Promise<void> {
  if (!isComplete(AYSE_VAULT_CORE)) throw new Error("AYSE_VAULT_CORE no longer satisfies CoreSchema");
  const core = CoreSchema.parse(AYSE_VAULT_CORE);
  const { error } = await db.from("autopilot_vault").upsert(
    { user_id: userId, core: sealVault("core", userId, core), extra: sealVault("extra", userId, {}), completed_at: now.toISOString(), updated_at: now.toISOString() },
    { onConflict: "user_id" },
  );
  if (error) throw new Error(`couldn't seed Ayşe's Autopilot setup: ${error.message}`);
}
