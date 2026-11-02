import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readDesktopSettings, updateDesktopSettings } from "../../desktop/src/lib/settings-store";

const scratch = () => mkdtempSync(join(tmpdir(), "placed-settings-"));

describe("desktop.json settings store", () => {
  it("reads {} when the file is missing or corrupt", () => {
    const dir = scratch();
    expect(readDesktopSettings(dir)).toEqual({});
    writeFileSync(join(dir, "desktop.json"), "{not json");
    expect(readDesktopSettings(dir)).toEqual({});
  });

  it("merges updates into <userData>/desktop.json", () => {
    const dir = scratch();
    updateDesktopSettings(dir, { skippedVersion: "1.1.0" });
    expect(readDesktopSettings(dir)).toEqual({ skippedVersion: "1.1.0" });
    expect(JSON.parse(readFileSync(join(dir, "desktop.json"), "utf8"))).toEqual({ skippedVersion: "1.1.0" });
  });
});
