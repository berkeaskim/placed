import { describe, it, expect } from "vitest";
import { buildTargetView, type JobRow } from "@/lib/target/view";
import type { ParsedCV, Requirement } from "@/lib/types";

const TODAY = "2026-10-14";
const req = (skill: string, section: "must" | "nice"): Requirement =>
  ({ text: skill, skill, importance: "high", section, evidenceTier: "stated" });
const row = (id: string, skills: [string, "must" | "nice"][], o: Partial<JobRow> = {}): JobRow =>
  ({ id, archetype: "data_analytics", is_live: true, deadline: null, text_lines: [], requirements: skills.map(([s, sec]) => req(s, sec)), ...o });
const JOBS = Array.from({ length: 6 }, (_, k) => row(String(k), [["SQL", "must"], ["Excel", "must"], ...(k < 4 ? [["Tableau", "nice"] as [string, "nice"]] : [])]));

const cv: ParsedCV = {
  name: "T", email: null, phone: null, location: null, links: [], summary: null,
  education: [], experience: [{ id: "x1", org: "Shop", title: "Assistant", dates: "2025", location: "", bullets: [{ id: "x1-b0", text: "Built a weekly sales dashboard" }] }],
  projects: [], leadership: [], skills: [{ group: "Tools", items: ["Excel"] }], interests: null,
  sectionOrder: [], yearGuess: null, archetypes: [],
};

const base = { sector: "data_analytics" as const, year: "1st" as const, today: TODAY, jobs: JOBS, cv, profileSkills: [], progress: [], confirmedClaims: [] };

describe("buildTargetView", () => {
  it("computes readiness from live open jobs of the sector only", () => {
    const v = buildTargetView({ ...base, jobs: [...JOBS, row("dead", [["R", "must"]], { is_live: false }), row("x", [["Java", "must"]], { archetype: "software_eng" })] });
    expect(v.demand.n).toBe(6);
    expect(v.pct).not.toBeNull();
    expect(v.pct!).toBeLessThan(100);
    expect(v.status).toMatchObject({ SQL: "gap", Excel: "existing", Tableau: "gap" });
    expect(v.existing).toEqual(["Excel"]);
    expect(v.source).toBe("cv");
  });

  it("maps gap skills to picked playbook actions and hides done ones", () => {
    const v = buildTargetView(base);
    expect(v.actionsFor.SQL?.length).toBeGreaterThan(0);
    const firstSql = v.actionsFor.SQL[0];
    const after = buildTargetView({ ...base, progress: [{ action_id: firstSql, status: "done", evidence_note: "Did the whole course", evidence_url: null }] });
    expect(after.actions.some((a) => a.id === firstSql)).toBe(false);
    expect(after.done.map((d) => d.id)).toEqual([firstSql]);
    expect(after.done[0].note).toBe("Did the whole course");
  });

  it("keeps planned actions visible and listed", () => {
    const v = buildTargetView(base);
    const id = v.actions[0].id;
    const p = buildTargetView({ ...base, progress: [{ action_id: id, status: "planned", evidence_note: null, evidence_url: null }] });
    expect(p.planned).toEqual([id]);
    expect(p.actions.some((a) => a.id === id)).toBe(true);
  });

  it("never offers an action above the student's year", () => {
    const v = buildTargetView(base);
    for (const a of [...v.actions, ...v.topUp]) expect(a.minYear).toBe("1st");
  });

  it("small sample: no percentage, honest label, actions still shown", () => {
    const v = buildTargetView({ ...base, jobs: JOBS.slice(0, 3) });
    expect(v.pct).toBeNull();
    expect(v.readinessLabel).toBe("Small sample — 3 live Data & Analytics roles");
    expect(v.actions.length + v.topUp.length).toBeGreaterThan(0);
  });

  it("no CV: falls back to profile skills and has no bullet steps", () => {
    const v = buildTargetView({ ...base, cv: null, profileSkills: ["SQL"] });
    expect(v.source).toBe("profile");
    expect(v.status.SQL).toBe("existing");
    expect(v.plan.bullets).toEqual([]);
  });

  it("bullet steps ask about the dashboard tool the market wants", () => {
    const v = buildTargetView(base);
    expect(v.plan.bullets[0].tips.find((t) => t.kind === "tool_question")?.text).toMatch(/^Did you use Tableau/);
  });
});
