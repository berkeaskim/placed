import { describe, it, expect, vi, beforeEach } from "vitest";
const claim = vi.hoisted(() => ({ impl: vi.fn() }));
vi.mock("@/lib/autopilot/server", () => ({ claimPack: claim.impl }));
import { POST, OPTIONS } from "@/app/api/autopilot/claim/route";

const req = (body: unknown, origin = "https://job-boards.greenhouse.io") =>
  new Request("http://localhost/api/autopilot/claim", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });

describe("claim route", () => {
  beforeEach(() => claim.impl.mockReset());
  it("returns the fill plan once", async () => {
    claim.impl.mockResolvedValueOnce({ status: 200, body: { ats: "greenhouse", url: "u", fields: [], cv: null } });
    const r = await POST(req({ token: "t".repeat(43) }));
    expect(r.status).toBe(200);
    expect(r.headers.get("access-control-allow-origin")).toBe("https://job-boards.greenhouse.io");
  });
  it("passes through 410 and 404", async () => {
    claim.impl.mockResolvedValueOnce({ status: 410 });
    expect((await POST(req({ token: "t".repeat(43) }))).status).toBe(410);
    claim.impl.mockResolvedValueOnce({ status: 404 });
    expect((await POST(req({ token: "t".repeat(43) }))).status).toBe(404);
  });
  it("rejects bad bodies and foreign origins", async () => {
    expect((await POST(req({ token: 5 }))).status).toBe(400);
    expect((await POST(req({ token: "t".repeat(43) }, "https://evil.example"))).status).toBe(403);
    expect(claim.impl).not.toHaveBeenCalled();
  });
  it("answers preflight", async () => {
    const r = await OPTIONS(new Request("http://localhost/api/autopilot/claim", { method: "OPTIONS", headers: { origin: "https://jobs.ashbyhq.com" } }));
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-methods")).toContain("POST");
  });
});
