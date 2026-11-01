import { describe, it, expect } from "vitest";
import { DESKTOP_PORT, isDesktop } from "@/lib/desktop";

describe("desktop mode", () => {
  it("is off unless PLACED_DESKTOP=1", () => {
    expect(isDesktop({})).toBe(false);
    expect(isDesktop({ PLACED_DESKTOP: "0" })).toBe(false);
    expect(isDesktop({ PLACED_DESKTOP: "1" })).toBe(true);
  });

  it("uses the fixed desktop port", () => {
    expect(DESKTOP_PORT).toBe(3917);
  });
});
