import { describe, it, expect } from "vitest";
import { defaultSecureBy, placementCountdown } from "@/lib/profile/cycle";

// research/placement-year/04-timeline-process.md: universities set a "secure by" date (19 June–31 December; default 30 June);
// SMEs and startups keep recruiting January–June (late market); missing it usually means the 3-year degree.

describe("defaultSecureBy", () => {
  it("is 30 June of the year placements start", () => {
    expect(defaultSecureBy("2026-10-20")).toBe("2027-06-30");
    expect(defaultSecureBy("2027-08-02")).toBe("2028-06-30");
  });
});

describe("placementCountdown", () => {
  it("main season: days left, no warnings", () => {
    expect(placementCountdown("2026-10-20", null)).toMatchObject({ secureBy: "2027-06-30", days: 253, phase: "main" });
  });
  it("late market from 1 February", () => {
    expect(placementCountdown("2027-02-01", null).phase).toBe("late");
    expect(placementCountdown("2027-01-31", null).phase).toBe("main");
  });
  it("final stretch in the last 30 days", () => {
    expect(placementCountdown("2027-06-01", null)).toMatchObject({ days: 29, phase: "final" });
  });
  it("past the date", () => {
    expect(placementCountdown("2027-07-02", "2027-06-30")).toMatchObject({ days: -2, phase: "passed" });
  });
  it("a university's own date wins", () => {
    expect(placementCountdown("2026-10-20", "2026-12-31")).toMatchObject({ secureBy: "2026-12-31", days: 72, phase: "main" });
  });
  it("an invalid stored date falls back to the default", () => {
    expect(placementCountdown("2026-10-20", "not-a-date").secureBy).toBe("2027-06-30");
  });
});
