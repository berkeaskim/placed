import { describe, expect, it } from "vitest";
import { join } from "node:path";
import { uniqueDownloadPath } from "../../desktop/src/lib/download-path";

describe("uniqueDownloadPath", () => {
  it("uses the suggested name when it is free", () => {
    expect(uniqueDownloadPath("/dl", "cv.pdf", () => false)).toBe(join("/dl", "cv.pdf"));
  });

  it("never overwrites: appends (1), (2)… before the extension", () => {
    const taken = new Set([join("/dl", "cv.pdf"), join("/dl", "cv (1).pdf")]);
    expect(uniqueDownloadPath("/dl", "cv.pdf", (p) => taken.has(p))).toBe(join("/dl", "cv (2).pdf"));
    expect(uniqueDownloadPath("/dl", "README", (p) => p === join("/dl", "README"))).toBe(join("/dl", "README (1)"));
  });

  it("strips any folder part from the suggested name and falls back to 'download'", () => {
    expect(uniqueDownloadPath("/dl", "../../etc/passwd", () => false)).toBe(join("/dl", "passwd"));
    expect(uniqueDownloadPath("/dl", "", () => false)).toBe(join("/dl", "download"));
  });
});
