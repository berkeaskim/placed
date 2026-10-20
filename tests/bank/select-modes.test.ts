import { describe, expect, it } from "vitest";
import { isSchoolEra, schoolCapReason, selectForJob, type SelectOpts } from "@/lib/bank/select";
import type { Bank, BankBullet, BankEntry } from "@/lib/bank/types";
import type { ParsedCV } from "@/lib/types";
import type { JobListItem } from "@/lib/db/queries";

const NOW = "2026-10";
type B = Partial<BankBullet> & { id: string; text: string };
function entry(id: string, section: BankEntry["section"], org: string, title: string, startYm: string | null, endYm: string | null, bullets: B[]): BankEntry {
  return {
    id, section, org, title, dates: "", startYm, endYm, location: "", pinned: false, hidden: false, sourceIds: [], updatedAt: "",
    bullets: bullets.map((b, i) => ({ entryId: id, position: i, pinned: false, hidden: false, sourceIds: [], sourceText: null, updatedAt: "", ...b })),
  };
}
const cv: ParsedCV = {
  name: "Ada", email: "a@b.co", phone: "07700 900000", location: "London", links: [], summary: null,
  education: [{ id: "ed0", institution: "UCL", degree: "BSc Economics", dates: "2025 - 2028", grade: null, details: [] }],
  experience: [], projects: [], leadership: [], skills: [{ group: "Skills", items: ["Excel"] }],
  interests: null, sectionOrder: ["education", "projects", "experience", "skills"], yearGuess: null, archetypes: [],
};
const job = (employmentType: string, textLines: string[] = ["About the programme"]) => ({
  id: "j", title: "Spring Insight", company: "Bank", url: "", summary: "", extId: "j", location: null, remote: null, archetype: "finance_banking",
  employmentType, requirements: [], textLines, deadline: null, postedAt: null,
}) as unknown as JobListItem;
const opts = (o: Partial<SelectOpts> = {}): SelectOpts => ({ pinnedForJob: [], excludedForJob: [], activeCvSourceId: null, nowYm: NOW, ...o });

/** Three quantified hackathon projects outscore everything a spring screener actually wants. */
function springBank(): Bank {
  const hack = (n: number) => entry(`p${n}`, "projects", `Hackathon ${n}`, "Team member", "2026-01", "2026-02", [
    { id: `p${n}a`, text: `Built a ${n * 10}-screen budgeting app with 4 teammates in 24 hours` },
    { id: `p${n}b`, text: `Placed ${n}rd of 30 teams with a 95% test pass rate` },
  ]);
  return {
    entries: [
      hack(1), hack(2), hack(3),
      entry("tesco", "experience", "Tesco", "Customer Assistant", "2024-06", "2025-08", [
        { id: "t1", text: "Served customers on the tills at weekends" }, { id: "t2", text: "Restocked the chilled aisle" },
      ]),
      entry("headgirl", "leadership", "Hillside Sixth Form", "Head Girl", "2024-09", "2025-07", [
        { id: "h1", text: "Represented students at governors' meetings" }, { id: "h2", text: "Ran the prefect rota" },
      ]),
      entry("invsoc", "leadership", "UCL Investment Society", "Member", "2025-10", null, [
        { id: "i1", text: "Completed the J.P. Morgan Investment Banking Job Simulation (Forage)" }, { id: "i2", text: "Attended weekly markets briefings" },
      ]),
    ],
  };
}
const ids = (s: ReturnType<typeof selectForJob>) => [...s.base.experience, ...s.base.projects, ...s.base.leadership].map((e) => e.id);
const BUDGET = 22;

describe("selectForJob spring mode", () => {
  it("keeps a job, two responsibility entries and an interest entry even when projects outscore them", () => {
    const spring = selectForJob(springBank(), cv, job("spring_week"), opts({ mode: "spring", lineBudget: BUDGET }));
    expect(ids(spring)).toEqual(expect.arrayContaining(["tesco", "headgirl", "invsoc"]));
    const reasons = Object.fromEntries(spring.report.added.map((a) => [a.id, a.reason]));
    expect(reasons.tesco).toBe("kept: spring weeks look for a job");
    expect(reasons.invsoc).toMatch(/^kept: spring weeks look for (responsibility|interest in the sector)$/);
  });
  it("standard mode on the same bank keeps the projects", () => {
    const standard = selectForJob(springBank(), cv, job("spring_week"), opts({ lineBudget: BUDGET }));
    expect(ids(standard)).toEqual(expect.arrayContaining(["p1", "p2", "p3"]));
    expect(ids(standard)).not.toContain("headgirl");
  });
  it("orders sections education, experience, leadership, projects", () => {
    const s = selectForJob(springBank(), cv, job("spring_week"), opts({ mode: "spring", lineBudget: BUDGET }));
    expect(s.base.sectionOrder.slice(0, 4)).toEqual(["education", "experience", "leadership", "projects"]);
  });
  it("caps school-era entries at two and says why", () => {
    const school = (n: number) => entry(`s${n}`, "leadership", "Hillside School", `Captain ${n}`, "2023-09", "2025-07", [{ id: `s${n}a`, text: `Captained the under-18 team ${n}` }]);
    const bank: Bank = { entries: [school(1), school(2), school(3), school(4)] };
    const s = selectForJob(bank, cv, job("spring_week"), opts({ mode: "spring" }));
    expect(ids(s).filter((id) => id.startsWith("s"))).toHaveLength(2);
    const capped = s.report.leftOut.filter((i) => i.reason === schoolCapReason(2));
    expect(capped).toHaveLength(2);
  });
  it("quietly leaves an unmet quota when the bank has no job", () => {
    const bank = springBank();
    bank.entries = bank.entries.filter((e) => e.section !== "experience");
    expect(() => selectForJob(bank, cv, job("spring_week"), opts({ mode: "spring", lineBudget: BUDGET }))).not.toThrow();
  });
  it("lets a sixth-form item compete: spring recency is floored", () => {
    const s = selectForJob(springBank(), cv, job("spring_week"), opts({ mode: "spring" }));
    const std = selectForJob(springBank(), cv, job("spring_week"), opts());
    expect(s.scores.h1).toBeGreaterThan(std.scores.h1);
  });
});

describe("selectForJob placement mode", () => {
  it("keeps a project, a job and a responsibility entry; one school-era item at most", () => {
    const bank: Bank = {
      entries: [
        entry("x1", "experience", "Costa", "Barista", "2026-06", "2026-09", [{ id: "x1a", text: "Served 200 customers a shift" }]),
        entry("pr", "projects", "UCL", "Bridge design project", "2026-01", "2026-04", [{ id: "pra", text: "Modelled loads in MATLAB" }]),
        entry("sc1", "leadership", "Hillside School", "Prefect", "2023-09", "2025-07", [{ id: "sc1a", text: "Ran the lunch rota" }]),
        entry("sc2", "leadership", "Hillside School", "House Captain", "2023-09", "2025-07", [{ id: "sc2a", text: "Captained house sports" }]),
      ],
    };
    const s = selectForJob(bank, cv, job("placement", ["## Requirements", "- MATLAB"]), opts({ mode: "placement" }));
    expect(ids(s)).toEqual(expect.arrayContaining(["x1", "pr"]));
    expect(ids(s).filter((id) => id.startsWith("sc"))).toHaveLength(1);
    expect(s.report.leftOut.find((i) => i.id.startsWith("sc"))?.reason).toBe(schoolCapReason(1));
  });
});

describe("standard mode is unchanged", () => {
  it("gives identical output with mode omitted and mode standard", () => {
    const a = selectForJob(springBank(), cv, job("internship"), opts({ lineBudget: BUDGET }));
    const b = selectForJob(springBank(), cv, job("internship"), opts({ lineBudget: BUDGET, mode: "standard" }));
    expect(JSON.stringify(b)).toBe(JSON.stringify(a));
    expect(a.base.sectionOrder.slice(0, 2)).toEqual(["education", "projects"]); // the active CV's own order
  });
});

describe("isSchoolEra", () => {
  it("uses the university start and school names, never the university itself", () => {
    expect(isSchoolEra({ org: "Tesco", endYm: "2025-08" }, cv)).toBe(true);
    expect(isSchoolEra({ org: "Tesco", endYm: "2026-01" }, cv)).toBe(false);
    expect(isSchoolEra({ org: "King's College School", endYm: null }, cv)).toBe(true);
    expect(isSchoolEra({ org: "UCL", endYm: null }, { ...cv, education: [{ ...cv.education[0], institution: "UCL" }] })).toBe(false);
  });
});
