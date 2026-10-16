import { describe, it, expect } from "vitest";
import { marketDemand, readiness, type DemandJob } from "@/lib/target/market";
import { profileSkillSource } from "@/lib/scoring/coverage";

const job = (id: string, skills: [string, "must" | "nice"][], o: Partial<DemandJob> = {}): DemandJob => ({
  id, archetype: "data_analytics", is_live: true, deadline: null,
  skills: skills.map(([skill, section]) => ({ skill, section })), ...o,
});
const TODAY = "2026-10-13";
const jobs: DemandJob[] = [
  job("1", [["SQL", "must"], ["Python", "nice"]]),
  job("2", [["SQL", "must"], ["Excel", "must"]]),
  job("3", [["SQL", "nice"], ["Python", "must"]]),
  job("4", [["Tableau", "nice"]]),
  job("5", [["SQL", "must"]]),
  job("x", [["Java", "must"]], { archetype: "software_eng" }),
  job("dead", [["R", "must"]], { is_live: false }),
  job("past", [["R", "must"]], { deadline: "2026-10-01" }),
];

describe("marketDemand", () => {
  it("counts only live, open jobs of the archetype", () => {
    const d = marketDemand(jobs, "data_analytics", TODAY);
    expect(d.n).toBe(5);
    expect(d.items.find((i) => i.skill === "R")).toBeUndefined();
    expect(d.items.find((i) => i.skill === "Java")).toBeUndefined();
  });

  it("sorts by number of jobs and marks must when most mentions are must", () => {
    const d = marketDemand(jobs, "data_analytics", TODAY);
    expect(d.items[0]).toMatchObject({ skill: "SQL", jobs: 4, share: 0.8, mustShare: 0.75, section: "must" });
    expect(d.items.find((i) => i.skill === "Python")).toMatchObject({ jobs: 2, mustShare: 0.5, section: "must" });
    expect(d.items.find((i) => i.skill === "Tableau")).toMatchObject({ jobs: 1, section: "nice" });
  });

  it("counts a skill once per job, as must if any mention is must", () => {
    const d = marketDemand([job("1", [["SQL", "nice"], ["SQL", "must"]])], "data_analytics", TODAY);
    expect(d.items[0]).toMatchObject({ jobs: 1, mustShare: 1 });
  });

  it("keeps an 'X or Y' group as one item", () => {
    const g: DemandJob = { ...job("g", []), skills: [{ skill: "Python or R", anyOf: ["Python", "R"], section: "must" }] };
    const d = marketDemand([g, { ...g, id: "h" }], "data_analytics", TODAY);
    expect(d.items).toHaveLength(1);
    expect(d.items[0]).toMatchObject({ skill: "Python or R", anyOf: ["Python", "R"], jobs: 2 });
  });

  it("caps at 12 items and breaks ties alphabetically", () => {
    const many = Array.from({ length: 15 }, (_, i) => String.fromCharCode(90 - i)); // Z..L
    const d = marketDemand([job("1", many.map((s) => [s, "nice"] as [string, "nice"]))], "data_analytics", TODAY);
    expect(d.items).toHaveLength(12);
    expect(d.items[0].skill).toBe("L");
  });

  it("flags small samples", () => {
    expect(marketDemand(jobs.slice(0, 3), "data_analytics", TODAY).smallSample).toBe(true);
    expect(marketDemand(jobs, "data_analytics", TODAY).smallSample).toBe(false);
  });
});

describe("readiness", () => {
  it("never shows 100% while a gap exists and names the sample", () => {
    const d = marketDemand(jobs, "data_analytics", TODAY);
    const r = readiness(d, profileSkillSource(["SQL", "Python", "Excel"]));
    expect(r.pct).not.toBeNull();
    expect(r.pct!).toBeLessThan(100);
    expect(r.label).toBe("Readiness vs 5 live Data & Analytics internships");
  });

  it("shows 100% only when every item is existing", () => {
    const d = marketDemand(jobs, "data_analytics", TODAY);
    expect(readiness(d, profileSkillSource(["SQL", "Python", "Excel", "Tableau"])).pct).toBe(100);
  });

  it("hides the percentage on small samples but still reports gaps", () => {
    const r = readiness(marketDemand(jobs.slice(0, 3), "data_analytics", TODAY), profileSkillSource(["SQL"]));
    expect(r.pct).toBeNull();
    expect(r.label).toBe("Small sample — 3 live Data & Analytics roles");
    expect(r.coverage.items.filter((i) => i.status === "gap").map((i) => i.skill)).toContain("Python");
  });

  it("handles a role with no live jobs", () => {
    const r = readiness(marketDemand([], "product", TODAY), profileSkillSource(["SQL"]));
    expect(r.pct).toBeNull();
    expect(r.label).toBe("No live Product roles right now");
  });
});

describe("readiness counts only recurring skills", () => {
  it("has no % when every skill comes from a single posting", () => {
    const one = ["SQL", "Python", "Excel", "Tableau", "Figma"].map((s, n) => job(String(n), [[s, "must"]]));
    const r = readiness(marketDemand(one, "data_analytics", TODAY), profileSkillSource(["SQL"]));
    expect(r.pct).toBeNull();
    expect(r.label).toBe("No skill shows up in more than one live Data & Analytics role yet");
    expect(r.coverage.items).toHaveLength(5);
  });
  it("ignores one-off skills in the %, but still never shows 100% with a gap", () => {
    const d = marketDemand(jobs, "data_analytics", TODAY);
    expect(readiness(d, profileSkillSource(["SQL", "Python"])).pct).toBe(99);
  });
});
