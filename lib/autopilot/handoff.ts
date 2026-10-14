import { createHash, randomBytes } from "node:crypto";

export const ALLOWED_ORIGINS = ["https://job-boards.greenhouse.io", "https://boards.greenhouse.io", "https://jobs.ashbyhq.com", "https://jobs.lever.co"] as const;
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export function mintToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token), expiresAt: new Date(Date.now() + 10 * 60_000).toISOString() };
}
export function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !(ALLOWED_ORIGINS as readonly string[]).includes(origin)) return {};
  return { "access-control-allow-origin": origin, "access-control-allow-methods": "POST, OPTIONS", "access-control-allow-headers": "content-type", vary: "origin" };
}
