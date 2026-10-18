/** Unit tests for the claim-level checks (audit 2026-10-18 report 05 "New rules"), with the report's pass/fail anchors. */
import { describe, it, expect } from "vitest";
import { buildClaimCtx, engagementRank, levelClaims, monthRange, unitClaimIssues, type ClaimUnit } from "@/lib/verify/claims";
import type { ParsedCV } from "@/lib/types";

const NOW = new Date("2026-10-18T12:00:00Z");
const cv: ParsedCV = {
  name: "A", email: null, phone: null, location: null, links: [], summary: null,
  education: [{ id: "e0", institution: "UCL", degree: "BSc Economics", dates: "2024–2027", grade: "Predicted 2:2", details: [{ id: "d0", text: "A-levels: A*AB" }] }],
  experience: [
    { id: "x1", org: "Goldman Sachs", title: "Spring Insight Programme", dates: "Apr 2025", location: "London", bullets: [{ id: "b1", text: "Shadowed an analyst" }] },
    { id: "x2", org: "JPMorgan", title: "Virtual Experience Programme (Forage)", dates: "Jan 2025", location: "", bullets: [{ id: "b2", text: "Completed modelling tasks" }] },
    { id: "x3", org: "Tesco", title: "Customer Assistant", dates: "Jun 2024 – Aug 2024", location: "", bullets: [{ id: "b3", text: "Served customers in a busy store" }] },
  ],
  projects: [], leadership: [],
  skills: [{ group: "Languages", items: ["Spanish (conversational)"] }, { group: "Skills", items: ["Python", "SQL (working knowledge)"] }],
  interests: null, sectionOrder: [], yearGuess: null, archetypes: [],
};
const corpus = "Predicted 2:2\nA-levels: A*AB\nSpanish (conversational)\nPython\nSQL (working knowledge)\nGoldman Sachs Spring Insight Programme\nShadowed an analyst\nServed customers in a busy store";
const ctx = buildClaimCtx(cv, corpus, NOW);
const checks = (u: ClaimUnit) => unitClaimIssues(u, ctx).filter((i) => i.severity === "block").map((i) => i.check);
const bullet = (text: string, cited: string, merged = false): ClaimUnit => ({ text, cited, merged });
const summary = (text: string, cited = ""): ClaimUnit => ({ text, cited, scoped: true });

describe("modalityDrop", () => {
  const src = "Managed a £5k paper trading portfolio in the society's simulated fund";
  it("blocks dropping paper/simulated", () => expect(checks(bullet("Managed a £5k portfolio", src))).toContain("modalityDrop"));
  it("passes when kept", () => expect(checks(bullet("Managed a £5k paper portfolio in the society's simulated fund", src))).toEqual([]));
  const est = "Drafted a proposal to cut costs by an estimated 15%";
  it.each(["Cut costs by 15% through a proposal", "Delivered a proposal that cut costs", "Drafted a proposal to cut costs by 15%"])("blocks %s", (t) =>
    expect(checks(bullet(t, est))).toContain("modalityDrop"));
  it("passes the estimate kept in brackets", () => expect(checks(bullet("Drafted a cost-cutting proposal (estimated 15% saving)", est))).toEqual([]));
});

describe("outcomeEscalation", () => {
  const src = "Shortlisted as finalist in the UCL trading challenge";
  it.each(["Won the UCL trading challenge", "Placed first in the UCL trading challenge", "Runner-up in the UCL trading challenge"])("blocks %s", (t) =>
    expect(checks(bullet(t, src))).toContain("outcomeEscalation"));
  it("passes a reordered finalist", () => expect(checks(bullet("UCL trading challenge finalist", src))).toEqual([]));
  it("blocks a summary winner with no source line", () => expect(checks(summary("UCL trading challenge winner"))).toContain("outcomeEscalation"));
});

describe("audienceEscalation / adoptionClaim / scope", () => {
  const src = "Presented findings to the society committee";
  it.each(["Presented findings to senior management", "Presented findings to clients", "Presented findings to the board"])("blocks %s", (t) =>
    expect(checks(bullet(t, src))).toContain("audienceEscalation"));
  it("passes the same audience", () => expect(checks(bullet("Presented findings to the committee", src))).toEqual([]));
  it("passes customers when the source serves customers", () => expect(checks(bullet("Handled queries for customers in a busy store", "Served customers in a busy store"))).toEqual([]));
  it("blocks a new adoption clause", () => expect(checks(bullet("Presented recommendations to the committee, which were adopted", src))).toContain("adoptionClaim"));
  it("passes adoption the source states", () => expect(checks(bullet("Recommendations were adopted by the committee", "Recommendations adopted by the society committee"))).toEqual([]));
  it("blocks a new superlative", () => expect(checks(bullet("Served customers in one of the UK's busiest stores", "Served customers in a busy store"))).toContain("scopeSuperlative"));
});

describe("frequencyEscalation", () => {
  const src = "Organised monthly society events for 60 members";
  it.each(["Organised weekly society events for 60 members", "Organised daily society events for 60 members"])("blocks %s", (t) =>
    expect(checks(bullet(t, src))).toContain("frequencyEscalation"));
  it("passes 'each month'", () => expect(checks(bullet("Organised society events each month for 60 members", src))).toEqual([]));
  it("warns when made vaguer", () => expect(unitClaimIssues(bullet("Organised regular society events", src), ctx).map((i) => `${i.severity}:${i.check}`)).toContain("warn:frequencyEscalation"));
  it("blocks adding a frequency the source doesn't state", () => expect(checks(bullet("Served customers daily", "Served customers"))).toContain("frequencyEscalation"));
});

describe("proficiencyEscalation", () => {
  it("reads levels next to skills and languages", () => {
    expect(levelClaims("Spanish (conversational)")).toEqual([{ key: "spanish", rank: 1, word: "conversational" }]);
    expect(levelClaims("fluent Spanish speaker")[0]).toMatchObject({ key: "spanish", rank: 3 });
    expect(levelClaims("Advanced Python")[0]).toMatchObject({ rank: 3 });
  });
  it.each(["fluent Spanish speaker", "Used advanced Python", "proficient in Python and Excel"])("blocks %s", (t) =>
    expect(checks(summary(t))).toContain("proficiencyEscalation"));
  it("passes an equal level reworded (working knowledge ↔ intermediate)", () => expect(checks(summary("intermediate SQL"))).toEqual([]));
  it("passes the same level", () => expect(checks(summary("conversational Spanish"))).toEqual([]));
});

describe("gradeClaim", () => {
  it.each(["First-class Economics student", "on track for a 2:1", "Economics student with a 2:2", "A-levels A*A*A"])("blocks %s", (t) =>
    expect(checks(summary(t))).toContain("gradeClaim"));
  it("passes 'predicted 2:2'", () => expect(checks(summary("Economics student, predicted 2:2"))).toEqual([]));
  it("does not read 'first-year' as a grade", () => expect(checks(summary("First-year Economics student at UCL"))).toEqual([]));
  it("reads a bare 'First' grade field", () => {
    const c2 = buildClaimCtx({ ...cv, education: [{ ...cv.education[0], grade: "First" }] }, "First", NOW);
    expect(unitClaimIssues(summary("First-class Economics graduate"), c2)).toEqual([]);
  });
});

describe("roleTypeEscalation", () => {
  it("ranks engagement types", () => {
    expect(engagementRank("Virtual Experience Programme (Forage)", "JPMorgan")).toBe(0);
    expect(engagementRank("Spring Insight Programme", "Goldman Sachs")).toBe(1);
    expect(engagementRank("Summer Intern", "Barclays")).toBe(2);
    expect(engagementRank("Customer Assistant", "Tesco")).toBe(3);
  });
  it.each(["Former Goldman Sachs summer analyst", "Economics student who has worked at Goldman Sachs", "Completed a Goldman Sachs internship"])("blocks %s", (t) =>
    expect(checks(summary(t))).toContain("roleTypeEscalation"));
  it("blocks a Forage programme written as an internship", () => expect(checks(bullet("JPMorgan internship in markets", "Completed modelling tasks"))).toContain("roleTypeEscalation"));
  it("passes 'Spring Insight Programme at Goldman Sachs'", () => expect(checks(summary("Spring Insight Programme at Goldman Sachs"))).toEqual([]));
  it("passes someone else's role ('shadowed an analyst at Goldman Sachs')", () => expect(checks(bullet("Shadowed an analyst at Goldman Sachs", "Shadowed an analyst"))).toEqual([]));
});

describe("durationClaim", () => {
  it("parses date ranges", () => {
    expect(monthRange("Jun 2024 – Aug 2024", NOW)).toEqual([2024 * 12 + 5, 2024 * 12 + 7]);
    expect(monthRange("Sep 2025 – Present", NOW)).toEqual([2025 * 12 + 8, 2026 * 12 + 9]);
  });
  it("blocks 2 years from 3 months", () => expect(checks(summary("Economics student with 2 years of customer service experience"))).toContain("durationClaim"));
  it("passes 3 months", () => expect(checks(summary("3 months of customer service experience"))).toEqual([]));
});

describe("causalInsertion / evaluativeAdverb", () => {
  it("blocks an invented cause in a merged bullet", () =>
    expect(checks(bullet("Organised society events that grew membership 20%", "Organised society events\nMembership grew 20% this year", true))).toContain("causalInsertion"));
  it("passes the merge without the link", () =>
    expect(checks(bullet("Organised society events; membership grew 20% this year", "Organised society events\nMembership grew 20% this year", true))).toEqual([]));
  it("blocks a new purpose clause", () => expect(checks(bullet("Trained 3 new staff on the till to cut queue times", "Trained 3 new staff on the till"))).toContain("causalInsertion"));
  it("warns on a new evaluative adverb", () =>
    expect(unitClaimIssues(bullet("Built a model that accurately forecast demand", "Built a model to forecast demand"), ctx).map((i) => `${i.severity}:${i.check}`)).toContain("warn:evaluativeAdverb"));
});

describe("reframeGuard", () => {
  it("blocks 'A/B test' from a plain comparison", () => expect(checks(bullet("Ran an A/B test of two posters", "Compared two posters"))).toContain("reframeGuard"));
  it("passes 'A/B test' when the source names variants and a rate", () =>
    expect(checks(bullet("Ran an A/B test of poster designs", "Tested two versions of a poster (control vs variant); sign-up rate rose"))).toEqual([]));
  it.each([["Built and deployed a Python model", "Built a Python model"], ["Client-facing role serving shoppers", "Served shoppers"],
    ["Presented a stock pitch", "Presented findings to the committee"], ["Comparable company analysis of ticket sales", "Analysed ticket sales"]])("blocks %s", (t, src) =>
    expect(checks(bullet(t, src))).toContain("reframeGuard"));
  it("passes 'deployed' when the source links a live app", () => expect(checks(bullet("Deployed a Flask app", "Built a Flask app hosted on Heroku"))).toEqual([]));
});
