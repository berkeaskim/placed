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
  it("contains no submit calls anywhere in its source", () => {
    const files = ["content.js", "background.js", "capture.js", "lib/dom.js", ...readdirSync("extension/fillers").map((f) => `fillers/${f}`)];
    for (const f of files) {
      const src = readFileSync(`extension/${f}`, "utf8");
      expect(src, f).not.toMatch(/\.submit\(|requestSubmit|type=["']?submit["']?\]?\)?\.click/);
      expect(src, f).not.toMatch(/\.click\(\)/); // all clicks go through PlacedGuard.safeClick
    }
  });
  it("never reads the token from location.hash outside capture.js", () => {
    for (const f of ["content.js", "background.js"]) expect(readFileSync(`extension/${f}`, "utf8"), f).not.toMatch(/location\.hash/);
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
