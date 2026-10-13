import { describe, it, expect } from "vitest";
import { rankJobs, applyXp } from "@/lib/feed/rank";
import type { JobListItem } from "@/lib/db/queries";
import type { StudentProfile } from "@/lib/types";

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

describe("applyXp", () => {
  it("matches the gamification table", () => {
    expect(applyXp("Strong fit")).toBe(50);
    expect(applyXp("Not recommended")).toBe(10);
  });
});
