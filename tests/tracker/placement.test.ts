import { describe, it, expect } from "vitest";
import { canAccept, checklistProgress, otherOpenPlacements, PLACEMENT_CHECKLIST, securedPlacement, statusClearsAcceptance } from "@/lib/tracker/placement";

const app = (over: Partial<Parameters<typeof securedPlacement>[0][number]> = {}) => ({
  id: "a", status: "applied" as const, employmentType: "placement", acceptedAt: null, company: "GSK", title: "Industrial Placement", ...over,
});

describe("securedPlacement", () => {
  it("is the accepted placement offer", () => {
    const s = securedPlacement([app(), app({ id: "b", status: "offer", acceptedAt: "2026-11-01T10:00:00Z", company: "Airbus" })]);
    expect(s).toMatchObject({ id: "b", company: "Airbus" });
  });
  it("an accepted internship is not a placement; an offer not yet accepted is not secured", () => {
    expect(securedPlacement([app({ status: "offer", acceptedAt: "x", employmentType: "internship" })])).toBeNull();
    expect(securedPlacement([app({ status: "offer" })])).toBeNull();
  });
  it("only an offer can be accepted (a stale acceptedAt on another status doesn't count)", () => {
    expect(securedPlacement([app({ status: "rejected", acceptedAt: "x" })])).toBeNull();
  });
});

describe("otherOpenPlacements", () => {
  it("counts the other live placement applications to withdraw", () => {
    const apps = [
      app({ id: "acc", status: "offer", acceptedAt: "x" }), app({ id: "b", status: "applied" }), app({ id: "c", status: "interview" }),
      app({ id: "d", status: "offer" }), app({ id: "e", status: "rejected" }), app({ id: "f", status: "saved" }),
      app({ id: "g", status: "applied", employmentType: "internship" }),
    ];
    expect(otherOpenPlacements(apps, "acc").map((a) => a.id)).toEqual(["b", "c", "d"]);
  });
});

describe("acceptance rules", () => {
  it("only an offer can be accepted", () => {
    expect(canAccept("offer")).toBe(true);
    expect(canAccept("interview")).toBe(false);
  });
  it("moving off Offer clears the acceptance", () => {
    expect(statusClearsAcceptance("offer")).toBe(false);
    expect(statusClearsAcceptance("rejected")).toBe(true);
  });
});

describe("checklist", () => {
  it("has the four steps after accepting", () => {
    expect(PLACEMENT_CHECKLIST.map((c) => c.key)).toEqual(["uni_approval", "contract", "checks", "withdraw"]);
  });
  it("counts done steps and ignores unknown keys", () => {
    expect(checklistProgress({ uni_approval: true, contract: false, bogus: true })).toEqual({ done: 1, total: 4 });
    expect(checklistProgress(null)).toEqual({ done: 0, total: 4 });
  });
});
