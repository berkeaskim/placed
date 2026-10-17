import { describe, it, expect, vi } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { isLoopbackOrigin, rememberableOrigin, claimOrigins, fetchFirst } = require("../../extension/lib/origins.js");

describe("isLoopbackOrigin", () => {
  it("accepts http(s) on localhost, 127.0.0.1 and [::1], any port", () => {
    expect(isLoopbackOrigin("http://localhost:3000")).toBe(true);
    expect(isLoopbackOrigin("http://127.0.0.1:3200")).toBe(true);
    expect(isLoopbackOrigin("https://localhost")).toBe(true);
    expect(isLoopbackOrigin("http://[::1]:3000")).toBe(true);
  });
  it("rejects everything else", () => {
    for (const o of ["https://placed.app", "http://localhost.evil.com", "http://127.0.0.2:3000", "file://localhost", "chrome-extension://abc", "", "nonsense", null, 42]) {
      expect(isLoopbackOrigin(o), String(o)).toBe(false);
    }
  });
});

describe("rememberableOrigin", () => {
  it("normalises to the origin only", () => {
    expect(rememberableOrigin("http://127.0.0.1:3000")).toBe("http://127.0.0.1:3000");
    expect(rememberableOrigin("http://localhost:3000/")).toBe("http://localhost:3000");
  });
  it("is null for non-loopback or paths", () => {
    expect(rememberableOrigin("https://placed.app")).toBeNull();
    expect(rememberableOrigin("http://localhost:3000/autopilot")).toBeNull();
    expect(rememberableOrigin(undefined)).toBeNull();
  });
});

describe("claimOrigins", () => {
  it("tries the last-seen origin first, then PLACED_ORIGIN, then the rest, deduped", () => {
    expect(claimOrigins({ last: "http://127.0.0.1:3000", primary: "http://localhost:3200", list: ["http://localhost:3200", "http://127.0.0.1:3200"] }))
      .toEqual(["http://127.0.0.1:3000", "http://localhost:3200", "http://127.0.0.1:3200"]);
    expect(claimOrigins({ last: "http://localhost:3000/", primary: "http://localhost:3000", list: ["http://localhost:3000", "http://127.0.0.1:3000"] }))
      .toEqual(["http://localhost:3000", "http://127.0.0.1:3000"]);
  });
  it("works with no last-seen origin", () => {
    expect(claimOrigins({ last: null, primary: "http://localhost:3000", list: ["http://localhost:3000", "http://127.0.0.1:3000"] }))
      .toEqual(["http://localhost:3000", "http://127.0.0.1:3000"]);
  });
  it("drops non-loopback origins unless it is exactly PLACED_ORIGIN", () => {
    expect(claimOrigins({ last: "https://evil.example", primary: "https://placed.example", list: ["https://placed.example", "https://other.example", "http://localhost:3000"] }))
      .toEqual(["https://placed.example", "http://localhost:3000"]);
    expect(claimOrigins({ last: "https://evil.example", primary: "http://localhost:3000", list: ["https://other.example"] })).toEqual(["http://localhost:3000"]);
  });
  it("ignores junk", () => {
    expect(claimOrigins({ last: 7, primary: "", list: [null, "not a url", "http://localhost:3000"] })).toEqual(["http://localhost:3000"]);
    expect(claimOrigins({})).toEqual([]);
  });
});

describe("fetchFirst", () => {
  const ok = (status: number) => ({ status, ok: status >= 200 && status < 300 });
  it("moves on only when fetch throws (network error)", async () => {
    const f = vi.fn(async (url: string, init?: unknown) => {
      void init;
      if (url.startsWith("http://localhost:3200")) throw new TypeError("Failed to fetch");
      return ok(200);
    });
    const r = await fetchFirst(["http://localhost:3200", "http://127.0.0.1:3000"], "/api/autopilot/claim", { method: "POST" }, f);
    expect(r.origin).toBe("http://127.0.0.1:3000");
    expect(r.res.status).toBe(200);
    expect(f.mock.calls.map((c) => c[0])).toEqual(["http://localhost:3200/api/autopilot/claim", "http://127.0.0.1:3000/api/autopilot/claim"]);
    expect(f.mock.calls[1][1]).toEqual({ method: "POST" });
  });
  it("treats any HTTP response as final, including 403/404/410", async () => {
    for (const status of [403, 404, 410, 500]) {
      const f = vi.fn(async () => ok(status));
      const r = await fetchFirst(["http://localhost:3000", "http://127.0.0.1:3000"], "/x", {}, f);
      expect(r.origin).toBe("http://localhost:3000");
      expect(r.res.status).toBe(status);
      expect(f).toHaveBeenCalledTimes(1);
    }
  });
  it("is null when every origin fails at the network level, or there are none", async () => {
    const f = vi.fn(async () => { throw new TypeError("Failed to fetch"); });
    expect(await fetchFirst(["http://localhost:3000", "http://127.0.0.1:3000"], "/x", {}, f)).toBeNull();
    expect(f).toHaveBeenCalledTimes(2);
    expect(await fetchFirst([], "/x", {}, f)).toBeNull();
  });
});

describe("background wiring", () => {
  const bg = readFileSync("extension/background.js", "utf8");
  it("loads the origins helper and claims through it", () => {
    expect(bg).toMatch(/importScripts\(["']lib\/origins\.js["']\)/);
    expect(bg).toMatch(/claimOrigins\(/);
    expect(bg).toMatch(/fetchFirst\(/);
  });
  it("only remembers an origin the bridge reported from a top-level Placed tab, and only a loopback one", () => {
    expect(bg).toMatch(/placedLastOrigin/);
    expect(bg).toMatch(/rememberableOrigin\(/);
  });
  it("the bridge reports the origin only when the page carries the Placed app marker", () => {
    const bridge = readFileSync("extension/placed-bridge.js", "utf8");
    expect(bridge).toMatch(/meta\[name="placed-app"\]/);
    expect(bridge).toMatch(/placedSeen/);
    expect(readFileSync("app/layout.tsx", "utf8")).toMatch(/"placed-app"/);
  });
});
