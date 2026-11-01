import { describe, expect, it } from "vitest";
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { firstRunPlan, hasPlacedDb, importDataFolder } from "../../desktop/src/lib/data-folder";

const scratch = () => mkdtempSync(join(tmpdir(), "placed-desktop-"));

describe("hasPlacedDb", () => {
  it("is true only for a folder holding a placed.db file", () => {
    const dir = scratch();
    expect(hasPlacedDb(dir)).toBe(false);
    expect(hasPlacedDb(join(dir, "missing"))).toBe(false);
    mkdirSync(join(dir, "placed.db"));
    expect(hasPlacedDb(dir)).toBe(false); // a directory named placed.db is not a database
    const ok = scratch();
    writeFileSync(join(ok, "placed.db"), "");
    expect(hasPlacedDb(ok)).toBe(true);
  });
});

describe("firstRunPlan", () => {
  it("does nothing when the data folder already has a database", () => {
    expect(firstRunPlan({ dataHasDb: true, env: { PLACED_IMPORT_FROM: "/x", PLACED_SKIP_FIRST_RUN_DIALOG: "1" } })).toEqual({
      kind: "ready",
    });
  });

  it("imports from PLACED_IMPORT_FROM without a dialog", () => {
    expect(firstRunPlan({ dataHasDb: false, env: { PLACED_IMPORT_FROM: "/old/data" } })).toEqual({
      kind: "import",
      from: "/old/data",
    });
  });

  it("starts fresh without a dialog when PLACED_SKIP_FIRST_RUN_DIALOG=1", () => {
    expect(firstRunPlan({ dataHasDb: false, env: { PLACED_SKIP_FIRST_RUN_DIALOG: "1" } })).toEqual({ kind: "fresh" });
  });

  it("asks otherwise; an empty PLACED_IMPORT_FROM counts as unset", () => {
    expect(firstRunPlan({ dataHasDb: false, env: {} })).toEqual({ kind: "ask" });
    expect(firstRunPlan({ dataHasDb: false, env: { PLACED_IMPORT_FROM: "" } })).toEqual({ kind: "ask" });
    expect(firstRunPlan({ dataHasDb: false, env: { PLACED_SKIP_FIRST_RUN_DIALOG: "0" } })).toEqual({ kind: "ask" });
  });
});

describe("importDataFolder", () => {
  it("copies the folder recursively and leaves the original untouched", () => {
    const from = scratch();
    writeFileSync(join(from, "placed.db"), "db");
    mkdirSync(join(from, "files", "cv"), { recursive: true });
    writeFileSync(join(from, "files", "cv", "a.pdf"), "pdf");
    const to = join(scratch(), "data");

    importDataFolder(from, to);

    expect(readFileSync(join(to, "placed.db"), "utf8")).toBe("db");
    expect(readFileSync(join(to, "files", "cv", "a.pdf"), "utf8")).toBe("pdf");
    expect(readFileSync(join(from, "placed.db"), "utf8")).toBe("db");
  });

  it("refuses a folder without placed.db and refuses importing a folder into itself", () => {
    const empty = scratch();
    expect(() => importDataFolder(empty, join(scratch(), "data"))).toThrow(/placed\.db/);
    const self = scratch();
    writeFileSync(join(self, "placed.db"), "");
    expect(() => importDataFolder(self, self)).toThrow(/already/);
  });
});
