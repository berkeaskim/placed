import { describe, expect, it } from "vitest";
import { COLUMNS, groupByStatus, isAppStatus, STATUS_EVENT } from "@/lib/tracker/status";

describe("tracker status helpers", () => {
  it("accepts only enum values", () => {
    for (const s of ["saved", "applied", "interview", "offer", "rejected"]) expect(isAppStatus(s)).toBe(true);
    for (const s of ["Applied", "", "hired", null, undefined, 3, {}]) expect(isAppStatus(s)).toBe(false);
  });
  it("orders columns saved, applied, interview, offer, rejected", () => {
    expect(COLUMNS.map((c) => c.key)).toEqual(["saved", "applied", "interview", "offer", "rejected"]);
  });
  it("has an XP event for every status except saved", () => {
    expect(Object.keys(STATUS_EVENT).sort()).toEqual(["applied", "interview", "offer", "rejected"]);
  });
  it("groups cards by status, keeping order and empty columns", () => {
    const g = groupByStatus([{ id: "a", status: "applied" as const }, { id: "b", status: "saved" as const }, { id: "c", status: "applied" as const }]);
    expect(g.applied.map((c) => c.id)).toEqual(["a", "c"]);
    expect(g.saved).toHaveLength(1);
    expect(g.offer).toEqual([]);
    expect(g.rejected).toEqual([]);
  });
});
