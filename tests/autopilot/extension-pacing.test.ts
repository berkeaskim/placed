import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const { perFieldMs, splitWords, wordStagger } = require("../../extension/lib/pacing.js");

describe("Aurora pacing", () => {
  it("gives short forms ~450ms a field and keeps long forms within ~7s of fields", () => {
    expect(perFieldMs(8)).toBe(450);
    expect(perFieldMs(15)).toBe(450);
    expect(perFieldMs(28)).toBe(250);
    for (const n of [16, 30, 40, 70]) expect(perFieldMs(n) * n, String(n)).toBeLessThanOrEqual(7000);
    expect(perFieldMs(500)).toBe(90); // floor: still visible
    expect(perFieldMs(0)).toBe(0);
  });
  it("splits words keeping the whitespace between them", () => {
    expect(splitWords("I built  a\ntracker")).toEqual(["I", " ", "built", "  ", "a", "\n", "tracker"]);
    expect(splitWords("")).toEqual([]);
    expect(splitWords(null)).toEqual([]);
  });
  it("staggers words at 45ms, tighter for long answers", () => {
    expect(wordStagger(3, 1200)).toBe(45);
    expect(wordStagger(100, 1200)).toBe(12);
    expect(wordStagger(1000, 1200)).toBe(6);
    expect(wordStagger(1, 0)).toBe(45);
  });
});

describe("Aurora wiring", () => {
  const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
  const fill = manifest.content_scripts.find((c: { js: string[] }) => c.js.includes("content.js"));
  it("loads pacing and the overlay before content.js", () => {
    const js: string[] = fill.js;
    for (const f of ["lib/pacing.js", "aurora.js"]) expect(js.indexOf(f), f).toBeGreaterThanOrEqual(0);
    expect(js.indexOf("aurora.js")).toBeLessThan(js.indexOf("content.js"));
    expect(fill.css).toEqual(["overlay.css"]);
  });
  it("the overlay lives in a shadow root on <html>, and honours reduced motion and transparency", () => {
    const src = readFileSync("extension/aurora.js", "utf8");
    expect(src).toMatch(/attachShadow\(/);
    expect(src).toMatch(/document\.documentElement\.appendChild/);
    expect(src).toMatch(/prefers-reduced-motion: reduce/);
    expect(src).toMatch(/prefers-reduced-transparency: reduce/);
    expect(src).toMatch(/placed-panel/); // e2e/autopilot.spec.ts reads the card through .placed-panel
  });
  it("keeps the data-placed states and the .placed-tag badge that the e2e audit reads", () => {
    const content = readFileSync("extension/content.js", "utf8");
    expect(content).toMatch(/box\.dataset\.placed = out === "filled" \? "filled" : out === "yours" \? "yours" : "select"/);
    expect(content).toMatch(/box\.appendChild\(ui\.makeTag\(/); // a direct child: the audit reads :scope > .placed-tag
    expect(readFileSync("extension/aurora.js", "utf8")).toMatch(/el\("span", "placed-tag"\)/);
    expect(content).toMatch(/total: fields\.length/);
    expect(readFileSync("extension/aurora.js", "utf8")).toMatch(/`\$\{filled\} of \$\{total\} filled`/);
  });
});
