import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { readFileSync, readdirSync } from "node:fs";
const require = createRequire(import.meta.url);
const { summarize, fileFor } = require("../../extension/lib/fill-plan.js");
const { wantedJobId, pageMatches } = require("../../extension/lib/job-match.js");
const { extractToken } = require("../../extension/capture.js");

describe("extension job match", () => {
  const GH = "https://job-boards.greenhouse.io/monzo/jobs/123";
  const UUID = "2993de0d-80fd-4dff-a708-c16fa593df41";
  it("extracts the job id from greenhouse, ashby and lever urls", () => {
    expect(wantedJobId(GH)).toBe("123");
    expect(wantedJobId(`https://jobs.ashbyhq.com/org/${UUID.toUpperCase()}/application`)).toBe(UUID);
    expect(wantedJobId(`https://jobs.lever.co/site/${UUID}/apply`)).toBe(UUID);
    expect(wantedJobId("https://example.com/")).toBeNull();
  });
  it("matches whole path segments only: job 123 does not fill /jobs/12345", () => {
    expect(pageMatches("123", "/monzo/jobs/123", "")).toBe(true);
    expect(pageMatches("123", "/monzo/jobs/12345", "")).toBe(false);
    expect(pageMatches("123", "/monzo/jobs/4123", "")).toBe(false);
    expect(pageMatches("123", "/monzo/jobs/9999", "?foo=123456")).toBe(false);
  });
  it("accepts the id as a whole query value (embedded Greenhouse token/gh_jid)", () => {
    expect(pageMatches("123", "/embed/job_app", "?for=monzo&token=123")).toBe(true);
    expect(pageMatches("123", "/embed/job_app", "?token=1234")).toBe(false);
  });
  it("matches uuid segments case-insensitively and rejects a missing id", () => {
    expect(pageMatches(UUID, `/org/${UUID.toUpperCase()}/application`, "")).toBe(true);
    expect(pageMatches(null, "/anything", "")).toBe(false);
  });
});

describe("extension", () => {
  it("summarises a plan", () => {
    expect(summarize([{ mode: "fill" }, { mode: "fill" }, { mode: "yours" }, { mode: "select-yourself" }])).toEqual({ fill: 2, yours: 1, select: 1 });
  });
  it("a cover file field picks coverFile, a CV field picks cvFile, and a missing file is null", () => {
    const ctx = { cvFile: "CV", coverFile: "COVER" };
    expect(fileFor({ type: "file", asset: "cover" }, ctx)).toBe("COVER");
    expect(fileFor({ type: "file", asset: "cv" }, ctx)).toBe("CV");
    expect(fileFor({ type: "file" }, ctx)).toBe("CV");
    expect(fileFor({ type: "file", asset: "cover" }, { cvFile: "CV", coverFile: null })).toBeNull();
  });
  it("cover files travel the same capped, same-origin path as the CV, and every filler uses fileFor", () => {
    const bg = readFileSync("extension/background.js", "utf8");
    expect(bg).toMatch(/body\.cover/);
    expect(bg).toMatch(/return \{ status: 200, plan, cv, cover \}/);
    expect(readFileSync("extension/content.js", "utf8")).toMatch(/coverFile/);
    for (const a of ["greenhouse", "lever", "ashby"]) expect(readFileSync(`extension/fillers/${a}.js`, "utf8"), a).toMatch(/PlacedFillPlan\.fileFor\(field, ctx\)/);
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
  it("manifest host_permissions are only the local Placed app, with no wildcards", () => {
    const hp: string[] = JSON.parse(readFileSync("extension/manifest.json", "utf8")).host_permissions;
    expect(hp.sort()).toEqual(["http://127.0.0.1/*", "http://localhost/*"]);
    expect(readFileSync("extension/config.js", "utf8")).toMatch(/PLACED_ORIGIN = "http:\/\/localhost:3000"/);
  });
  it("the CV is fetched only from the Placed origin's /api/files/", () => {
    const bg = readFileSync("extension/background.js", "utf8");
    expect(bg).toMatch(/url\.origin === placedOrigin\(\) && url\.pathname\.startsWith\("\/api\/files\/"\)/);
  });
  it("background loads the CDP geometry helper", () => {
    expect(readFileSync("extension/background.js", "utf8")).toMatch(/importScripts\(["']lib\/geometry\.js["']\)/);
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
