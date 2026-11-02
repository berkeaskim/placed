import { describe, expect, it } from "vitest";
import { toLoginItemResult } from "../../desktop/src/lib/login-item";

describe("toLoginItemResult", () => {
  it("flags requires-approval (macOS 13+)", () => {
    expect(toLoginItemResult({ openAtLogin: false, status: "requires-approval" })).toEqual({ openAtLogin: false, needsApproval: true });
  });

  it("enabled, not-registered and a missing status (older macOS) need no approval", () => {
    expect(toLoginItemResult({ openAtLogin: true, status: "enabled" })).toEqual({ openAtLogin: true, needsApproval: false });
    expect(toLoginItemResult({ openAtLogin: false, status: "not-registered" })).toEqual({ openAtLogin: false, needsApproval: false });
    expect(toLoginItemResult({ openAtLogin: true })).toEqual({ openAtLogin: true, needsApproval: false });
  });
});
