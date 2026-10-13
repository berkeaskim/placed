import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";

export function createAdminClient() {
  if (!env.supabaseServiceKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY missing");
  return createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
