import { describe, it, expect } from "vitest";
import { needsAttention, relativeTime, summarize, type SummaryCard } from "@/lib/tracker/summary";

const now = new Date("2026-10-16T12:00:00Z");
const card = (over: Partial<SummaryCard>): SummaryCard => ({
  id: over.id ?? "c", jobId: "j", title: "Role", company: "Acme", status: "saved", updatedAt: "2026-10-16T10:00:00Z",
  deadline: null, nudge: null, ...over,
});

describe("summarize", () => {
  it("counts statuses, active cards and this week's moves", () => {
    const s = summarize([
      card({ status: "saved" }), card({ status: "applied", updatedAt: "2026-10-01T00:00:00Z" }),
      card({ status: "interview" }), card({ status: "rejected" }),
    ], now);
    expect(s.counts).toEqual({ saved: 1, applied: 1, interview: 1, offer: 0, rejected: 1 });
    expect(s.active).toBe(3);
    expect(s.movedThisWeek).toBe(3);
  });

  it("heard-back rate counts any answer among sent applications", () => {
    expect(summarize([card({ status: "saved" })], now).heardBackRate).toBeNull();
    const s = summarize([card({ status: "applied" }), card({ status: "applied" }), card({ status: "interview" }), card({ status: "rejected" })], now);
    expect(s.heardBackRate).toBe(50);
  });
});

describe("needsAttention", () => {
  const today = "2026-10-16";
  it("puts the soonest closing posting first, then nudges, and caps the list", () => {
    const items = needsAttention([
      card({ id: "nudge", status: "interview", nudge: { text: "Ask an alumnus" } }),
      card({ id: "in3", deadline: { date: "2026-10-19", label: "Closes" } }),
      card({ id: "today", deadline: { date: "2026-10-16", label: "Closes" } }),
      card({ id: "far", deadline: { date: "2026-11-30", label: "Closes" } }),
    ], today);
    expect(items.map((i) => i.card.id)).toEqual(["today", "in3", "nudge"]);
    expect(items[0]).toMatchObject({ reason: "Closes: due today", urgent: true });
    expect(items[1].urgent).toBe(false);
    expect(needsAttention(Array.from({ length: 9 }, (_, i) => card({ id: `n${i}`, nudge: { text: "x" } })), today)).toHaveLength(4);
  });

  it("ignores past deadlines", () => {
    expect(needsAttention([card({ deadline: { date: "2026-10-10", label: "Closes" } })], today)).toEqual([]);
  });
});

describe("relativeTime", () => {
  it.each([
    ["2026-10-16T11:59:30Z", "just now"],
    ["2026-10-16T11:15:00Z", "45m ago"],
    ["2026-10-16T07:00:00Z", "5h ago"],
    ["2026-10-15T10:00:00Z", "yesterday"],
    ["2026-10-12T12:00:00Z", "4d ago"],
    ["2026-09-25T12:00:00Z", "3w ago"],
    ["2026-07-01T12:00:00Z", "1 Jul"],
    ["not a date", ""],
  ])("%s → %s", (iso, out) => expect(relativeTime(iso, now)).toBe(out));
});
