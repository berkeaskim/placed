import { describe, it, expect } from "vitest";
import { buildPlan, nextMoves } from "@/lib/strategy/plan";

const base = { status: "saved" as const, deadline: null, updatedAt: "2026-10-17T09:00:00Z", today: "2026-10-17", outreach: [] };

describe("buildPlan", () => {
  it("rolling role: one-week run-up, alumni first and marked next", () => {
    const p = buildPlan(base);
    expect(p.steps.map((s) => [s.key, s.due])).toEqual([
      ["alumni", "2026-10-17"], ["joiner", "2026-10-20"], ["apply", "2026-10-24"], ["team", "2026-10-26"], ["recruiter", "2026-11-14"],
    ]);
    expect(p.steps.map((s) => s.state)).toEqual(["next", "upcoming", "upcoming", "upcoming", "upcoming"]);
    expect(p.daysLeft).toBeNull();
  });

  it("deadline: applies a couple of days before it, joiner between", () => {
    const p = buildPlan({ ...base, deadline: "2026-11-12" });
    const due = Object.fromEntries(p.steps.map((s) => [s.key, s.due]));
    expect(due.apply).toBe("2026-11-10");
    expect(due.joiner > due.alumni && due.joiner < due.apply).toBe(true);
    expect(p.daysLeft).toBe(26);
  });

  it("deadline tomorrow still gives a valid order", () => {
    const p = buildPlan({ ...base, deadline: "2026-10-18" });
    const keys = p.steps.map((s) => s.key);
    expect(keys.indexOf("alumni")).toBeLessThan(keys.indexOf("apply"));
  });

  it("marks messages done from the outreach log, ignoring drafts", () => {
    const p = buildPlan({ ...base, outreach: [{ target: "alumni", status: "sent" }, { target: "recent_joiner", status: "drafted" }] });
    expect(p.steps.find((s) => s.key === "alumni")!.state).toBe("done");
    expect(p.steps.find((s) => s.key === "joiner")!.state).toBe("next");
    expect(p.doneCount).toBe(1);
  });

  it("applied: apply is done and dated from the move; missed pre-apply steps are overdue", () => {
    const p = buildPlan({ ...base, status: "applied", updatedAt: "2026-10-10T12:00:00Z" });
    const s = Object.fromEntries(p.steps.map((x) => [x.key, x]));
    expect(s.apply).toMatchObject({ state: "done", due: "2026-10-10" });
    expect(s.alumni.overdue).toBe(true);
    expect(s.recruiter.due).toBe("2026-10-31");
  });

  it("interview adds a prep step and counts the follow-up as no longer needed", () => {
    const p = buildPlan({ ...base, status: "interview", updatedAt: "2026-10-01T00:00:00Z" });
    expect(p.steps.some((x) => x.key === "prep" && x.purpose === "interview_prep")).toBe(true);
    expect(p.steps.find((x) => x.key === "recruiter")!.state).toBe("done");
  });
});

describe("nextMoves", () => {
  it("lists open message steps only, soonest first", () => {
    const moves = nextMoves(buildPlan(base));
    expect(moves.map((m) => m.key)).toEqual(["alumni", "joiner", "team"]);
  });
});
