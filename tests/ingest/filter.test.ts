import { describe, it, expect } from "vitest";
import {
  matchKeyword, passesTitleFilter, detectCohortClash, classifyRegion,
  passesLocationFilter, detectSponsorship, detectEmploymentType,
} from "@/lib/ingest/filter";

describe("matchKeyword", () => {
  it("word: prefix matches whole words only", () => {
    expect(matchKeyword("Software Engineering Intern", "word:intern")).toBe(true);
    expect(matchKeyword("Internal Communications Manager", "word:intern")).toBe(false);
  });
  it("short all-letter keywords get word boundaries", () => {
    expect(matchKeyword("ML Research Intern", "ML")).toBe(true);
    expect(matchKeyword("HTML Developer", "ML")).toBe(false);
  });
  it("plain keywords are case-insensitive substrings", () => {
    expect(matchKeyword("2027 SUMMER ANALYST programme", "Summer Analyst")).toBe(true);
  });
});

describe("passesTitleFilter", () => {
  it.each([
    ["Software Engineering Intern - Summer 2027", true],
    ["Spring Week 2027 - Markets", true],
    ["Industrial Placement - Data", true],
    ["PhD Research Intern", true],
    ["Senior Software Engineer", false],
    ["Software Engineer", false],
    ["Head of Internships", false],
    ["Recruiter - Early Careers", false],
  ])("%s → %s", (title, expected) => {
    expect(passesTitleFilter(title)).toBe(expected);
  });
});

describe("detectCohortClash", () => {
  it("flags US winter cohorts", () => {
    expect(detectCohortClash("Software Engineer Intern (Winter 2027)")).toBe(true);
    expect(detectCohortClash("Summer Analyst 2027")).toBe(false);
  });
});

describe("classifyRegion", () => {
  it.each([
    ["London, UK", false, "london"],
    ["Manchester, United Kingdom", false, "uk"],
    ["Amsterdam, Netherlands", false, "europe"],
    ["Remote", true, "remote"],
    ["New York, NY", false, "other"],
    ["", false, "other"],
  ] as const)("%s → %s", (loc, remote, expected) => {
    expect(classifyRegion(loc, remote)).toBe(expected);
  });
});

describe("passesLocationFilter", () => {
  it("passes empty location (absent data passes)", () => {
    expect(passesLocationFilter("", false, "").pass).toBe(true);
  });
  it("always allows London even if text mentions the US", () => {
    expect(passesLocationFilter("London; New York", false, "").pass).toBe(true);
  });
  it("blocks US-only locations", () => {
    expect(passesLocationFilter("San Francisco, CA", false, "").pass).toBe(false);
  });
  it("rejects UK-irrelevant JD that requires US work authorisation", () => {
    const r = passesLocationFilter("Remote", true, "US residents only. Must be authorized to work in the US without sponsorship.");
    expect(r.pass).toBe(false);
  });
  it("keeps remote when the JD also names the UK", () => {
    expect(passesLocationFilter("Remote", true, "Open to candidates in the United Kingdom. We do not sponsor visas.").pass).toBe(true);
  });
});

describe("detectSponsorship", () => {
  it.each([
    ["We are unable to provide visa sponsorship for this role.", "no"],
    ["Visa sponsorship available for the right candidate.", "yes"],
    ["Join our team in London.", "unknown"],
  ] as const)("%s → %s", (text, expected) => {
    expect(detectSponsorship(text)).toBe(expected);
  });
});

describe("detectEmploymentType", () => {
  it.each([
    ["Spring Week 2027", "spring_week"],
    ["Insight Day - Technology", "insight"],
    ["Industrial Placement (12 months)", "placement"],
    ["Graduate Programme 2027", "graduate"],
    ["Data Analyst Intern", "internship"],
  ] as const)("%s → %s", (title, expected) => {
    expect(detectEmploymentType(title)).toBe(expected);
  });
});
