import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const admin = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ requireUser: async () => ({ supabase: {}, user: { id: "demo-user", email: "Demo@Placed.test" } }) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => admin() }));

const { GET: connect } = await import("@/app/api/gmail/connect/route");
const { GET: callback } = await import("@/app/api/gmail/callback/route");

describe("Gmail routes for the demo account", () => {
  const env = { ...process.env };
  beforeAll(() => { process.env.DEMO_EMAIL = "demo@placed.test"; process.env.GOOGLE_CLIENT_ID = "cid"; });
  afterAll(() => { process.env = env; });

  it("connect redirects to the tracker without starting OAuth", async () => {
    const res = await connect(new NextRequest("http://localhost:3200/api/gmail/connect"));
    expect(res.headers.get("location")).toBe("http://localhost:3200/tracker?gmail=demo");
    expect(res.cookies.get("gmail_oauth_state")).toBeUndefined();
  });

  it("callback stores nothing even with a matching state", async () => {
    const req = new NextRequest("http://localhost:3200/api/gmail/callback?state=s&code=c", { headers: { cookie: "gmail_oauth_state=s" } });
    const res = await callback(req);
    expect(res.headers.get("location")).toBe("http://localhost:3200/tracker?gmail=demo");
    expect(admin).not.toHaveBeenCalled();
  });
});
