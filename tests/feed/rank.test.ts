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

describe("rankJobs unreadable-requirements tie-break", () => {
  const cv = { skillsList: ["SQL"], bulletText: "", otherText: "" };
  // Student is 2nd year, so firstYearFriendly adds +0.5 accessibility: an unreadable (coverage 3) job with a matching
  // archetype and location then lands exactly on the Strong-fit threshold (4.5).
  const unreadable = (id: string, over: Partial<JobListItem> = {}) => job(id, { requirements: [], textLines: [], ...over });
  const run = (jobs: JobListItem[]) => rankJobs(student, cv, jobs, "2026-10-13");
  const byId = (r: ReturnType<typeof run>, id: string) => r.find((x) => x.job.id === id)!;

  it("ranks a readable job above an unreadable job of the same label even when the unreadable score is higher", () => {
    // Far deadline: access 4. Unreadable scores 4.3 (Good); readable with an adjacent archetype scores 4.2 (Good).
    const r = run([
      unreadable("unread", { deadline: "2026-12-01" }),
      job("read", { deadline: "2026-10-20", archetype: "software_eng" }),
    ]);
    const u = byId(r, "unread"), d = byId(r, "read");
    expect(u.coverage.readable).toBe(false);
    expect(d.coverage.readable).toBe(true);
    expect(u.fit.label).toBe("Good fit");
    expect(d.fit.label).toBe("Good fit");
    expect(u.fit.global).toBeGreaterThan(d.fit.global);
    expect(r.map((x) => x.job.id)).toEqual(["read", "unread"]);
  });

  it("ranks an unreadable Strong fit below readable Strong fits but above a readable Good fit", () => {
    const r = run([
      job("good", { archetype: "software_eng", deadline: "2026-12-01" }),
      unreadable("unreadStrong", { firstYearFriendly: true }),
      job("readStrong"),
    ]);
    expect(byId(r, "unreadStrong").coverage.readable).toBe(false);
    expect(byId(r, "unreadStrong").fit.label).toBe("Strong fit");
    expect(byId(r, "readStrong").fit.label).toBe("Strong fit");
    expect(byId(r, "good").fit.label).toBe("Good fit");
    expect(r.map((x) => x.job.id)).toEqual(["readStrong", "unreadStrong", "good"]);
  });

  it("keeps gated jobs last and leaves scores and labels untouched", () => {
    const r = run([
      unreadable("gatedU", { yearEligibility: ["final"], firstYearFriendly: true }),
      unreadable("u", { firstYearFriendly: true }),
      job("r"),
    ]);
    expect(r.map((x) => x.job.id)).toEqual(["r", "u", "gatedU"]);
    expect(byId(r, "u").fit.label).toBe("Strong fit");
    expect(byId(r, "u").fit.global).toBe(4.5);
    expect(byId(r, "gatedU").fit.capped).toBe(true);
  });
});

describe("applyXp", () => {
  it("matches the gamification table", () => {
    expect(applyXp("Strong fit")).toBe(50);
    expect(applyXp("Not recommended")).toBe(10);
  });
});
