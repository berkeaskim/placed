import { describe, it, expect } from "vitest";
import { pickActions, visibleHints, isActive, activeGuidance, openToYear, eligibleFor, cycleStage, becomesFact, GRADUATE_VISA_NOTE, AI_INTEGRITY_NOTE } from "@/lib/target/actions";
import { PLAYBOOKS, type Action, type Playbook } from "@/lib/playbooks";
import type { CoverageResult } from "@/lib/scoring/coverage";
import { ARCHETYPES, YEARS } from "@/lib/types";

const TODAY = "2026-10-13";
const src = [{ quote: "q", accessed: "2026-10-13" }];
const act = (id: string, o: Partial<Action> = {}): Action => ({
  id, type: "project", title: id, description: "d", skills: [], signals: ["S1"], effort: "term",
  minYear: "1st", evidence: "e", sources: [], kind: "build", signalValue: "cv_medium", ...o,
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

  it("orders by gaps covered, then evidence strength, then effort, then type", () => {
    const p = pb([
      act("course-weekend", { skills: ["Excel"], effort: "weekend", type: "course", signalValue: "cv_low" }),
      act("project-term", { skills: ["Excel"], effort: "term", type: "project", signalValue: "cv_high" }),
      act("project-weekend", { skills: ["Excel"], effort: "weekend", type: "project", signalValue: "cv_medium" }),
      act("two-gaps", { skills: ["SQL", "Python"], effort: "term", type: "course", signalValue: "cv_low" }),
    ]);
    // 06#5: a term-long client project (cv_high) beats a quick course; Excel's cap of 2 drops the course
    const ids = pickActions(p, ["SQL", "Python", "Excel"], "1st", TODAY, new Set()).actions.map((a) => a.id);
    expect(ids).toEqual(["two-gaps", "project-term", "project-weekend"]);
  });

  it("fallback puts real evidence first and allows at most one course or practice item (06#5)", () => {
    // the shipped consulting fallback was P03 deep-dive, Forage and the Bain prep hub; 180DC never reached the top 3
    const p = pb([
      act("forage", { type: "experience", effort: "weekend", signalValue: "cv_low", simulation: true }),
      act("prep-hub", { type: "course", effort: "weekend", signalValue: "interview_prep" }),
      act("deep-dive", { effort: "weekend", signalValue: "cv_low" }),
      act("180dc", { type: "experience", effort: "term", signalValue: "cv_high" }),
      act("lead", { effort: "term", signalValue: "cv_high" }),
    ]);
    const ids = pickActions(p, ["Rust"], "1st", TODAY, new Set()).actions.map((a) => a.id);
    expect(ids.slice(0, 2).sort()).toEqual(["180dc", "lead"]);
    expect(ids).toHaveLength(3);
    expect(ids.filter((id) => ["forage", "prep-hub", "deep-dive"].includes(id))).toHaveLength(1);
  });

  it("never offers a selective programme as a way to close a gap (06#4)", () => {
    const p = pb([
      act("js-internship", { type: "experience", kind: "opportunity", skills: ["Python", "Probability"], signalValue: "cv_high", expiresOn: "2027-01-03" }),
      act("backtest", { skills: ["Python"] }),
    ]);
    const r = pickActions(p, ["Python", "Probability"], "masters", TODAY, new Set());
    expect(r.actions.map((a) => a.id)).toEqual(["backtest"]);
    expect(r.opportunities.map((a) => a.id)).toEqual(["js-internship"]);
    expect(r.opportunities[0].covers).toEqual([]);
    expect(r.uncovered).toEqual(["Probability"]);
  });

  it("lists opportunities soonest deadline first, undated last, and only while open", () => {
    const opp = (id: string, o: Partial<Action> = {}) => act(id, { type: "experience", kind: "opportunity", ...o });
    const p = pb([opp("undated"), opp("late", { expiresOn: "2027-01-03" }), opp("soon", { expiresOn: "2026-11-08" }), opp("gone", { expiresOn: "2026-10-01" })]);
    expect(pickActions(p, [], "1st", TODAY, new Set()).opportunities.map((a) => a.id)).toEqual(["soon", "late", "undated"]);
  });

  it("reports gaps that no step builds, instead of hiding them behind a fallback (07#4)", () => {
    const p = pb([act("sql", { skills: ["SQL"] })]);
    const r = pickActions(p, ["SQL", "Kubernetes", { skill: "Java or Go", anyOf: ["Java", "Go"] }], "1st", TODAY, new Set());
    expect(r.uncovered).toEqual(["Kubernetes", "Java or Go"]);
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

  it("never puts a selective programme in the gap list for real data (Jane Street QT, GS Summer Analyst)", () => {
    const qnt = pickActions(PLAYBOOKS.quant_trading, ["Python", "Probability", "Machine Learning"], "masters", TODAY, new Set());
    expect(qnt.actions.map((a) => a.id)).not.toContain("PB-QNT-E03");
    const fin = pickActions(PLAYBOOKS.finance_banking, ["Financial Modelling"], "final", TODAY, new Set());
    expect(fin.actions.map((a) => a.id)).not.toContain("PB-FIN-E05");
    for (const a of ARCHETYPES) for (const x of pickActions(PLAYBOOKS[a], ["Python", "SQL", "Excel"], "penultimate", TODAY, new Set()).actions) {
      expect(x.kind, `${a} ${x.id}`).toBe("build");
    }
  });

  it("has a real build step for the most common software gaps (07#4)", () => {
    for (const gap of ["Java", "AWS", "Machine Learning", "LLM", "Docker", "Kubernetes", "Go", "C#", "Distributed Systems"]) {
      const r = pickActions(PLAYBOOKS.software_eng, [gap], "penultimate", TODAY, new Set());
      expect(r.fallback, gap).toBe(false);
      expect(r.uncovered, gap).toEqual([]);
    }
    for (const gap of ["A/B Testing", "dbt", "LLM", "Time Series"]) {
      expect(pickActions(PLAYBOOKS.data_analytics, [gap], "penultimate", TODAY, new Set()).uncovered, gap).toEqual([]);
    }
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
    expect(activeGuidance(p, "1st", TODAY)).toEqual({ line: "first", dated: ["new"], note: null });
    expect(activeGuidance(p, "penultimate", TODAY)).toEqual({ line: null, dated: [AI_INTEGRITY_NOTE], note: null });
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
    for (const y of ["final", "masters"] as const) expect(activeGuidance(pb([]), y, TODAY).dated).toEqual([AI_INTEGRITY_NOTE, GRADUATE_VISA_NOTE]);
    for (const y of ["1st", "2nd", "penultimate"] as const) expect(activeGuidance(pb([]), y, TODAY).dated).not.toContain(GRADUATE_VISA_NOTE);
    expect(GRADUATE_VISA_NOTE).toMatch(/18 months from 1 January 2027/);
  });

  it("adds the AI-in-assessments note from penultimate year on (07#30)", () => {
    expect(activeGuidance(pb([]), "penultimate", TODAY).dated).toEqual([AI_INTEGRITY_NOTE]);
    for (const y of ["1st", "2nd"] as const) expect(activeGuidance(pb([]), y, TODAY).dated).not.toContain(AI_INTEGRITY_NOTE);
  });
});

describe("year model (06#6, 07#5, 07#6)", () => {
  const T = "2026-10-18";
  it("derives the stage from graduation year when the student has one", () => {
    const cases: [string, number | null, string][] = [
      ["2nd", 2028, "penultimate"], // 2nd year of a three-year degree
      ["2nd", 2029, "2nd"], // 2nd year of a four-year degree: the spring-week year
      ["1st", 2029, "1st"],
      ["1st", 2030, "1st"],
      ["2nd", 2027, "final"],
      ["penultimate", 2028, "penultimate"],
      ["final", 2027, "final"],
      ["final", null, "final"],
      ["masters", 2027, "masters"],
      ["2nd", null, "2nd"],
    ];
    for (const [year, gradYear, want] of cases) expect(cycleStage({ year: year as (typeof YEARS)[number], gradYear }, T), `${year} ${gradYear}`).toBe(want);
  });

  it("academic year turns over in September", () => {
    expect(cycleStage({ year: "2nd", gradYear: 2027 }, "2026-08-31")).toBe("penultimate");
    expect(cycleStage({ year: "2nd", gradYear: 2027 }, "2026-09-01")).toBe("final");
  });

  it("graduation-year programmes key on graduation year, not the year label", () => {
    const spring = { minYear: "1st" as const, maxYear: "1st" as const, eligibleGradYears: [2029] };
    expect(eligibleFor(spring, { year: "2nd", gradYear: 2029 }, T)).toBe(true); // four-year course, 2nd year
    expect(eligibleFor(spring, { year: "1st", gradYear: 2028 }, T)).toBe(false); // e.g. a 2-year accelerated degree
    expect(eligibleFor(spring, { year: "1st", gradYear: null }, T)).toBe(true);
    expect(eligibleFor(spring, { year: "final", gradYear: null }, T)).toBe(false);
  });

  it("a 2nd year with no graduation year still sees penultimate steps (they may be on a three-year degree)", () => {
    const pen = { minYear: "penultimate" as const };
    expect(eligibleFor(pen, { year: "2nd", gradYear: null }, T)).toBe(true);
    expect(eligibleFor(pen, { year: "2nd", gradYear: 2029 }, T)).toBe(false);
    expect(eligibleFor(pen, { year: "1st", gradYear: null }, T)).toBe(false);
  });

  it("real first-year-only programmes never reach a penultimate student identified by graduation year", () => {
    for (const a of ARCHETYPES) {
      const r = pickActions(PLAYBOOKS[a], [], { year: "2nd", gradYear: 2028 }, T, new Set());
      const ids = [...r.actions, ...r.opportunities].map((x) => x.id);
      for (const id of ["PB-QNT-E01", "PB-QNT-E06", "PB-FIN-E01", "PB-FIN-E04", "PB-FIN-E06"]) expect(ids, a).not.toContain(id);
    }
  });

  it("dated lines for one graduating class follow graduation year", () => {
    const p: Playbook = { ...pb([]), yearGuidanceDated: [{ year: "1st", text: "2029 grads", expiresOn: "2027-01-03", gradYears: [2029] }] };
    expect(activeGuidance(p, { year: "2nd", gradYear: 2029 }, T).dated).toEqual(["2029 grads"]);
    expect(activeGuidance(p, { year: "1st", gradYear: 2028 }, T).dated).not.toContain("2029 grads");
    expect(activeGuidance(p, { year: "1st" }, T).dated).toEqual(["2029 grads"]);
  });

  it("shows the course-length note only while the stage is ambiguous", () => {
    const p: Playbook = { ...pb([]), note: "four-year note" };
    expect(activeGuidance(p, { year: "2nd" }, T).note).toBe("four-year note");
    expect(activeGuidance(p, { year: "2nd", gradYear: 2029 }, T).note).toBeNull();
    expect(activeGuidance(p, { year: "final" }, T).note).toBeNull();
  });

  it("every real year line exists for every stage", () => {
    for (const a of ARCHETYPES) for (const y of YEARS) expect(activeGuidance(PLAYBOOKS[a], y, T).line, `${a} ${y}`).toBeTruthy();
  });
});

describe("becomesFact (07#19, 06#9)", () => {
  it("keeps courses, simulations and practice out of the tailoring corpus", () => {
    expect(becomesFact({ type: "course", signalValue: "cv_low" })).toBe(false);
    expect(becomesFact({ type: "experience", signalValue: "cv_low", simulation: true })).toBe(false);
    expect(becomesFact({ type: "project", signalValue: "interview_prep" })).toBe(false);
    expect(becomesFact({ type: "course", signalValue: "test_prep" })).toBe(false);
    expect(becomesFact({ type: "project", signalValue: "cv_high" })).toBe(true);
    expect(becomesFact({ type: "experience", signalValue: "cv_high" })).toBe(true);
  });
});

describe("openToYear", () => {
  it("checks both ends of the year window", () => {
    expect(openToYear({ minYear: "2nd" }, "1st")).toBe(false);
    expect(openToYear({ minYear: "1st", maxYear: "2nd" }, "2nd")).toBe(true);
    expect(openToYear({ minYear: "1st", maxYear: "2nd" }, "penultimate")).toBe(false);
  });
});
