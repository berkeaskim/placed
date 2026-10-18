import { describe, it, expect } from "vitest";
import { classifySpringWeek, reconcileProgramme } from "@/lib/ingest/spring-week";
import { detectEmploymentType, passesTitleFilter } from "@/lib/ingest/filter";
import { heuristicTagJob } from "@/lib/ai/heuristics";

// Titles and body excerpts seen live in employer feeds on 2026-10-18 (research/spring-weeks/02-employer-ats.md).
const JPM_BODY = "Spring Insights is a virtual programme. A student expecting to graduate in 2029.";
const POINT72_BODY = "Open to students in the first year of a three-year degree or second year of a four-year degree, expecting to graduate in 2029. One week work shadowing in April 2027.";
const PWC_BODY = "You'll be in the first year of an undergraduate degree. Or in your second year of a four-year degree. A three-day programme in spring 2027.";
const NOMURA_BODY = "Open to students in their first year of university or second year of a four-year course (graduating in 2029). A two-day programme on 5th – 6th April 2027.";
const US_SEMESTER_BODY = "This is a 6-month co-op during the spring semester. Must be enrolled at a US university.";
const PENULTIMATE_BODY = "Open to penultimate year students graduating in 2028. A two-day insight programme.";

describe("classifySpringWeek: real UK first-year programmes", () => {
  it.each([
    ["2027 Spring Insights: Analyse & Trade at JPMorganChase – London", JPM_BODY, "spring_week"],
    ["2027 EMEA Future Leaders Spring Insight Programme", "Anticipated graduation date: 2028 or 2029. A 4-day experience, March-April 2027.", "spring_week"],
    ["Point72 Academy Spring Insight - UK", POINT72_BODY, "spring_week"],
    ["Maven Women in Trading Spring Week 2027", "A one-week insight event, 12th April – 16th April 2027.", "spring_week"],
    ["Black Talent in Business - Engineering, Data Science and Analytics", PWC_BODY, "spring_week"],
    ["Advancing Social Mobility - Audit", PWC_BODY, "spring_week"],
    ["Discover Nomura Programme", NOMURA_BODY, "spring_week"],
    ["FutureFocus: Quants 2027", "For first year students graduating in 2029. A two-day programme.", "spring_week"],
    ["UK Global Advisory Spring Insight Programme", "", "spring_week"],
    ["Spring into Deloitte Insight Programme", "", "spring_week"],
    ["2027 MUFG Insight Event – Breaking Barriers: Social Mobility Insight Day (in person)", "For first year students.", "insight"],
    ["Marsh Insight Day – London", "", "insight"],
  ] as const)("%s → %s", (title, body, kind) => {
    expect(classifySpringWeek(title, body).kind).toBe(kind);
  });
});

describe("classifySpringWeek: traps that are not UK spring weeks", () => {
  it.each([
    ["NVIDIA Spring 2027 Internships: Developer and Performance Technology", ""],
    ["Technical Support Engineering Intern – Spring 2027", US_SEMESTER_BODY],
    ["AI & Data Co-Op (Northeastern University), Spring 2027", US_SEMESTER_BODY],
    ["Imaging Geophysicist Graduate Programme – Spring 2027", ""],
    ["Campus Quantitative Researcher (Off-Cycle – Winter/Spring 2027 Intern)", ""],
    ["HLC NextGen – Insight and Impact: Praktikantenprogramm Frühjahr 2027", ""],
    ["Java and Spring Boot Developer", ""],
    ["Relationship Banker – Spring, TX", ""],
    ["Palm Springs Branch Manager", ""],
    ["Analytics and Insights Lead – VP", ""],
    ["Accounting and Business Insights Industrial Placement", ""],
    ["FinTech Strategy and Business Development First Year Analyst", ""],
    ["Discovery Engineer", ""],
    ["eDiscovery Attorney", ""],
    ["Talent Insight Programme - Audit", ""],
    ["Graduate Insight Programme", ""],
    ["2028 Summer Analyst – Intro to Evercore – Cornell", ""],
    // Seen in the local DB dry run (2026-10-18).
    ["2027 Software Engineer Immersion Program - Summer Internship - Glasgow", "Open to first year students graduating in 2029."],
    ["One Year Internship - Supply, Trading & Shipping - UK", "Open to first year students and above."],
    ["Future Leaders Event R&D Devices - Internship (m/f/d)", ""],
  ])("%s", (title, body) => {
    expect(classifySpringWeek(title, body).kind).not.toBe("spring_week");
  });

  it("an insight programme aimed at penultimate years is an insight, not a spring week", () => {
    expect(classifySpringWeek("Women in Finance Insight Programme", PENULTIMATE_BODY).kind).toBe("insight");
  });
});

describe("detectEmploymentType", () => {
  it.each([
    ["Undergraduate Summer Internship 2027", "internship"],
    ["Undergraduate Industrial Placement", "placement"],
    ["Graduate Programme – Spring 2027", "graduate"],
    ["Spring Programme 2027 - Markets", "spring_week"],
    ["Early Insights Programme", "spring_week"],
    ["Technical Support Engineering Intern – Spring 2027", "internship"],
    ["Java and Spring Boot Developer", "other"],
  ] as const)("%s → %s", (title, expected) => {
    expect(detectEmploymentType(title)).toBe(expected);
  });

  it("uses the posting body when given", () => {
    expect(detectEmploymentType("Black Talent in Business - Audit", PWC_BODY)).toBe("spring_week");
    expect(detectEmploymentType("Black Talent in Business - Audit")).toBe("other");
  });
});

describe("passesTitleFilter keeps spring programmes the keyword list missed", () => {
  it.each([
    "Black Talent in Business - Strategy Consulting - London",
    "Women in Business - Tax",
    "Advancing Social Mobility - Audit",
    "FutureFocus: Quants 2027",
    "Explore Nomura SEO Programme",
    "Women's Immersion Programme",
    "Discover EY",
    "Spring Programme 2027",
    "Early Insights Programme",
    "First Year Insight Programme",
  ])("%s", (title) => {
    expect(passesTitleFilter(title)).toBe(true);
  });

  it.each(["Java and Spring Boot Developer", "Discovery Engineer", "Senior Vice President – Client Insights"])("still drops %s", (title) => {
    expect(passesTitleFilter(title)).toBe(false);
  });
});

describe("heuristicTagJob on a body-only spring week", () => {
  it("tags PwC's family-titled programme as a first-year spring week", () => {
    const t = heuristicTagJob({ title: "Women in Business - Tax", textLines: [PWC_BODY] });
    expect(t.employmentType).toBe("spring_week");
    expect(t.firstYearFriendly).toBe(true);
    expect(t.yearEligibility).toContain("1st");
  });
});

describe("reconcileProgramme (applied to every tagger result)", () => {
  const base = heuristicTagJob({ title: "x", textLines: [] });

  it("overrides a tagger that missed a spring week", () => {
    const t = reconcileProgramme({ ...base, employmentType: "internship", yearEligibility: [], firstYearFriendly: false }, "Discover Nomura Programme", NOMURA_BODY);
    expect(t.employmentType).toBe("spring_week");
    expect(t.firstYearFriendly).toBe(true);
    expect(t.yearEligibility).toEqual(["1st", "2nd"]);
  });

  it("keeps years the tagger found", () => {
    const t = reconcileProgramme({ ...base, employmentType: "insight", yearEligibility: ["1st"] }, "Discover Nomura Programme", NOMURA_BODY);
    expect(t.yearEligibility).toEqual(["1st"]);
  });

  it("demotes a tagger's spring week that is really a US semester internship", () => {
    const t = reconcileProgramme({ ...base, employmentType: "spring_week", firstYearFriendly: true }, "Technical Support Engineering Intern – Spring 2027", US_SEMESTER_BODY);
    expect(t.employmentType).toBe("internship");
  });

  it("keeps a tagger's insight event even when the body targets later years", () => {
    const t = reconcileProgramme({ ...base, employmentType: "insight" }, "Exclusive S&P Global Ratings Early Careers Networking Event", PENULTIMATE_BODY);
    expect(t.employmentType).toBe("insight");
  });

  it("a placement whose body mentions first years stays a placement", () => {
    const t = reconcileProgramme({ ...base, employmentType: "placement" }, "One Year Internship - Supply, Trading & Shipping - UK", "Open to first year students.");
    expect(t.employmentType).toBe("placement");
  });

  it("leaves unrelated jobs alone", () => {
    const t = reconcileProgramme({ ...base, employmentType: "graduate" }, "Graduate Programme 2027", "For final year students.");
    expect(t.employmentType).toBe("graduate");
  });

  it("a curated kind wins", () => {
    const t = reconcileProgramme({ ...base, employmentType: "insight" }, "Diversity in Business Insight Programme", "", "spring_week");
    expect(t.employmentType).toBe("spring_week");
    expect(t.firstYearFriendly).toBe(true);
  });
});
