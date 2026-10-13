import { describe, it, expect } from "vitest";
import { safeHttpUrl } from "@/lib/text/url";

describe("safeHttpUrl (Apply link)", () => {
  it.each([
    ["https://careers.example.com/job/1", "https://careers.example.com/job/1"],
    ["http://example.com/a?b=c", "http://example.com/a?b=c"],
    ["  https://example.com  ", "https://example.com/"],
  ])("keeps %s", (u, out) => expect(safeHttpUrl(u)).toBe(out));
  it.each(["javascript:alert(1)", "JaVaScRiPt:alert(1)", "data:text/html,hi", "vbscript:x", "/relative", "", "ftp://x.com", "not a url"])(
    "rejects %s", (u) => expect(safeHttpUrl(u)).toBeNull(),
  );
  it("rejects null/undefined", () => {
    expect(safeHttpUrl(null)).toBeNull();
    expect(safeHttpUrl(undefined)).toBeNull();
  });
});
