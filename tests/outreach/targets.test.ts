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
  ])("%s → %s", (title, want) => expect(divisionKeyword(title)).toBe(want));
});

describe("searchKeywords", () => {
  it("builds one query per target type, quoting the company", () => {
    expect(searchKeywords("alumni", "Lendable", "Credit Analyst Intern")).toBe('"Lendable" UCL');
    expect(searchKeywords("team", "Lendable", "Credit Analyst Intern")).toBe('"Lendable" Credit');
    expect(searchKeywords("team", "Lendable", "Summer Analyst")).toBe('"Lendable"');
    expect(searchKeywords("recruiter", "IMC", "x")).toBe('"IMC" "early careers" OR "campus recruiter" OR "graduate recruitment"');
    expect(searchKeywords("recent_joiner", "IMC", "Software Engineer Intern")).toBe('"IMC" Software Engineer graduate OR analyst');
  });
  it("strips quotes from the company name", () => {
    expect(searchKeywords("alumni", 'A "B" C', "x")).toBe('"A B C" UCL');
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
