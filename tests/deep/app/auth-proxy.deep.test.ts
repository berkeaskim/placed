import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const s = vi.hoisted(() => ({
  exchange: null as null | ((code: string) => Promise<unknown>),
  onboarded: false as boolean | null,
  user: null as null | { id: string },
}));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { exchangeCodeForSession: (c: string) => s.exchange!(c) },
    from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: s.onboarded === null ? null : { onboarded: s.onboarded } }) }) }) }),
  }),
}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({ auth: { getClaims: async () => ({ data: s.user ? { claims: { sub: s.user.id } } : null }) } }),
}));

import { GET as callback } from "@/app/auth/callback/route";
import { proxy, config } from "@/proxy";
import nextConfig from "@/next.config";

beforeEach(() => {
  s.exchange = vi.fn(async () => ({ data: { user: { id: "u1" } }, error: null }));
  s.onboarded = false;
  s.user = null;
});

const loc = (r: Response) => r.headers.get("location");

describe("/auth/callback", () => {
  it("no code → /login?error=link without calling Supabase", async () => {
    const r = await callback(new Request("https://placed.test/auth/callback"));
    expect(loc(r)).toBe("https://placed.test/login?error=link");
    expect(s.exchange).not.toHaveBeenCalled();
  });
  it("exchange error, no user, or a thrown exchange → /login?error=link", async () => {
    s.exchange = vi.fn(async () => ({ data: { user: null }, error: { message: "bad code" } }));
    expect(loc(await callback(new Request("https://placed.test/auth/callback?code=x")))).toBe("https://placed.test/login?error=link");
    s.exchange = vi.fn(async () => ({ data: { user: null }, error: null }));
    expect(loc(await callback(new Request("https://placed.test/auth/callback?code=x")))).toBe("https://placed.test/login?error=link");
    s.exchange = vi.fn(async () => { throw new Error("network"); });
    expect(loc(await callback(new Request("https://placed.test/auth/callback?code=x")))).toBe("https://placed.test/login?error=link");
  });
  it("routes onboarded users to /feed, others (or missing profile) to /onboarding", async () => {
    s.onboarded = true;
    expect(loc(await callback(new Request("https://placed.test/auth/callback?code=c")))).toBe("https://placed.test/feed");
    s.onboarded = false;
    expect(loc(await callback(new Request("https://placed.test/auth/callback?code=c")))).toBe("https://placed.test/onboarding");
    s.onboarded = null;
    expect(loc(await callback(new Request("https://placed.test/auth/callback?code=c")))).toBe("https://placed.test/onboarding");
  });
  it("is not an open redirect: next/redirect_to params are ignored and the origin is preserved", async () => {
    for (const q of ["next=https://evil.example", "redirect_to=//evil.example", "next=%2F%2Fevil.example"]) {
      const r = await callback(new Request(`https://placed.test/auth/callback?code=c&${q}`));
      expect(new URL(loc(r)!).origin).toBe("https://placed.test");
    }
  });
});

describe("proxy (auth gate)", () => {
  const run = (path: string) => proxy(new NextRequest(`https://placed.test${path}`));
  it.each(["/onboarding", "/profile", "/profile/build", "/feed", "/jobs/123", "/tracker", "/settings"])("anonymous %s → /login", async (p) => {
    const r = await run(p);
    expect(loc(r)).toBe("https://placed.test/login");
  });
  it.each(["/", "/login", "/auth/callback"])("anonymous %s passes through", async (p) => {
    expect(loc(await run(p))).toBeNull();
  });
  it("signed-in users pass through protected routes", async () => {
    s.user = { id: "u1" };
    expect(loc(await run("/feed"))).toBeNull();
  });
  it("matcher excludes /api/ingest (it authenticates by CRON_SECRET) and static assets, but not other pages", () => {
    const re = new RegExp(`^${config.matcher[0]}$`);
    expect(re.test("/api/ingest")).toBe(false);
    expect(re.test("/_next/static/x.js")).toBe(false);
    expect(re.test("/logo.svg")).toBe(false);
    expect(re.test("/feed")).toBe(true);
    expect(re.test("/profile/build")).toBe(true);
  });
});

describe("next.config", () => {
  it("server action body limit leaves headroom above the 4 MB CV cap (multipart overhead) within Vercel's 4.5 MB", () => {
    const limit = String(nextConfig.experimental?.serverActions?.bodySizeLimit ?? "1mb");
    const m = /^(\d+(?:\.\d+)?)\s*(kb|mb)$/i.exec(limit);
    const bytes = m ? Number(m[1]) * (m[2].toLowerCase() === "mb" ? 1024 * 1024 : 1024) : Number(limit);
    expect(bytes).toBeGreaterThan(4 * 1024 * 1024);
    expect(bytes).toBeLessThanOrEqual(4.5 * 1024 * 1024);
  });
});
