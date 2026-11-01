import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { LOG_ROTATE_BYTES, prepareLogFile, shouldRotate, tailLines } from "../../desktop/src/lib/log-file";

describe("shouldRotate", () => {
  it("rotates only when the log is larger than 5 MB", () => {
    expect(LOG_ROTATE_BYTES).toBe(5 * 1024 * 1024);
    expect(shouldRotate(0)).toBe(false);
    expect(shouldRotate(LOG_ROTATE_BYTES)).toBe(false);
    expect(shouldRotate(LOG_ROTATE_BYTES + 1)).toBe(true);
  });
});

describe("tailLines", () => {
  it("returns the last n non-empty-trailing lines", () => {
    const text = Array.from({ length: 30 }, (_, i) => `line ${i + 1}`).join("\n") + "\n";
    const tail = tailLines(text, 20);
    expect(tail.split("\n")).toHaveLength(20);
    expect(tail.startsWith("line 11")).toBe(true);
    expect(tail.endsWith("line 30")).toBe(true);
  });

  it("handles short and empty logs", () => {
    expect(tailLines("only\n", 20)).toBe("only");
    expect(tailLines("", 20)).toBe("");
  });
});

describe("prepareLogFile", () => {
  it("creates the logs folder and truncates an oversized log, keeps a small one", () => {
    const dir = join(mkdtempSync(join(tmpdir(), "placed-logs-")), "logs");
    const file = prepareLogFile(dir, "server.log");
    expect(file).toBe(join(dir, "server.log"));

    writeFileSync(file, "keep me\n");
    prepareLogFile(dir, "server.log");
    expect(readFileSync(file, "utf8")).toBe("keep me\n");

    writeFileSync(file, Buffer.alloc(LOG_ROTATE_BYTES + 1, 97));
    prepareLogFile(dir, "server.log");
    expect(readFileSync(file, "utf8")).toBe("");
  });
});
