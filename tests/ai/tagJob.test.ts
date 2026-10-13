import { describe, it, expect } from "vitest";
import { normalizeDeadline } from "@/lib/ai/tagJob";

describe("normalizeDeadline", () => {
  it("keeps real calendar dates", () => {
    expect(normalizeDeadline("2026-11-30")).toBe("2026-11-30");
    expect(normalizeDeadline("2028-02-29")).toBe("2028-02-29");
  });
  it("rejects impossible or malformed dates", () => {
    for (const d of ["2026-02-31", "2026-13-01", "2027-02-29", "30/11/2026", "", null]) {
      expect(normalizeDeadline(d)).toBeNull();
    }
  });
});
