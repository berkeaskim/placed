import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { compareVersions, extensionStatus, outdatedNotice, SHIPPED_EXTENSION_VERSION } from "@/lib/autopilot/extension-version";

describe("compareVersions", () => {
  it("compares numerically, part by part", () => {
    expect(compareVersions("0.2.0", "0.3.0")).toBeLessThan(0);
    expect(compareVersions("0.10.0", "0.9.9")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("0.3", "0.3.0")).toBe(0);
    expect(compareVersions("0.3.1", "0.3")).toBeGreaterThan(0);
  });
  it("treats junk parts as 0", () => {
    expect(compareVersions("abc", "0.0.0")).toBe(0);
    expect(compareVersions("", "0.0.1")).toBeLessThan(0);
  });
});

describe("extensionStatus", () => {
  it("is missing with no stamp, outdated when older than shipped, installed otherwise", () => {
    expect(extensionStatus(null, "0.3.0")).toBe("missing");
    expect(extensionStatus("0.2.0", "0.3.0")).toBe("outdated");
    expect(extensionStatus("0.3.0", "0.3.0")).toBe("installed");
    expect(extensionStatus("0.4.0", "0.3.0")).toBe("installed"); // a newer dev build is fine
  });
  it("an empty or unparseable stamp still counts as installed but outdated", () => {
    expect(extensionStatus("", "0.3.0")).toBe("outdated");
  });
});

describe("copy", () => {
  it("names both versions", () => {
    expect(outdatedNotice("0.2.0", "0.3.0")).toBe("Your Placed extension is out of date (0.2.0 → 0.3.0). Download the new version");
  });
  it("ships the manifest version, at least the first version with the outdated notice (0.3.0)", () => {
    const manifest = JSON.parse(readFileSync("extension/manifest.json", "utf8"));
    expect(SHIPPED_EXTENSION_VERSION).toBe(manifest.version);
    expect(compareVersions(manifest.version, "0.3.0")).toBeGreaterThanOrEqual(0);
  });
  it("the install card and the Open & fill hint both use the outdated state", () => {
    const src = readFileSync("components/autopilot/extension-install.tsx", "utf8");
    expect(src).toMatch(/outdatedNotice\(/);
    expect(src.match(/<Outdated /g)?.length, "setup card + Open & fill hint").toBe(2);
    expect(src).toMatch(/installed ✓/);
  });
});
