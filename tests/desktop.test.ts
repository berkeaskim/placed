import { describe, it, expect } from "vitest";
import { DESKTOP_PORT, isDesktop, loginChangeMessage } from "@/lib/desktop";

describe("desktop mode", () => {
  it("is off unless PLACED_DESKTOP=1", () => {
    expect(isDesktop({})).toBe(false);
    expect(isDesktop({ PLACED_DESKTOP: "0" })).toBe(false);
    expect(isDesktop({ PLACED_DESKTOP: "1" })).toBe(true);
  });

  it("uses the fixed desktop port", () => {
    expect(DESKTOP_PORT).toBe(3917);
  });

  it("login item: asks for approval when macOS 13+ needs it, else flags a change that didn't stick", () => {
    expect(loginChangeMessage(true, { openAtLogin: true, needsApproval: false })).toBeNull();
    expect(loginChangeMessage(false, { openAtLogin: false, needsApproval: false })).toBeNull();
    expect(loginChangeMessage(true, { openAtLogin: false, needsApproval: true })).toMatch(/System Settings → General → Login Items/);
    expect(loginChangeMessage(true, { openAtLogin: true, needsApproval: true })).toMatch(/Approve Placed/);
    expect(loginChangeMessage(true, { openAtLogin: false, needsApproval: false })).toBe("macOS didn't accept that change.");
    expect(loginChangeMessage(false, { openAtLogin: true, needsApproval: false })).toBe("macOS didn't accept that change.");
  });
});
