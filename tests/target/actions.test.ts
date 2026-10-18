import { describe, it, expect } from "vitest";
import { pickActions, visibleHints, isActive, activeGuidance, openToYear, GRADUATE_VISA_NOTE } from "@/lib/target/actions";
import { PLAYBOOKS, type Action, type Playbook } from "@/lib/playbooks";
import type { CoverageResult } from "@/lib/scoring/coverage";
import { ARCHETYPES, YEARS } from "@/lib/types";

const TODAY = "2026-10-13";
const src = [{ quote: "q", accessed: "2026-10-13" }];
const act = (id: string, o: Partial<Action> = {}): Action => ({
  id, type: "course", title: id, description: "d", skills: [], signals: ["S1"], effort: "term",
  minYear: "1st", evidence: "e", sources: [], ...o,
});
const pb = (actions: Action[]): Playbook => ({
  signals: [{ id: "S1", text: "t", grade: "B", ruleIds: [], sources: [...src, ...src] }],
  actions, yearGuidance: { "1st": "first" }, yearGuidanceDated: [],
});

describe("isActive", () => {
  it("hides expired items and flags past review dates", () => {
    expect(isActive({ expiresOn: "2026-10-12" }, TODAY)).toEqual({ show: false, stale: false });
    expect(isActive({ expiresOn: "2026-10-13" }, TODAY)).toEqual({ show: true, stale: false });
    expect(isActive({ reviewBy: "2026-10-12" }, TODAY)).toEqual({ show: true, stale: true });
    expect(isActive({}, TODAY)).toEqual({ show: true, stale: false });
  });
});

describe("pickActions", () => {
  it("excludes actions above the student's year, expired or already done", () => {
    const p = pb([
      act("late", { skills: ["SQL"], minYear: "penultimate" }),
      act("gone", { skills: ["SQL"], expiresOn: "2026-10-01" }),
      act("done", { skills: ["SQL"] }),
      act("ok", { skills: ["SQL"] }),
    ]);
    const r = pickActions(p, ["SQL"], "1st", TODAY, new Set(["done"]));
    expect(r.actions.map((a) => a.id)).toEqual(["ok"]);
    expect(r.fallback).toBe(false);
  });

  it("hides actions past their maxYear (first-year-only programmes never reach finalists)", () => {
    const p = pb([act("fy", { skills: ["A"], maxYear: "1st" }), act("upto2", { skills: ["B"], maxYear: "2nd" }), act("any", { skills: ["C"] })]);
    const ids = (y: (typeof YEARS)[number]) => pickActions(p, ["A", "B", "C"], y, TODAY, new Set()).actions.map((a) => a.id).sort();
    expect(ids("1st")).toEqual(["any", "fy", "upto2"]);
    expect(ids("2nd")).toEqual(["any", "upto2"]);
    for (const y of ["penultimate", "final", "masters"] as const) expect(ids(y)).toEqual(["any"]);
  });

  it("applies maxYear to the fallback too", () => {
    const p = pb([act("fy", { maxYear: "1st" }), act("b"), act("c")]);
    expect(pickActions(p, ["Rust"], "final", TODAY, new Set()).actions.map((a) => a.id)).toEqual(["b", "c"]);
  });

  it("never shows a real first-year-only programme to finalists or masters", () => {
    for (const a of ARCHETYPES) for (const y of ["final", "masters"] as const) {
      const ids = pickActions(PLAYBOOKS[a], [], y, TODAY, new Set()).actions.map((x) => x.id);
      for (const id of ["PB-QNT-E01", "PB-QNT-E06", "PB-FIN-E01", "PB-FIN-E04", "PB-FIN-E06"]) expect(ids, `${a} ${y}`).not.toContain(id);
    }
  });

  it("treats masters as above final", () => {
    const p = pb([act("m", { skills: ["SQL"], minYear: "final" })]);
    expect(pickActions(p, ["SQL"], "masters", TODAY, new Set()).actions).toHaveLength(1);
  });

  it("orders by gaps covered, then effort, then type", () => {
    const p = pb([
      act("course-weekend", { skills: ["Excel"], effort: "weekend", type: "course" }),
      act("project-term", { skills: ["Excel"], effort: "term", type: "project" }),
      act("project-weekend", { skills: ["Excel"], effort: "weekend", type: "project" }),
      act("two-gaps", { skills: ["SQL", "Python"], effort: "term", type: "course" }),
    ]);
    // effort beats type (course-weekend before project-term); Excel's cap of 2 drops project-term
    const ids = pickActions(p, ["SQL", "Python", "Excel"], "1st", TODAY, new Set()).actions.map((a) => a.id);
    expect(ids).toEqual(["two-gaps", "project-weekend", "course-weekend"]);
  });

  it("caps at 2 per gap and 6 overall", () => {
    const gaps = ["A", "B", "C", "D"];
    const p = pb(gaps.flatMap((g) => [1, 2, 3].map((i) => act(`${g}${i}`, { skills: [g] }))));
    const r = pickActions(p, gaps, "1st", TODAY, new Set());
    expect(r.actions).toHaveLength(6);
    for (const g of gaps) expect(r.actions.filter((a) => a.covers.includes(g)).length).toBeLessThanOrEqual(2);
  });

  it("tops up with signal-linked actions when fewer than 3 match, never duplicating", () => {
    const p = pb([act("sql", { skills: ["SQL"] }), act("x"), act("y"), act("nosig", { signals: [] })]);
    const r = pickActions(p, ["SQL"], "1st", TODAY, new Set());
    expect(r.actions.map((a) => a.id)).toEqual(["sql"]);
    expect(r.topUp.map((a) => a.id)).toEqual(["x", "y"]);
  });

  it("does not top up when 3 or more match", () => {
    const p = pb([act("a", { skills: ["SQL"] }), act("b", { skills: ["Python"] }), act("c", { skills: ["Python"] }), act("x")]);
    expect(pickActions(p, ["SQL", "Python"], "1st", TODAY, new Set()).topUp).toEqual([]);
  });

  it("marks stale actions", () => {
    const p = pb([act("s", { skills: ["SQL"], reviewBy: "2026-10-01" })]);
    expect(pickActions(p, ["SQL"], "1st", TODAY, new Set()).actions[0].stale).toBe(true);
  });

  it("falls back to 3 signal-linked actions when no gap maps", () => {
    const p = pb([act("a"), act("b"), act("c"), act("d"), act("nosig", { signals: [] })]);
    const r = pickActions(p, ["Rust"], "1st", TODAY, new Set());
    expect(r.fallback).toBe(true);
    expect(r.actions).toHaveLength(3);
    expect(r.actions.map((a) => a.id)).not.toContain("nosig");
  });

  it("matches an 'X or Y' gap through its alternatives", () => {
    const p = pb([act("py", { skills: ["Python"] })]);
    const r = pickActions(p, [{ skill: "Python or R", anyOf: ["Python", "R"] }], "1st", TODAY, new Set());
    expect(r.actions[0].covers).toEqual(["Python or R"]);
  });

  it("returns something for every real archetype and year", () => {
    for (const a of ARCHETYPES) for (const y of YEARS) {
      expect(pickActions(PLAYBOOKS[a], [], y, TODAY, new Set()).actions.length, `${a} ${y}`).toBeGreaterThan(0);
    }
  });
});

describe("visibleHints", () => {
  it("hints only for supportedByResume items", () => {
    const c: CoverageResult = {
      readable: true, weighted: 0.5, must: { matched: 1, total: 2 }, nice: { matched: 1, total: 1 },
      items: [
        { skill: "SQL", section: "must", status: "existing" },
        { skill: "Excel", section: "nice", status: "supportedByResume" },
        { skill: "Python", section: "must", status: "gap" },
      ],
    };
    expect(visibleHints(c)).toEqual([
      { skill: "Excel", text: "Your CV mentions Excel but not in your skills list or bullets — add a bullet about what you did with it." },
    ]);
  });
});

describe("activeGuidance", () => {
  it("returns the year line plus unexpired dated lines for that year", () => {
    const p: Playbook = {
      ...pb([]),
      yearGuidance: { "1st": "first", "2nd": "second" },
      yearGuidanceDated: [
        { year: "1st", text: "old", expiresOn: "2026-10-01" },
        { year: "1st", text: "new", expiresOn: "2027-01-03" },
        { year: "2nd", text: "other" },
      ],
    };
    expect(activeGuidance(p, "1st", TODAY)).toEqual({ line: "first", dated: ["new"] });
    expect(activeGuidance(p, "penultimate", TODAY)).toEqual({ line: null, dated: [] });
  });

  it("flags 'expected' lines after reviewBy and hides them 30 days later", () => {
    const p: Playbook = { ...pb([]), yearGuidanceDated: [{ year: "2nd", text: "Opens Nov 2026", reviewBy: "2026-11-30" }] };
    expect(activeGuidance(p, "2nd", "2026-11-30").dated).toEqual(["Opens Nov 2026"]);
    expect(activeGuidance(p, "2nd", "2026-12-01").dated).toEqual(["Opens Nov 2026 (Dates may have changed: check the official page.)"]);
    expect(activeGuidance(p, "2nd", "2026-12-30").dated).toHaveLength(1);
    expect(activeGuidance(p, "2nd", "2026-12-31").dated).toEqual([]);
    expect(activeGuidance(p, "2nd", "2027-03-01").dated).toEqual([]);
  });

  it("adds the Graduate visa note for final-year and masters students only", () => {
    for (const y of ["final", "masters"] as const) expect(activeGuidance(pb([]), y, TODAY).dated).toEqual([GRADUATE_VISA_NOTE]);
    for (const y of ["1st", "2nd", "penultimate"] as const) expect(activeGuidance(pb([]), y, TODAY).dated).not.toContain(GRADUATE_VISA_NOTE);
    expect(GRADUATE_VISA_NOTE).toMatch(/18 months from 1 January 2027/);
  });
});

describe("openToYear", () => {
  it("checks both ends of the year window", () => {
    expect(openToYear({ minYear: "2nd" }, "1st")).toBe(false);
    expect(openToYear({ minYear: "1st", maxYear: "2nd" }, "2nd")).toBe(true);
    expect(openToYear({ minYear: "1st", maxYear: "2nd" }, "penultimate")).toBe(false);
  });
});
