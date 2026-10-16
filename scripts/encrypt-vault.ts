/**
 * One-off backfill: seals autopilot_vault rows written before at-rest encryption (lib/autopilot/vault-crypto.ts).
 * Dry run by default; pass --apply to write. Idempotent: already-sealed columns are skipped, and each update is
 * conditioned on the row's updated_at so a concurrent save from the app is never overwritten.
 *   npm run vault:encrypt            # report only
 *   npm run vault:encrypt -- --apply
 */
import { scriptClient } from "./db";
import { isSealed, sealVault } from "@/lib/autopilot/vault-crypto";

async function main() {
  const apply = process.argv.includes("--apply");
  if (!process.env.VAULT_ENC_KEY) throw new Error("VAULT_ENC_KEY is not set in .env.local (it must match the deployed key)");
  const db = scriptClient();
  const { data, error } = await db.from("autopilot_vault").select("user_id, core, extra, updated_at");
  if (error) throw new Error(`couldn't read autopilot_vault: ${error.message}`);
  let todo = 0, done = 0, skipped = 0;
  for (const r of data ?? []) {
    if (isSealed(r.core) && isSealed(r.extra)) continue;
    todo++;
    if (!apply) continue;
    const patch = {
      core: isSealed(r.core) ? r.core : sealVault("core", r.user_id, (r.core ?? {}) as Record<string, unknown>),
      extra: isSealed(r.extra) ? r.extra : sealVault("extra", r.user_id, (r.extra ?? {}) as Record<string, unknown>),
    };
    const { data: hit, error: e } = await db.from("autopilot_vault").update(patch).eq("user_id", r.user_id).eq("updated_at", r.updated_at).select("user_id");
    if (e) throw new Error(`update failed for one row: ${e.message}`);
    if (hit?.length) done++; else skipped++; // changed underneath us: the app's own save already sealed it
  }
  console.log(`${data?.length ?? 0} vault rows, ${todo} with plaintext${apply ? `: ${done} encrypted, ${skipped} skipped (changed concurrently)` : " (dry run, pass --apply)"}`);
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
