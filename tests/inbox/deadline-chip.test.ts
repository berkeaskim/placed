import { describe, expect, it } from "vitest";
import { deadlineLabel, showDeadline } from "@/components/tracker/deadline-chip";

describe("deadlineLabel", () => {
  it("counts days and marks under 48 hours urgent", () => {
    expect(deadlineLabel("2026-10-14", "2026-10-14")).toEqual({ text: "due today", urgent: true });
    expect(deadlineLabel("2026-10-15", "2026-10-14")).toEqual({ text: "1 day left", urgent: true });
    expect(deadlineLabel("2026-10-16", "2026-10-14")).toEqual({ text: "2 days left", urgent: false });
    expect(deadlineLabel("2026-10-24", "2026-10-14")).toEqual({ text: "10 days left", urgent: false });
  });
});

describe("showDeadline", () => {
  it("hides past deadlines and closed cards", () => {
    expect(showDeadline("2026-10-14", "2026-10-14", "applied")).toBe(true);
    expect(showDeadline("2026-10-20", "2026-10-14", "interview")).toBe(true);
    expect(showDeadline("2026-10-13", "2026-10-14", "applied")).toBe(false);
    expect(showDeadline("2026-10-20", "2026-10-14", "rejected")).toBe(false);
    expect(showDeadline("2026-10-20", "2026-10-14", "offer")).toBe(false);
  });
});
