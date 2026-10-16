import { describe, expect, it } from "vitest";
import { normalizeEmail, passwordProblem } from "@/lib/auth/validate";

describe("normalizeEmail", () => {
  it("trims and lowercases a real address", () => {
    expect(normalizeEmail("  Berke.O@UCL.ac.uk ")).toBe("berke.o@ucl.ac.uk");
  });
  it("rejects junk, injection-looking and oversized input", () => {
    for (const v of ["", "a", "a@b", "a@@b.com", "x' OR 1=1 --@a.com", "<script>@a.com", "a b@c.com", `${"a".repeat(250)}@b.com`, null, 42, ["a@b.com"]])
      expect(normalizeEmail(v)).toBeNull();
  });
});

describe("passwordProblem", () => {
  it("accepts 8 to 72 bytes", () => {
    expect(passwordProblem("12345678")).toBeNull();
    expect(passwordProblem("a".repeat(72))).toBeNull();
  });
  it("rejects short, over-72-byte (bcrypt would truncate) and non-string passwords", () => {
    expect(passwordProblem("short")).toMatch(/at least 8/);
    expect(passwordProblem("a".repeat(73))).toMatch(/at most 72/);
    expect(passwordProblem("ş".repeat(37))).toMatch(/at most 72/); // 74 bytes
    expect(passwordProblem(null)).toMatch(/at least 8/);
  });
});
