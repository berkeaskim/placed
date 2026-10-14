import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "./crypto";
import { revokeToken } from "./oauth";

/**
 * Deletes the connection, and with `revoke` the Google grant too. Used by Disconnect, by delete-my-data and when
 * Google says the grant is dead. `db` is a service-role client; the caller passes the session user's id only.
 */
export async function dropConnection(db: SupabaseClient, userId: string, revoke: boolean): Promise<void> {
  if (revoke) {
    const { data } = await db.from("gmail_connections").select("refresh_token_enc").eq("user_id", userId).maybeSingle();
    if (data) { try { await revokeToken(decryptToken(data.refresh_token_enc)); } catch { /* undecryptable: just delete */ } }
  }
  const { error } = await db.from("gmail_connections").delete().eq("user_id", userId);
  if (error && error.code !== "42P01" && error.code !== "PGRST205") throw new Error(`dropConnection failed: ${error.message}`);
}
