import { describe, expect, it } from "vitest";
import { GET, POST } from "@/app/api/autopilot/extension/route";
import { lastExtensionSeen, recordExtensionSeen, SEEN_FOR_MS } from "@/lib/autopilot/extension-seen";

const EXT = "chrome-extension://" + "a".repeat(32);
const post = (body: string, origin: string | null = EXT, host = "127.0.0.1:3917") =>
  new Request(`http://${host}/api/autopilot/extension`, {
    method: "POST",
    headers: { ...(origin ? { origin } : {}), host, "content-type": "application/json" },
    body,
  });
const get = (host = "127.0.0.1:3917") => new Request(`http://${host}/api/autopilot/extension`, { headers: { host } });

describe("/api/autopilot/extension", () => {
  it("records the version the extension reports and serves it back to the app", async () => {
    expect(await (await GET(get())).json()).toEqual({ seen: null });
    const r = await POST(post(JSON.stringify({ version: "0.3.3" })));
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-origin")).toBe(EXT);
    const body = (await (await GET(get())).json()) as { seen: { version: string } };
    expect(body.seen.version).toBe("0.3.3");
  });

  it("refuses web pages, the app's own origin and non-loopback hosts", async () => {
    const ok = JSON.stringify({ version: "9.9.9" });
    expect((await POST(post(ok, "https://evil.example"))).status).toBe(403);
    expect((await POST(post(ok, "http://127.0.0.1:3917"))).status).toBe(403);
    expect((await POST(post(ok, null))).status).toBe(403);
    expect((await POST(post(ok, EXT, "evil.example"))).status).toBe(403);
    expect((await GET(get("evil.example"))).status).toBe(403);
    expect(lastExtensionSeen()?.version).not.toBe("9.9.9");
  });

  it("rejects junk versions", async () => {
    for (const body of ["{", JSON.stringify({ version: "<script>" }), JSON.stringify({ version: 3 }), JSON.stringify({})]) {
      expect((await POST(post(body))).status, body).toBe(400);
    }
  });

  it("forgets a report older than a week", () => {
    const at = new Date("2026-11-01T00:00:00Z");
    recordExtensionSeen("0.3.3", at);
    expect(lastExtensionSeen(at.getTime() + SEEN_FOR_MS - 1)?.version).toBe("0.3.3");
    expect(lastExtensionSeen(at.getTime() + SEEN_FOR_MS)).toBeNull();
  });
});
