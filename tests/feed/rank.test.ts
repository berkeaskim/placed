import { describe, it, expect } from "vitest";
import { rankJobs, applyXp } from "@/lib/feed/rank";
import type { JobListItem } from "@/lib/db/queries";
import type { StudentProfile } from "@/lib/types";
import { parseEligibility } from "@/lib/scoring/eligibility";

const student: StudentProfile = { year: "2nd", locationPref: ["london"], needsVisa: false, skills: ["SQL"], archetypes: [{ key: "data_analytics", score: 90, why: [] }] };
const job = (id: string, over: Partial<JobListItem> = {}): JobListItem => ({
  id, extId: id, company: "Acme", url: "https://x", summary: "", title: "Data Analyst Intern", location: "London", remote: false,
  archetype: "data_analytics", yearEligibility: [], sponsorsVisa: "unknown", employmentType: "internship", firstYearFriendly: false,
  requirements: [{ text: "SQL", skill: "SQL", importance: "high", section: "must", evidenceTier: "structural" }],
  textLines: [], deadline: "2026-10-20", postedAt: null, ...over,
});

describe("rankJobs", () => {
  it("sorts by fit and puts gated jobs last regardless of score", () => {
    const ranked = rankJobs(student, { skillsList: ["SQL"], bulletText: "", otherText: "" }, [
      job("gated", { yearEligibility: ["final"] }),
      job("weak", { archetype: "marketing_growth" }),
      job("strong"),
    ], "2026-10-13");
    expect(ranked.map((r) => r.job.id)).toEqual(["strong", "weak", "gated"]);
  });
  it("hides closed jobs", () => {
    expect(rankJobs(student, { skillsList: [], bulletText: "", otherText: "" }, [job("old", { deadline: "2026-10-01" })], "2026-10-13")).toHaveLength(0);
  });
  it("keeps jobs that close today and jobs with no deadline", () => {
    const ranked = rankJobs(student, null, [job("today", { deadline: "2026-10-13" }), job("none", { deadline: null })], "2026-10-13");
    expect(ranked.map((r) => r.job.id).sort()).toEqual(["none", "today"]);
  });
  it("falls back to profile skills when there is no CV, and uses the CV when there is one", () => {
    const [noCv] = rankJobs(student, null, [job("a")], "2026-10-13");
    expect(noCv.coverage.must).toEqual({ matched: 1, total: 1 });
    const cvNoSql = { skills: [{ group: "x", items: ["Excel"] }], experience: [], projects: [] };
    const [withCv] = rankJobs(student, cvNoSql, [job("a")], "2026-10-13");
    expect(withCv.coverage.must).toEqual({ matched: 0, total: 1 });
  });
});

describe("rankJobs unreadable-requirements tie-break", () => {
  const cv = { skillsList: ["SQL"], bulletText: "", otherText: "" };
  // Unreadable requirements score a neutral 3: with a matching archetype and location that is 0.4·5 + 0.4·3 + 0.2·5 = 4.2 (Good).
  const unreadable = (id: string, over: Partial<JobListItem> = {}) => job(id, { requirements: [], textLines: [], ...over });
  const niceGap = { text: "Tableau", skill: "Tableau", importance: "preferred" as const, section: "nice" as const, evidenceTier: "structural" as const };
  // adjacent archetype (3), SQL met, one nice-to-have missing (requirements 4.8): 0.4·3 + 0.4·4.8 + 0.2·5 = 4.12 → 4.1 (Good)
  const readableGood = (id: string) => job(id, { archetype: "software_eng", requirements: [job("x").requirements[0], niceGap] });
  const run = (jobs: JobListItem[]) => rankJobs(student, cv, jobs, "2026-10-13");
  const byId = (r: ReturnType<typeof run>, id: string) => r.find((x) => x.job.id === id)!;

  it("ranks a readable job above an unreadable job of the same label even when the unreadable score is higher", () => {
    const r = run([unreadable("unread"), readableGood("read")]);
    const u = byId(r, "unread"), d = byId(r, "read");
    expect(u.coverage.readable).toBe(false);
    expect(d.coverage.readable).toBe(true);
    expect(u.fit.label).toBe("Good fit");
    expect(d.fit.label).toBe("Good fit");
    expect(u.fit.global).toBeGreaterThan(d.fit.global);
    expect(r.map((x) => x.job.id)).toEqual(["read", "unread"]);
  });

  it("ranks an unreadable Good fit below readable Good fits but above a readable Stretch", () => {
    const req = (skill: string) => ({ text: skill, skill, importance: "high" as const, section: "must" as const, evidenceTier: "structural" as const });
    // SQL met, R and Excel missing: requirements 1 + 4/3; 0.4·5 + 0.4·2.33 + 0.2·5 = 3.9 (Stretch)
    const stretch = job("stretch", { requirements: [req("SQL"), req("R"), req("Excel")] });
    const r = run([stretch, unreadable("unreadGood"), readableGood("readGood")]);
    expect(byId(r, "stretch").fit.label).toBe("Stretch");
    expect(r.map((x) => x.job.id)).toEqual(["readGood", "unreadGood", "stretch"]);
  });

  it("keeps gated jobs last and leaves scores and labels untouched", () => {
    const r = run([unreadable("gatedU", { yearEligibility: ["final"] }), unreadable("u"), job("r")]);
    expect(r.map((x) => x.job.id)).toEqual(["r", "u", "gatedU"]);
    expect(byId(r, "u").fit.label).toBe("Good fit");
    expect(byId(r, "u").fit.global).toBe(4.2);
    expect(byId(r, "gatedU").fit.capped).toBe(true);
    expect(byId(r, "gatedU").fit.eligibility).toBe("check");
  });
});

describe("rankJobs urgency, overrides and signals (audit 10#3, #4)", () => {
  const cv = { skillsList: ["SQL"], bulletText: "", otherText: "" };
  it("within a label, a job closing this week comes first even when another scores higher", () => {
    const niceGap = { text: "Tableau", skill: "Tableau", importance: "preferred" as const, section: "nice" as const, evidenceTier: "structural" as const };
    const r = rankJobs(student, cv, [
      job("highNoDate", { deadline: null }),
      job("lowerSoon", { deadline: "2026-10-16", requirements: [job("x").requirements[0], niceGap] }),
    ], "2026-10-13");
    expect(r[0].fit.label).toBe(r[1].fit.label);
    expect(r[1].fit.global).toBeGreaterThan(r[0].fit.global);
    expect(r.map((x) => x.job.id)).toEqual(["lowerSoon", "highNoDate"]);
    expect(r[0].fit.urgency.chip).toBe("Closes in 3 days");
  });
  it("an eligibility override puts the job back in its fit label", () => {
    const r = rankJobs(student, cv, [job("gated", { yearEligibility: ["final"] }), job("overridden", { yearEligibility: ["final"], eligibilityOverride: true } as Partial<JobListItem>)], "2026-10-13");
    expect(r.map((x) => x.job.id)).toEqual(["overridden", "gated"]);
    expect(r[0].fit.eligibility).toBe("overridden");
  });
  it("uses pre-parsed signals when the feed has dropped textLines, and the CV's degree grade", () => {
    const elig = parseEligibility("Analyst", ["You should be on track for a 2:1 or above."]);
    const parsed = { skills: [{ group: "x", items: ["SQL"] }], experience: [], projects: [], education: [{ id: "e", institution: "UCL", degree: "BSc", dates: "", grade: "Predicted 2:2", details: [] }] };
    const [r] = rankJobs(student, parsed, [{ ...job("a"), elig }], "2026-10-13");
    expect(r.fit.softFlags.join(" ")).toMatch(/your CV shows a 2:2/);
  });
});

describe("applyXp", () => {
  it("is flat whatever the fit (audit 10#3)", () => {
    expect(applyXp()).toBe(50);
  });
});
