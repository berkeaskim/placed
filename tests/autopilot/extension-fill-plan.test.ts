import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { summarize } = require("../../extension/lib/fill-plan.js");
const { extractToken } = require("../../extension/capture.js");

describe("extension", () => {
  it("summarises a plan", () => {
    expect(summarize([{ mode: "fill" }, { mode: "fill" }, { mode: "yours" }, { mode: "select-yourself" }])).toEqual({ fill: 2, yours: 1, select: 1 });
  });
  it("contains no submit calls or synthetic input anywhere outside lib/guard.js", () => {
    const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : e.name.endsWith(".js") ? [`${d}/${e.name}`] : []));
    const files = walk("extension").filter((f) => f !== "extension/lib/guard.js");
    expect(files.length).toBeGreaterThan(8);
    const banned = [
      /\.submit\(/, /requestSubmit/, /type=["']?submit["']?\]?\)?\.click/,
      /\.click\(\)/, // all clicks go through PlacedGuard.safeClick
      /\.click\.call\(/, /\[["']click["']\]\(/,
      /dispatchEvent\(\s*new\s+(MouseEvent|PointerEvent|KeyboardEvent)/,
      /Input\.dispatchKeyEvent/, /["']Enter["']/,
    ];
    for (const f of files) {
      const src = readFileSync(f, "utf8");
      for (const re of banned) expect(src, `${f} ${re}`).not.toMatch(re);
    }
  });
  it("never reads the token from location.hash outside capture.js", () => {
    for (const f of ["content.js", "background.js"]) expect(readFileSync(`extension/${f}`, "utf8"), f).not.toMatch(/location\.hash/);
  });
  it("R8: the claim and CV download live in the service worker, never in a content script", () => {
    expect(readFileSync("extension/content.js", "utf8")).not.toMatch(/fetch\(/);
    expect(readFileSync("extension/lib/dom.js", "utf8")).not.toMatch(/fetch\(/);
    const bg = readFileSync("extension/background.js", "utf8");
    expect(bg).toMatch(/importScripts\(["']config\.js["']\)/);
    expect(bg).toMatch(/\/api\/autopilot\/claim/);
    expect(bg).not.toMatch(/console\.\w+\([^)]*token/); // never log the token
  });
  it("manifest host_permissions are only the Placed app and Supabase storage", () => {
    const m = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
    expect(m.host_permissions).toEqual(["http://localhost:3200/*", "https://*.supabase.co/*"]);
  });
});

describe("token capture (R5)", () => {
  const t = "A".repeat(42) + "_";
  it("extracts a 43-char base64url token from the fragment", () => {
    expect(extractToken(`#placed=${t}`)).toBe(t);
    expect(extractToken(`#foo=1&placed=${t}`)).toBe(t);
  });
  it("rejects anything else", () => {
    expect(extractToken("")).toBeNull();
    expect(extractToken("#placed=short")).toBeNull();
    expect(extractToken(`#placed=${t}x`)).toBeNull();
    expect(extractToken(`#placed=${"A".repeat(42)}+`)).toBeNull();
  });
});
