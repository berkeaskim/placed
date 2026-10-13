import { describe, it, expect } from "vitest";
import { todayLondon, daysUntil, isOpen, deadlineLabel, closingLabel } from "@/lib/scoring/dates";

describe("dates", () => {
  it("todayLondon uses the London calendar day (BST edge)", () => {
    expect(todayLondon(new Date("2026-10-13T23:30:00Z"))).toBe("2026-10-14"); // 00:30 BST
  });
  it("daysUntil / isOpen / labels", () => {
    expect(daysUntil("2026-10-18", "2026-10-13")).toBe(5);
    expect(isOpen("2026-10-13", "2026-10-13")).toBe(true);
    expect(isOpen("2026-10-12", "2026-10-13")).toBe(false);
    expect(isOpen(null, "2026-10-13")).toBe(true);
    expect(deadlineLabel("2026-10-13", "2026-10-13")).toBe("Closes today");
    expect(deadlineLabel("2026-10-14", "2026-10-13")).toBe("Closes tomorrow");
    expect(deadlineLabel("2026-10-18", "2026-10-13")).toBe("5 days left");
    expect(deadlineLabel(null, "2026-10-13")).toBe("Rolling deadline");
    expect(deadlineLabel("2026-10-01", "2026-10-13")).toBe("Closed");
  });
});

describe("closingLabel", () => {
  it("distinguishes rolling recruitment from an unpublished date", () => {
    expect(closingLabel({ deadline: null, rolling: true }, "2026-10-13")).toBe("Rolling: apply early");
    expect(closingLabel({ deadline: null, rolling: false }, "2026-10-13")).toBe("No closing date published");
    expect(closingLabel({ deadline: null }, "2026-10-13")).toBe("No closing date published");
    expect(closingLabel({ deadline: "2026-10-18", rolling: true }, "2026-10-13")).toBe("5 days left");
  });
});
