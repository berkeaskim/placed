import { createClient } from "@supabase/supabase-js";

export function scriptClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [!url && "NEXT_PUBLIC_SUPABASE_URL", !key && "SUPABASE_SERVICE_ROLE_KEY"].filter(Boolean);
  if (!url || !key) {
    throw new Error(`Missing ${missing.join(" / ")}: set them in .env.local (scripts run with --env-file=.env.local)`);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
