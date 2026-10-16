import { cache } from "react";
import { ensureProfile } from "../db/functions";

/** Placed runs for one local user; every user_id column holds this id. */
export const LOCAL_USER_ID = "00000000-0000-4000-8000-000000000001";
export const LOCAL_USER_EMAIL = "you@localhost";

export type LocalUser = { id: string; email: string };

/** The local user, with the profile row ensured. Never redirects: there is no login. */
export async function getUser(): Promise<{ user: LocalUser }> {
  ensureProfile(LOCAL_USER_ID, LOCAL_USER_EMAIL);
  return { user: { id: LOCAL_USER_ID, email: LOCAL_USER_EMAIL } };
}

/** Memoised per request. Same `{ user }` shape the Supabase-era requireUser returned (minus `supabase`). */
export const requireUser = cache(getUser);
