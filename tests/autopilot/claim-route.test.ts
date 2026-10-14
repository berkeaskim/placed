import { describe, it, expect, vi, beforeEach } from "vitest";
const claim = vi.hoisted(() => ({ impl: vi.fn() }));
vi.mock("@/lib/autopilot/server", () => ({ claimPack: claim.impl }));
import { POST, OPTIONS } from "@/app/api/autopilot/claim/route";

const EXT = "chrome-extension://" + "a".repeat(32);
const req = (body: unknown, origin = EXT) =>
  new Request("http://localhost/api/autopilot/claim", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });

describe("claim route", () => {
  beforeEach(() => claim.impl.mockReset());
  it("returns the fill plan once", async () => {
    claim.impl.mockResolvedValueOnce({ status: 200, body: { ats: "greenhouse", url: "u", fields: [], cv: null } });
    const r = await POST(req({ token: "t".repeat(43) }));
    expect(r.status).toBe(200);
    expect(r.headers.get("access-control-allow-origin")).toBe(EXT);
  });
  it("accepts the Placed extension's service-worker origin (R8)", async () => {
    const ext = "chrome-extension://" + "a".repeat(32);
    claim.impl.mockResolvedValueOnce({ status: 200, body: { ats: "ashby", url: "u", fields: [], cv: null } });
    const r = await POST(req({ token: "t".repeat(43) }, ext));
    expect(r.status).toBe(200);
    expect(r.headers.get("access-control-allow-origin")).toBe(ext);
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
    expect((await POST(req({ token: "t".repeat(43) }, "https://job-boards.greenhouse.io"))).status).toBe(403); // R9: ATS page origins can't claim
    expect(claim.impl).not.toHaveBeenCalled();
  });
  it("answers preflight", async () => {
    const r = await OPTIONS(new Request("http://localhost/api/autopilot/claim", { method: "OPTIONS", headers: { origin: EXT } }));
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-methods")).toContain("POST");
    const ats = await OPTIONS(new Request("http://localhost/api/autopilot/claim", { method: "OPTIONS", headers: { origin: "https://jobs.ashbyhq.com" } }));
    expect(ats.headers.get("access-control-allow-origin")).toBeNull();
  });
});
