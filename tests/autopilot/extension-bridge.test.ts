import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const ORIGINS_JS = readFileSync("extension/lib/origins.js", "utf8");
const BRIDGE_JS = readFileSync("extension/placed-bridge.js", "utf8");
const TOKEN = `${"a".repeat(24)}.${"b".repeat(43)}`;

/** Runs config-less placed-bridge.js on a fake page and returns what it did. */
function runBridge(origin: string, { marker = true } = {}) {
  const sent: Array<{ kind: string }> = [];
  const posted: unknown[] = [];
  let onMessage: ((e: unknown) => void) | null = null;
  const html = { dataset: {} as Record<string, string> };
  const win = {
    addEventListener: (type: string, fn: (e: unknown) => void) => { if (type === "message") onMessage = fn; },
    postMessage: (m: unknown) => posted.push(m),
  };
  const g: Record<string, unknown> = {
    URL,
    location: { origin },
    window: win,
    document: {
      readyState: "complete",
      documentElement: html,
      querySelector: () => (marker ? {} : null),
      addEventListener: () => {},
    },
    chrome: {
      runtime: {
        id: "ext",
        lastError: undefined,
        getManifest: () => ({ version: "9.9.9" }),
        sendMessage: (msg: { kind: string }, cb?: (r: unknown) => void) => { sent.push(msg); cb?.({ ok: true }); },
        onMessage: { addListener: () => {} },
      },
    },
  };
  g.globalThis = g;
  vm.runInNewContext(ORIGINS_JS, g);
  vm.runInNewContext(BRIDGE_JS, g);
  const arm = () => onMessage?.({ source: win, origin, data: { type: "placed:linkedin-arm", token: TOKEN } });
  return { html, sent, posted, arm };
}

describe("placed-bridge.js", () => {
  it.each(["http://127.0.0.1:3917", "http://localhost:3000", "http://localhost:3200"])(
    "stamps the page and passes a LinkedIn ticket on any loopback port (%s), without config.js",
    (origin) => {
      const b = runBridge(origin);
      expect(b.html.dataset.placedExtension).toBe("9.9.9");
      b.arm();
      expect(b.sent.map((m) => m.kind)).toContain("liArm");
    },
  );

  it("ignores a ticket from a loopback page that is not the Placed app", () => {
    const b = runBridge("http://localhost:8080", { marker: false });
    b.arm();
    expect(b.sent.map((m) => m.kind)).not.toContain("liArm");
  });

  it("does nothing beyond the Placed-seen report off loopback", () => {
    const b = runBridge("http://192.168.1.5:3000");
    expect(b.html.dataset.placedExtension).toBeUndefined();
    b.arm();
    expect(b.sent.map((m) => m.kind)).not.toContain("liArm");
  });
});

describe("manifest.json", () => {
  it("loads lib/origins.js before placed-bridge.js", () => {
    const m = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
    const js: string[] = m.content_scripts.find((c: { js: string[] }) => c.js.includes("placed-bridge.js")).js;
    expect(js.indexOf("lib/origins.js")).toBeGreaterThanOrEqual(0);
    expect(js.indexOf("lib/origins.js")).toBeLessThan(js.indexOf("placed-bridge.js"));
  });
});
