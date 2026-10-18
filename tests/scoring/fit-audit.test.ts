import { describe, it, expect } from "vitest";
import { displayLabel, requirementFit, scoreFit, type FitJob } from "@/lib/scoring/fit";
import type { StudentProfile } from "@/lib/types";
import type { CoverageItem, CoverageResult } from "@/lib/scoring/coverage";

/** Audit 10 (fit, eligibility) worked examples. Today is mid-October 2026: spring 2027 / summer 2027 cycle. */
const today = "2026-10-18";
const student = (over: Partial<StudentProfile> = {}): StudentProfile => ({
  year: "2nd", gradYear: null, locationPref: ["london"], needsVisa: false, skills: [],
  archetypes: [{ key: "data_analytics", score: 90, why: [] }, { key: "finance_banking", score: 70, why: [] }], ...over,
});
const job = (over: Partial<FitJob> = {}): FitJob => ({
  id: "j", title: "Data Analyst Intern", location: "London", remote: false, archetype: "data_analytics",
  yearEligibility: [], sponsorsVisa: "unknown", employmentType: "internship", firstYearFriendly: false,
  requirements: [], textLines: [], deadline: null, postedAt: null, ...over,
});
const items = (must: CoverageItem["status"][], nice: CoverageItem["status"][] = []): CoverageItem[] => [
  ...must.map((status, i) => ({ skill: `M${i}`, section: "must" as const, status })),
  ...nice.map((status, i) => ({ skill: `N${i}`, section: "nice" as const, status })),
];
const cov = (its: CoverageItem[]): CoverageResult => {
  if (!its.length) return { readable: false, weighted: null, must: { matched: 0, total: 0 }, nice: { matched: 0, total: 0 }, items: [] };
  const credit = { existing: 1, supportedByResume: 0.75, gap: 0 };
  const w = (s: "must" | "nice") => (s === "must" ? 2 : 1);
  const num = its.reduce((n, i) => n + w(i.section) * credit[i.status], 0), den = its.reduce((n, i) => n + w(i.section), 0);
  const count = (s: "must" | "nice") => ({ matched: its.filter((i) => i.section === s && i.status !== "gap").length, total: its.filter((i) => i.section === s).length });
  return { readable: true, weighted: num / den, must: count("must"), nice: count("nice"), items: its };
};
const gate = (r: ReturnType<typeof scoreFit>, key: string) => r.gates.find((g) => g.key === key)!;

describe("10#4: deadline is urgency, not fit", () => {
  it("the audit's tie is broken: zero skills with a near deadline no longer equals 100% skills with no deadline", () => {
    const zero = scoreFit(student(), job({ deadline: "2026-11-07" }), cov(items(["gap", "gap", "gap"])), today);
    const full = scoreFit(student(), job({ archetype: "software_eng", deadline: null }), cov(items(["existing", "existing", "existing"])), today);
    expect(zero.global).toBe(3.4);
    expect(full.global).toBe(4.2);
    expect(full.global).toBeGreaterThan(zero.global);
  });
  it("no published deadline is not penalised and a deadline doesn't raise the score", () => {
    const c = cov(items(["existing"]));
    const none = scoreFit(student(), job({ deadline: null }), c, today).global;
    for (const deadline of ["2026-10-19", "2026-10-25", "2026-12-31"]) expect(scoreFit(student(), job({ deadline }), c, today).global).toBe(none);
  });
  it("urgency chips: 'Closes in 5 days', 'Rolling: apply early'", () => {
    expect(scoreFit(student(), job({ deadline: "2026-10-23" }), cov([]), today).urgency).toMatchObject({ chip: "Closes in 5 days", rank: 0 });
    expect(scoreFit(student(), job({ rolling: true }), cov([]), today).urgency).toMatchObject({ chip: "Rolling: apply early", rank: 1 });
    expect(scoreFit(student(), job(), cov([]), today).urgency).toMatchObject({ chip: null, rank: 2 });
  });
  it("firstYearFriendly no longer bumps the score", () => {
    const s = student({ year: "1st" });
    expect(scoreFit(s, job({ firstYearFriendly: true }), cov([]), today).global).toBe(scoreFit(s, job(), cov([]), today).global);
  });
});

describe("10#5: must-haves decide requirement fit", () => {
  it("missing 3/3 must-haves with 6/6 nice-to-haves scores 1.2, not the old 3.0", () => {
    expect(requirementFit(cov(items(["gap", "gap", "gap"], Array(6).fill("existing"))))).toBeCloseTo(1.2, 5);
  });
  it("partial (prose-only) must-haves count half; nice-to-haves only nudge ±0.2", () => {
    expect(requirementFit(cov(items(["existing", "supportedByResume"])))).toBeCloseTo(4, 5);
    expect(requirementFit(cov(items(["existing", "existing"], ["gap", "gap"])))).toBeCloseTo(4.8, 5);
  });
  it("a stated must-have that is missing caps the label at Stretch", () => {
    const j = job({ requirements: [{ text: "Must have SQL", skill: "SQL", importance: "critical", section: "must", evidenceTier: "stated" }] });
    const c = cov([{ skill: "SQL", section: "must", status: "gap" }, ...items([], ["existing"])]);
    const r = scoreFit(student(), j, c, today);
    expect(r.mustCap).toMatch(/SQL/);
    expect(r.global).toBeLessThanOrEqual(3.9);
    // the same gap under a structural (heading-only) requirement doesn't cap
    const structural = scoreFit(student(), job({ requirements: [{ ...j.requirements[0], evidenceTier: "structural" }] }), c, today);
    expect(structural.mustCap).toBeNull();
  });
});

describe("10#2: graduation-year windows", () => {
  const jpm = job({ title: "2027 Spring Insights", employmentType: "spring_week", textLines: ["Open to a student expecting to graduate in 2029."] });
  it("JPM Spring 2027 'expecting to graduate in 2029' passes a 2029 graduate and fails 2028 with the quote", () => {
    expect(scoreFit(student({ gradYear: 2029 }), jpm, cov([]), today).capped).toBe(false);
    const r = scoreFit(student({ gradYear: 2028 }), jpm, cov([]), today);
    expect(gate(r, "year")).toMatchObject({ passed: false, reason: "Asks for students graduating in 2029; you graduate in 2028", quote: "Open to a student expecting to graduate in 2029." });
  });
  it("'graduating in 2028' on a 2027 summer internship means penultimate, not final", () => {
    const j = job({ title: "Summer Analyst 2027", textLines: ["For students graduating in 2028."] });
    expect(scoreFit(student({ year: "final", gradYear: 2027 }), j, cov([]), today).capped).toBe(true);
    expect(scoreFit(student({ year: "2nd", gradYear: 2028 }), j, cov([]), today).capped).toBe(false);
  });
  it("without a grad year, a window fails only when no course length fits", () => {
    const j = job({ textLines: ["Students graduating in 2029"] });
    const r = scoreFit(student({ year: "2nd" }), j, cov([]), today); // 2nd year: 2028 (3-year) or 2029 (4-year)
    expect(r.capped).toBe(false);
    expect(r.notes.join(" ")).toMatch(/Add your graduation year/);
    expect(scoreFit(student({ year: "final" }), j, cov([]), today).capped).toBe(true);
  });
  it("a graduate role starting next year gates a 2nd year (still studying) but not a finalist", () => {
    expect(gate(scoreFit(student({ year: "2nd", gradYear: 2028 }), job({ employmentType: "graduate" }), cov([]), today), "year").passed).toBe(false);
    expect(scoreFit(student({ year: "final", gradYear: 2027 }), job({ employmentType: "graduate" }), cov([]), today).capped).toBe(false);
  });
  it("internship default (graduating the year after) is a soft flag, never a gate", () => {
    const r = scoreFit(student({ year: "1st", gradYear: 2029 }), job(), cov([]), today);
    expect(r.capped).toBe(false);
    expect(r.softFlags).toEqual(["2027 summer internships usually recruit students graduating in 2028: check this one takes your year"]);
  });
});

describe("10#14: the grad year settles '2nd' vs 'penultimate'", () => {
  const penult = job({ yearEligibility: ["penultimate", "2nd"], textLines: ["Open to penultimate year students."] });
  it("a 2nd year on a 4-year MEng (graduating 2029) is not penultimate", () => {
    const r = scoreFit(student({ year: "2nd", gradYear: 2029 }), penult, cov([]), today);
    expect(gate(r, "year")).toMatchObject({ passed: false, reason: "Open to penultimate year only", quote: "Open to penultimate year students." });
  });
  it("a 2nd year on a 3-year degree (graduating 2028) is penultimate", () => {
    expect(scoreFit(student({ year: "2nd", gradYear: 2028 }), penult, cov([]), today).capped).toBe(false);
  });
  it("without a grad year the ambiguous 2nd year is not gated", () => {
    expect(scoreFit(student({ year: "2nd" }), penult, cov([]), today).capped).toBe(false);
  });
  it("spring weeks without a grad year gate penultimate and final years, not 1st or 2nd", () => {
    const spring = job({ employmentType: "spring_week", yearEligibility: ["1st", "2nd"] });
    expect(scoreFit(student({ year: "penultimate" }), spring, cov([]), today).capped).toBe(true);
    expect(scoreFit(student({ year: "final" }), spring, cov([]), today).capped).toBe(true);
    expect(scoreFit(student({ year: "2nd" }), spring, cov([]), today).capped).toBe(false);
  });
});

describe("10#3: 'Check eligibility', never a verdict, and contestable", () => {
  const gated = job({ yearEligibility: ["final"] });
  it("a failed gate reads Check eligibility", () => {
    const r = scoreFit(student(), gated, cov([]), today);
    expect(r.eligibility).toBe("check");
    expect(displayLabel(r)).toBe("Check eligibility");
  });
  it("'This is wrong' lifts the cap and keeps the gate visible as overridden", () => {
    const r = scoreFit(student(), gated, cov([]), today, { overridden: true });
    expect(r.capped).toBe(false);
    expect(r.eligibility).toBe("overridden");
    expect(gate(r, "year")).toMatchObject({ passed: true, overridden: true });
    expect(r.global).toBe(scoreFit(student(), job(), cov([]), today).global);
    expect(displayLabel(r)).toBe(r.label);
  });
  it("an override on a job with no failed gate changes nothing", () => {
    expect(scoreFit(student(), job(), cov([]), today, { overridden: true }).eligibility).toBe("ok");
  });
  it("the visa gate quotes the posting's refusal", () => {
    const r = scoreFit(student({ year: "final", needsVisa: true }), job({ employmentType: "graduate", sponsorsVisa: "no", textLines: ["We are unable to offer visa sponsorship for this role."] }), cov([]), today);
    expect(gate(r, "visa")).toMatchObject({ passed: false, quote: "We are unable to offer visa sponsorship for this role." });
  });
});

describe("10#6: degree-class floor is soft", () => {
  const j = job({ textLines: ["You should be on track for a 2:1 or above."] });
  it("a 2:2 on the CV is a soft flag with routes, never a gate", () => {
    const r = scoreFit(student(), j, cov([]), today, { cvGrade: "Predicted 2:2" });
    expect(r.capped).toBe(false);
    expect(r.softFlags[0]).toMatch(/^Asks for at least a 2:1; your CV shows a 2:2\. Check for contextual offers/);
  });
  it("a 2:1 or First passes silently; an unknown grade gets a note only", () => {
    expect(scoreFit(student(), j, cov([]), today, { cvGrade: "First Class" }).softFlags).toEqual([]);
    const r = scoreFit(student(), j, cov([]), today, { cvGrade: null });
    expect(r.softFlags).toEqual([]);
    expect(r.notes).toContain("Asks for at least a 2:1.");
  });
  it("mentions contextual recruitment when the posting does", () => {
    const r = scoreFit(student(), job({ textLines: ["Minimum 2:1.", "We use contextual recruitment."] }), cov([]), today, { cvGrade: "2:2" });
    expect(r.softFlags[0]).toMatch(/contextual recruitment/);
  });
});

describe("10#7: years-of-experience knockout", () => {
  const senior = job({ title: "Junior Software Engineer (2+ years' commercial experience)", employmentType: "other" });
  it("gates a student, quoting the line", () => {
    const r = scoreFit(student({ year: "1st" }), senior, cov([]), today);
    expect(gate(r, "experience")).toMatchObject({ passed: false, reason: "Asks for 2+ years' experience" });
  });
  it("does not gate someone who has already graduated", () => {
    expect(gate(scoreFit(student({ year: "final", gradYear: 2026 }), senior, cov([]), today), "experience").passed).toBe(true);
  });
});

describe("10#8: permanent graduate-entry roles", () => {
  const perm = job({ employmentType: "permanent", title: "Graduate Software Engineer 2027" });
  it("final-years and masters students are not blocked", () => {
    for (const year of ["final", "masters"] as const) {
      const r = scoreFit(student({ year }), perm, cov([]), today);
      expect(r.capped, year).toBe(false);
      expect(r.notes).toContain("Permanent role: check it starts after you graduate.");
    }
    expect(scoreFit(student({ year: "final", gradYear: 2027 }), perm, cov([]), today).capped).toBe(false);
  });
  it("a student graduating after the start is", () => {
    expect(gate(scoreFit(student({ year: "2nd", gradYear: 2028 }), perm, cov([]), today), "permanent").reason).toBe("Permanent role starting by 2027, before you graduate in 2028");
  });
});

describe("10#17: multi-country locations", () => {
  it("'EMEA' and 'Europe' postings aren't hard-gated for a London-only student", () => {
    expect(scoreFit(student(), job({ location: "EMEA" }), cov([]), today).gates.every((g) => g.passed)).toBe(true);
    const eu = scoreFit(student(), job({ location: "Europe", textLines: ["Roles in London, Paris or Madrid"] }), cov([]), today);
    expect(eu.sub.location).toBe(3.5);
    expect(eu.capped).toBe(false);
  });
  it("an explicit non-UK city is still gated", () => {
    expect(gate(scoreFit(student(), job({ location: "Paris, France" }), cov([]), today), "location").passed).toBe(false);
  });
});

describe("10#31 and 10#26", () => {
  it("cohort clash doesn't hit placements", () => {
    expect(scoreFit(student(), job({ employmentType: "placement", cohortClash: true }), cov([]), today).softFlags.join()).not.toMatch(/Term-time/);
  });
  it("degree subject: a strict mismatch flags, 'or related' only notes", () => {
    const strict = scoreFit(student(), job({ textLines: ["You must hold a degree in Computer Science."] }), cov([]), today, { course: "BA History" });
    expect(strict.softFlags).toContain("Asks for a degree in computer science.");
    const related = scoreFit(student(), job({ textLines: ["We welcome applicants from computer science or related courses"] }), cov([]), today, { course: "BA History" });
    expect(related.softFlags).toEqual([]);
    expect(related.notes.join(" ")).toMatch(/or a related degree/);
    expect(scoreFit(student(), job({ textLines: ["We welcome applicants from computer science or related courses"] }), cov([]), today, { course: "BSc Computer Science" }).notes).toEqual([]);
  });
  it("language requirements are noted", () => {
    expect(scoreFit(student(), job({ textLines: ["Fluent German is essential."] }), cov([]), today).notes.join(" ")).toMatch(/German/);
  });
});
