import { describe, expect, it } from "vitest";
import { divisionKeyword, linkedinSearchUrl, peopleToReach, searchKeywords } from "@/lib/outreach/targets";

describe("divisionKeyword", () => {
  it.each([
    ["Credit Analyst Intern (June 2027)", "Credit"],
    ["2027 Summer Internship - Investment Banking", "Investment Banking"],
    ["Software Engineer Intern, Summer 2027", "Software Engineer"],
    ["Technology Analyst Programme 2027 – London", "Technology"],
    ["Data Science Placement Year", "Data Science"],
    ["Quantitative Trader Intern", "Quantitative Trader"],
    ["Spring Insight Week", null],
    ["Summer Analyst", null],
    ["Undergraduate Programme", null],
    ["Work Experience Week", "Work"],
    ["Degree Apprenticeship - Technology", "Technology"],
    ["Werkstudent Data Analyst", "Data"],
  ])("%s → %s", (title, want) => expect(divisionKeyword(title)).toBe(want));
});

describe("searchKeywords", () => {
  it("builds one query per target type, quoting the company", () => {
    expect(searchKeywords("alumni", "Lendable", "Credit Analyst Intern", "University College London")).toBe('"Lendable" "University College London"');
    expect(searchKeywords("alumni", "Lendable", "Credit Analyst Intern")).toBe('"Lendable"');
    expect(searchKeywords("team", "Lendable", "Credit Analyst Intern")).toBe('"Lendable" Credit');
    expect(searchKeywords("team", "Lendable", "Summer Analyst")).toBe('"Lendable"');
    expect(searchKeywords("recruiter", "IMC", "x")).toBe('"IMC" ("early careers" OR "campus recruiter" OR "graduate recruitment")');
    expect(searchKeywords("recent_joiner", "IMC", "Software Engineer Intern")).toBe('"IMC" Software Engineer (graduate OR analyst)');
  });
  it("strips quotes from the company name", () => {
    expect(searchKeywords("alumni", 'A "B" C', "x", 'King\'s "College"')).toBe('"A B C" "King\'s College"');
  });
});

describe("linkedinSearchUrl", () => {
  it("is a LinkedIn people search with encoded keywords", () => {
    const u = new URL(linkedinSearchUrl('"Lendable" UCL'));
    expect(u.origin + u.pathname).toBe("https://www.linkedin.com/search/results/people/");
    expect(u.searchParams.get("keywords")).toBe('"Lendable" UCL');
  });
});

describe("peopleToReach", () => {
  it("returns the four targets in order, each with a reason and a link", () => {
    const p = peopleToReach("Lendable", "Credit Analyst Intern");
    expect(p.map((x) => x.key)).toEqual(["alumni", "recent_joiner", "team", "recruiter"]);
    for (const x of p) { expect(x.why.length).toBeGreaterThan(10); expect(x.url).toMatch(/^https:\/\/www\.linkedin\.com\//); }
  });
});

describe("alumni labels", () => {
  it("name the student's university, or stay generic when unknown", async () => {
    const { alumniLabel, alumnusLabel, peopleToReach } = await import("@/lib/outreach/targets");
    expect(alumniLabel("London School of Economics and Political Science")).toBe("LSE alumni");
    expect(alumniLabel(null)).toBe("Alumni from your university");
    expect(alumnusLabel("University of Leeds")).toBe("Leeds alumnus");
    expect(peopleToReach("Monzo", "Data Analyst Intern", "Imperial College London")[0].label).toBe("Imperial alumni at the firm");
  });
});
