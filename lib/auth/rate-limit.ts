import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";

/**
 * In-memory sliding-window attempt limits (port of 0016 hit_rate_limit). Placed runs as one local process, so a Map
 * is enough; it resets on restart.
 */
export const LIMITS = {
  loginEmail: { max: 5, windowSeconds: 15 * 60 },
  loginIp: { max: 30, windowSeconds: 15 * 60 },
  saveIp: { max: 10, windowSeconds: 60 * 60 },
  otpIp: { max: 5, windowSeconds: 15 * 60 },
} as const;
export type LimitName = keyof typeof LIMITS;

const hash = (s: string) => createHash("sha256").update(s).digest("hex");
const DAY_MS = 24 * 60 * 60 * 1000;
const attempts = new Map<string, number[]>();

export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-real-ip")?.trim() || h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export const limitKey = (name: LimitName, subject: string) => `${name}:${hash(subject.toLowerCase())}`;

/** true = allowed. Each call counts as one attempt, refused ones included. */
export async function allow(name: LimitName, subject: string, now = Date.now()): Promise<boolean> {
  const { max, windowSeconds } = LIMITS[name];
  const key = limitKey(name, subject);
  for (const [k, ts] of attempts) if (ts[ts.length - 1] < now - DAY_MS) attempts.delete(k); // keys that never come back
  const recent = (attempts.get(key) ?? []).filter((t) => t >= now - windowSeconds * 1000);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length <= max;
}

export function resetRateLimitsForTests(): void {
  attempts.clear();
}
