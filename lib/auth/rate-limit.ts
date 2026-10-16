import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Attempt limits for the email/password forms. Supabase Auth's own per-IP limit sees every server action as coming
 * from Vercel, so it can't tell attackers from students; this limits by the real client IP and by the target email.
 * Backed by hit_rate_limit() (0016). Fails open (with a warning) if the database call fails, so a missing migration
 * never locks everyone out.
 */
export const LIMITS = {
  loginEmail: { max: 5, windowSeconds: 15 * 60 },
  loginIp: { max: 30, windowSeconds: 15 * 60 },
  saveIp: { max: 10, windowSeconds: 60 * 60 },
  otpIp: { max: 5, windowSeconds: 15 * 60 },
} as const;
export type LimitName = keyof typeof LIMITS;

const hash = (s: string) => createHash("sha256").update(s).digest("hex");

/** Vercel sets x-real-ip / x-forwarded-for to the real client; the first forwarded hop is the client. */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export const limitKey = (name: LimitName, subject: string) => `${name}:${hash(subject.toLowerCase())}`;

/** true = allowed. Each call counts as one attempt. */
export async function allow(name: LimitName, subject: string): Promise<boolean> {
  const { max, windowSeconds } = LIMITS[name];
  const { data, error } = await createAdminClient().rpc("hit_rate_limit", { p_key: limitKey(name, subject), p_max: max, p_window_seconds: windowSeconds });
  if (error) {
    console.warn("rate limit unavailable (is 0016 applied?):", error.message);
    return true;
  }
  return data !== false;
}
