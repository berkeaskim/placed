import { describe, it, expect } from "vitest";
import { todayLondon, daysUntil, isOpen, deadlineLabel } from "@/lib/scoring/dates";

// Seeded PRNG (mulberry32) so property loops are deterministic.
function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

describe("todayLondon — Europe/London calendar day across DST", () => {
  it.each([
    // BST ends Sun 2026-10-25 01:00 UTC
    ["2026-10-24T22:59:59Z", "2026-10-24"], // 23:59:59 BST
    ["2026-10-24T23:00:00Z", "2026-10-25"], // 00:00 BST
    ["2026-10-25T00:59:59Z", "2026-10-25"], // 01:59:59 BST, last BST second
    ["2026-10-25T01:00:00Z", "2026-10-25"], // 01:00 GMT (repeated hour)
    ["2026-10-25T23:59:59Z", "2026-10-25"], // 23:59:59 GMT
    ["2026-10-26T00:00:00Z", "2026-10-26"], // midnight GMT
    // BST starts Sun 2027-03-28 01:00 UTC
    ["2027-03-27T23:59:59Z", "2027-03-27"], // GMT
    ["2027-03-28T00:00:00Z", "2027-03-28"],
    ["2027-03-28T00:59:59Z", "2027-03-28"], // 00:59:59 GMT
    ["2027-03-28T01:00:00Z", "2027-03-28"], // 02:00 BST (skipped hour)
    ["2027-03-28T22:59:59Z", "2027-03-28"], // 23:59:59 BST
    ["2027-03-28T23:00:00Z", "2027-03-29"], // 00:00 BST next day
    // leap day and year boundary (GMT)
    ["2028-02-28T23:59:59Z", "2028-02-28"],
    ["2028-02-29T00:00:00Z", "2028-02-29"],
    ["2028-02-29T23:59:59Z", "2028-02-29"],
    ["2026-12-31T23:59:59Z", "2026-12-31"],
    ["2027-01-01T00:00:00Z", "2027-01-01"],
  ])("%s → %s", (instant, day) => {
    expect(todayLondon(new Date(instant))).toBe(day);
  });

  it("always returns a zero-padded YYYY-MM-DD string (property, 2000 random instants 2020-2035)", () => {
    const r = rng(42);
    const lo = Date.parse("2020-01-01T00:00:00Z"), hi = Date.parse("2035-12-31T00:00:00Z");
    for (let i = 0; i < 2000; i++) {
      const d = new Date(lo + Math.floor(r() * (hi - lo)));
      const t = todayLondon(d);
      expect(t).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      // London is UTC+0 or UTC+1, so the London day is the UTC day or the next one.
      const utcDay = d.toISOString().slice(0, 10);
      expect([utcDay, addDays(utcDay, 1)]).toContain(t);
    }
  });

  it("is deterministic for the same instant", () => {
    const d = new Date("2026-10-25T00:30:00Z");
    expect(todayLondon(d)).toBe(todayLondon(new Date(d.getTime())));
  });

  it("throws RangeError on an invalid Date (callers must pass a real Date)", () => {
    expect(() => todayLondon(new Date("not a date"))).toThrow(RangeError);
  });
});

describe("daysUntil — calendar-day arithmetic is DST-proof", () => {
  it("is an integer across both DST transitions", () => {
    expect(daysUntil("2026-10-26", "2026-10-24")).toBe(2); // 49h wall-clock span
    expect(daysUntil("2027-03-29", "2027-03-27")).toBe(2); // 47h wall-clock span
    expect(daysUntil("2026-10-25", "2026-10-25")).toBe(0);
  });
  it("handles leap years", () => {
    expect(daysUntil("2028-03-01", "2028-02-28")).toBe(2);
    expect(daysUntil("2027-03-01", "2027-02-28")).toBe(1);
    expect(daysUntil("2028-02-29", "2028-02-28")).toBe(1);
    expect(daysUntil("2029-02-28", "2028-02-29")).toBe(365);
  });
  it("handles year boundaries", () => {
    expect(daysUntil("2027-01-01", "2026-12-31")).toBe(1);
    expect(daysUntil("2026-12-31", "2027-01-01")).toBe(-1);
  });
  it("property: antisymmetric and consistent with addDays over random dates", () => {
    const r = rng(7);
    for (let i = 0; i < 2000; i++) {
      const base = addDays("2020-01-01", Math.floor(r() * 5000));
      const n = Math.floor(r() * 800) - 400;
      const other = addDays(base, n);
      expect(daysUntil(other, base)).toBe(n);
      expect(daysUntil(base, other)).toBe(-n);
      expect(Number.isInteger(daysUntil(other, base))).toBe(true);
    }
  });
});

describe("deadline semantics — London day, inclusive", () => {
  it("a deadline is open all of its London day and closed from 00:00 London the next day (BST)", () => {
    const deadline = "2026-10-13";
    expect(isOpen(deadline, todayLondon(new Date("2026-10-13T22:59:59Z")))).toBe(true); // 23:59:59 BST
    expect(deadlineLabel(deadline, todayLondon(new Date("2026-10-13T22:59:59Z")))).toBe("Closes today");
    expect(isOpen(deadline, todayLondon(new Date("2026-10-13T23:00:00Z")))).toBe(false); // 00:00 BST 14th
    expect(deadlineLabel(deadline, todayLondon(new Date("2026-10-13T23:00:00Z")))).toBe("Closed");
  });
  it("on the autumn DST-change day the deadline stays open until 23:59:59 GMT", () => {
    const deadline = "2026-10-25";
    expect(isOpen(deadline, todayLondon(new Date("2026-10-25T23:59:59Z")))).toBe(true);
    expect(isOpen(deadline, todayLondon(new Date("2026-10-26T00:00:00Z")))).toBe(false);
  });
  it("on the spring DST-change day the deadline closes at 23:00 UTC", () => {
    const deadline = "2027-03-28";
    expect(isOpen(deadline, todayLondon(new Date("2027-03-28T22:59:59Z")))).toBe(true);
    expect(isOpen(deadline, todayLondon(new Date("2027-03-28T23:00:00Z")))).toBe(false);
  });
  it("leap-day deadline", () => {
    expect(deadlineLabel("2028-02-29", "2028-02-28")).toBe("Closes tomorrow");
    expect(deadlineLabel("2028-02-29", "2028-02-29")).toBe("Closes today");
    expect(deadlineLabel("2028-02-29", "2028-03-01")).toBe("Closed");
  });
  it("labels: today / tomorrow / N days / yesterday / far past / rolling", () => {
    const today = "2026-10-13";
    expect(deadlineLabel(today, today)).toBe("Closes today");
    expect(deadlineLabel(addDays(today, 1), today)).toBe("Closes tomorrow");
    expect(deadlineLabel(addDays(today, 2), today)).toBe("2 days left");
    expect(deadlineLabel(addDays(today, -1), today)).toBe("Closed");
    expect(isOpen(addDays(today, -1), today)).toBe(false);
    expect(deadlineLabel(addDays(today, -400), today)).toBe("Closed");
    expect(deadlineLabel(null, today)).toBe("Rolling deadline");
  });
  it("property: isOpen ⇔ label is not 'Closed' for valid dates", () => {
    const r = rng(99);
    for (let i = 0; i < 1000; i++) {
      const today = addDays("2026-01-01", Math.floor(r() * 700));
      const dl = addDays(today, Math.floor(r() * 60) - 30);
      expect(isOpen(dl, today)).toBe(deadlineLabel(dl, today) !== "Closed");
    }
  });

  // FIXED (was BUG): lib/scoring/dates.ts:13-19 — daysUntil returns NaN for malformed strings, and none of the
  // `d < 0 / d === 0 / d === 1` branches catch NaN, so the card shows "NaN days left".
  it("never renders 'NaN' for malformed deadline strings", () => {
    for (const bad of ["garbage", "13/10/2026", "2026-13-45", "TBC"]) {
      expect(deadlineLabel(bad, "2026-10-13")).not.toContain("NaN");
    }
  });

  // BUG: lib/scoring/dates.ts:10 vs :14 — isOpen checks `=== null` but deadlineLabel checks falsiness,
  // so "" is labelled "Rolling deadline" yet isOpen("") === false (job hidden from the feed).
  it("empty-string deadline is treated consistently by isOpen and deadlineLabel", () => {
    expect(deadlineLabel("", "2026-10-13")).toBe("Rolling deadline");
    expect(isOpen("", "2026-10-13")).toBe(true);
  });
});
