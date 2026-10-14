import { describe, it, expect } from "vitest";
import { strengthenPlan, CONCEPT_TOOLS, confirmedSkills, MAX_BULLET_STEPS, MAX_NUMBER_ONLY } from "@/lib/target/strengthen";
import { marketDemand, readiness, type DemandJob } from "@/lib/target/market";
import { cvSkillSource, profileSkillSource } from "@/lib/scoring/coverage";
import { SKILLS } from "@/lib/skills/vocab";
import type { ParsedCV } from "@/lib/types";

const TODAY = "2026-10-14";
const job = (id: string, skills: [string, "must" | "nice"][], anyOf?: string[]): DemandJob => ({
  id, archetype: "data_analytics", is_live: true, deadline: null,
  skills: [...skills.map(([skill, section]) => ({ skill, section })), ...(anyOf ? [{ skill: anyOf.join(" or "), anyOf, section: "must" as const }] : [])],
});
// 6 jobs: SQL 6 (must), Tableau 4 (must), Python 3 (nice), R 2 (nice), Excel 5 (must)
const JOBS = [
  job("1", [["SQL", "must"], ["Tableau", "must"], ["Excel", "must"], ["Python", "nice"]]),
  job("2", [["SQL", "must"], ["Tableau", "must"], ["Excel", "must"], ["R", "nice"]]),
  job("3", [["SQL", "must"], ["Tableau", "must"], ["Excel", "must"]]),
  job("4", [["SQL", "must"], ["Tableau", "nice"], ["Excel", "must"], ["Python", "nice"]]),
  job("5", [["SQL", "must"], ["Excel", "must"], ["R", "nice"]]),
  job("6", [["SQL", "must"], ["Python", "nice"]]),
];

const entry = (id: string, title: string, org: string, bullets: string[]) =>
  ({ id, org, title, dates: "2025", location: "London", bullets: bullets.map((text, i) => ({ id: `${id}-b${i}`, text })) });

function cvWith(over: Partial<ParsedCV> = {}): ParsedCV {
  return {
    name: "Test Student", email: "t@example.com", phone: null, location: null, links: [], summary: null,
    education: [{ id: "ed1", institution: "UCL", degree: "BSc Economics", dates: "2024–2027", grade: null,
      details: [{ id: "ed1-d0", text: "Modules: Econometrics (R), Statistics" }] }],
    experience: [entry("x1", "Sales Assistant", "Tesco", [
      "Served customers at the till during busy weekend shifts",
      "Built a weekly sales dashboard for the store manager",
    ])],
    projects: [entry("p1", "Housing project", "Personal", ["We analysed a dataset of London rents using Excel and leveraged it in a robust report"])],
    leadership: [], skills: [{ group: "Tools", items: ["Excel"] }], interests: null,
    sectionOrder: ["education", "experience", "projects", "skills"], yearGuess: "2nd", archetypes: [],
    ...over,
  };
}

function plan(cv: ParsedCV | null, claims: string[] = []) {
  const d = marketDemand(JOBS, "data_analytics", TODAY);
  const src = cv ? cvSkillSource(cv) : profileSkillSource(["Excel"]);
  const r = readiness(d, src);
  return { r, p: strengthenPlan({ cv, cvSource: src, coverage: r.coverage, demand: d, confirmedClaims: claims, pct: r.pct }) };
}

describe("CONCEPT_TOOLS", () => {
  it("names only skills-vocab canonicals", () => {
    const canon = new Set(SKILLS.map((s) => s.canonical));
    for (const c of CONCEPT_TOOLS) for (const t of c.tools) expect(canon.has(t), t).toBe(true);
  });
});

describe("strengthenPlan: skills", () => {
  it("R only in a module → make it visible, quoting the line it came from", () => {
    const { p } = plan(cvWith());
    const r = p.visible.find((s) => s.skill === "R");
    expect(r?.status).toBe("supportedByResume");
    expect(r?.where).toBe("Modules: Econometrics (R), Statistics");
    expect(r?.text).toContain("Your CV already shows it");
  });

  it("gaps are questions, never claims; must-haves come first", () => {
    const { p } = plan(cvWith());
    expect(p.gaps.map((g) => g.skill)).toEqual(["SQL", "Tableau", "Python"]);
    for (const g of p.gaps) {
      expect(g.status).toBe("gap");
      expect(g.text).toMatch(/If you have really used it/);
    }
  });

  it("skills already on the CV (Excel in skills list) are neither visible steps nor gaps", () => {
    const { p } = plan(cvWith());
    expect([...p.visible, ...p.gaps].some((s) => s.skill === "Excel")).toBe(false);
  });

  it("a skill the student confirmed becomes 'confirmed' and raises projected readiness", () => {
    const before = plan(cvWith());
    const after = plan(cvWith(), ["SQL: I wrote SQL queries for my dissertation data on Postgres"]);
    expect(after.p.gaps.find((g) => g.skill === "SQL")?.status).toBe("confirmed");
    expect(after.p.gaps[0].status).toBe("gap"); // open gaps stay on top
    expect(after.p.projected).not.toBeNull();
    expect(after.p.projected!).toBeGreaterThan(before.p.projected ?? before.r.pct!);
    expect(after.p.projected!).toBeLessThan(100);
  });

  it("confirmed skills come from the claim text, as canonicals", () => {
    expect([...confirmedSkills(["Used tableau and power bi at work", "nothing here"])].sort()).toEqual(["power bi", "tableau"]);
  });

  it("anyOf groups keep their alternatives as options", () => {
    const d = marketDemand([job("1", [], ["Python", "R"])], "data_analytics", TODAY);
    const src = cvSkillSource(cvWith({ education: [] }));
    const r = readiness(d, src);
    const p = strengthenPlan({ cv: cvWith({ education: [] }), cvSource: src, coverage: r.coverage, demand: d, confirmedClaims: [], pct: r.pct });
    expect(p.gaps[0].options).toEqual(["Python", "R"]);
  });
});

describe("strengthenPlan: bullets", () => {
  it("asks about a tool the bullet implies and the market wants; never asserts it", () => {
    const { p } = plan(cvWith());
    const dash = p.bullets.find((b) => b.text.startsWith("Built a weekly sales dashboard"))!;
    const q = dash.tips.find((t) => t.kind === "tool_question")!;
    expect(q.ask).toBe(true);
    expect(q.text).toMatch(/^Did you use Tableau/);
    expect(q.text).toContain("Only if you really did");
    expect(q.text).toContain("4 of 6");
  });

  it("never asks about a tool the CV already evidences (Excel)", () => {
    const { p } = plan(cvWith());
    for (const b of p.bullets) for (const t of b.tips) if (t.kind === "tool_question") expect(t.text).not.toMatch(/\bExcel\b/);
  });

  it("does not ask about a tool the student already confirmed", () => {
    const { p } = plan(cvWith(), ["Tableau: built two dashboards in my placement"]);
    const dash = p.bullets.find((b) => b.text.startsWith("Built a weekly sales dashboard"))!;
    expect(dash.tips.find((t) => t.kind === "tool_question")?.text ?? "").not.toMatch(/Tableau/);
  });

  it("flags the CV Score's own issues: no number, we/our, cliché", () => {
    const { p } = plan(cvWith());
    const proj = p.bullets.find((b) => b.entryId === "p1")!;
    const kinds = proj.tips.map((t) => t.kind);
    expect(kinds).toEqual(expect.arrayContaining(["number", "we", "cliche"]));
    expect(proj.tips.find((t) => t.kind === "number")!.ask).toBe(true);
    expect(proj.tips.find((t) => t.kind === "cliche")!.text).toContain("leveraged");
  });

  it("a bullet with a real number gets no number tip", () => {
    const { p } = plan(cvWith({ projects: [entry("p1", "Rents", "Personal", ["Analysed 1,200 London rents in Excel, cutting report time by 30%"])] }));
    const b = p.bullets.find((x) => x.entryId === "p1");
    expect(b?.tips.some((t) => t.kind === "number") ?? false).toBe(false);
  });

  it("suggests leading an entry with the first bullet that shows a market skill", () => {
    const cv = cvWith({ experience: [entry("x1", "Intern", "Acme", ["Answered phones and booked 40 meetings a week", "Wrote SQL to clean 3 years of sales data"])] });
    const { p } = plan(cv);
    const sql = p.bullets.find((b) => b.bulletId === "x1-b1")!;
    expect(sql.shows).toContain("SQL");
    expect(sql.tips[0]).toMatchObject({ kind: "move_up", ask: false });
    const idx = (id: string) => p.bullets.findIndex((b) => b.bulletId === id);
    expect(idx("x1-b1")).toBeLessThan(idx("x1-b0") === -1 ? Infinity : idx("x1-b0")); // relevance first
  });

  it("caps the number of bullet steps and is deterministic", () => {
    const many = Array.from({ length: 12 }, (_, k) => `We helped with task number ${"abcdefghijkl"[k]} for the team`);
    const cv = cvWith({ experience: [entry("x1", "Volunteer", "Charity", many)] });
    const a = plan(cv).p.bullets, b = plan(cv).p.bullets;
    expect(a.length).toBe(MAX_BULLET_STEPS);
    expect(a).toEqual(b);
  });

  it("shows at most a few bullets whose only step is 'add a number'", () => {
    const plain = Array.from({ length: 8 }, (_, k) => `Greeted visitors at the door on shift ${"abcdefgh"[k]}`);
    const { p } = plan(cvWith({ experience: [entry("x1", "Assistant", "Shop", plain)], projects: [] }));
    expect(p.bullets.filter((b) => b.tips.length === 1 && b.tips[0].kind === "number").length).toBe(MAX_NUMBER_ONLY);
  });

  it("with no CV there are no bullet steps and no visible-skill steps", () => {
    const { p } = plan(null);
    expect(p.bullets).toEqual([]);
    expect(p.visible).toEqual([]);
    expect(p.gaps.length).toBeGreaterThan(0);
  });
});
