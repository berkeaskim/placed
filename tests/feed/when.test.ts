import { describe, expect, it } from "vitest";
import { ago, inTime } from "@/lib/feed/when";

const NOW = Date.parse("2026-10-16T12:00:00Z");
const at = (ms: number) => new Date(NOW + ms).toISOString();

describe("ago / inTime", () => {
  it("formats past times", () => {
    expect(ago(at(-10_000), NOW)).toBe("just now");
    expect(ago(at(-5 * 60_000), NOW)).toBe("5 min ago");
    expect(ago(at(-3 * 3_600_000), NOW)).toBe("3h ago");
    expect(ago(at(-86_400_000), NOW)).toBe("1 day ago");
    expect(ago(at(-3 * 86_400_000), NOW)).toBe("3 days ago");
  });
  it("formats future times", () => {
    expect(inTime(at(0), NOW)).toBe("soon");
    expect(inTime(at(-60_000), NOW)).toBe("soon");
    expect(inTime(at(90_000), NOW)).toBe("in 2 min");
    expect(inTime(at(6 * 3_600_000), NOW)).toBe("in 6h");
  });
});
