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
    ["We are unable to sponsor visas for this role.", "no"],
    ["Must have the right to work in the UK.", "unknown"],
    ["We are unable to offer feedback to unsuccessful applicants.", "unknown"],
    ["We are unable to provide visa sponsorship.", "no"],
    ["We are unable to offer sponsorship.", "no"],
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

describe("coverage-audit filter fixes (2026-10-14)", () => {
  it("'replacement' is not a placement", () => {
    expect(passesTitleFilter("Operations Specialist with Dutch - 12 months replacement - Remote")).toBe(false);
    expect(passesTitleFilter("Industrial Placement - Data")).toBe(true);
    expect(passesTitleFilter("Summer Placements 2027")).toBe(true);
    expect(detectEmploymentType("Maternity Replacement Intern")).toBe("internship");
  });
  it("staff who run early-careers programmes are not early-careers roles", () => {
    expect(passesTitleFilter("Early Careers Programme Coordinator")).toBe(false);
    expect(passesTitleFilter("Emerging Talent Delivery Team Manager (Germany, Poland, UK)")).toBe(false);
    expect(passesTitleFilter("Product Manager Intern")).toBe(true);
  });
  it("London, Ontario is not London", () => {
    expect(passesLocationFilter("London, Canada; Windsor - Rhodes Drive", false, "").pass).toBe(false);
    expect(passesLocationFilter("London, ON", false, "").pass).toBe(false);
    expect(classifyRegion("London, Ontario, Canada", false)).toBe("other");
    expect(classifyRegion("London, United Kingdom", false)).toBe("london");
    expect(passesLocationFilter("London, Canada; London, United Kingdom", false, "").pass).toBe(true);
  });
});

describe("remote roles pinned to a non-UK/EU place", () => {
  it("a remote flag doesn't let US-located roles through", () => {
    expect(passesLocationFilter("San Francisco, California; New York, New York", true, "").pass).toBe(false);
    expect(passesLocationFilter("New York, NY (HQ)", true, "").pass).toBe(false);
  });
  it("still keeps genuinely remote and UK/EU roles", () => {
    expect(passesLocationFilter("", true, "").pass).toBe(true);
    expect(passesLocationFilter("Remote - International", false, "").pass).toBe(true);
    expect(passesLocationFilter("Poland", true, "").pass).toBe(true);
    expect(passesLocationFilter("London; New York", true, "").pass).toBe(true);
  });
});

describe("more non-UK/EU places are blocked even when flagged remote", () => {
  it.each(["Malaysia - Kuala Lumpur", "Indonesia - Jakarta", "Cairo - ETIC, Egypt", "Dubai, UAE", "Kingston, Jamaica"])("%s", (loc) => {
    expect(passesLocationFilter(loc, true, "").pass).toBe(false);
  });
});

describe("remote flag on a role pinned to a non-UK/EU country", () => {
  it.each(["Costa Rica - Cartago - Tres Rios", "New Zealand - North Island - Auckland"])("%s fails", (loc) => {
    expect(passesLocationFilter(loc, true, "").pass).toBe(false);
  });
  it("generic remote text still passes", () => {
    expect(passesLocationFilter("Remote (EMEA)", true, "").pass).toBe(true);
    expect(passesLocationFilter("Anywhere", false, "").pass).toBe(true);
  });
});

describe("insurance-broking placement and experienced grades", () => {
  it.each(["Analyst II - Placement", "Associate Placement Specialist - Placement", "Software Engineer III, Early Career"])("%s fails", (t) => {
    expect(passesTitleFilter(t)).toBe(false);
  });
  it("student placements still pass", () => {
    expect(passesTitleFilter("Communications Industrial Placement, 2027")).toBe(true);
    expect(passesTitleFilter("Placement Year - Software Engineer")).toBe(true);
  });
});

describe("review round 1 (2026-10-14)", () => {
  it.each(["London, On-site", "London, Canada Square", "London, Canada Water", "London, ON (Hybrid)"])("London Ontario rule: %s", (loc) => {
    expect(passesLocationFilter(loc, false, "").pass).toBe(loc !== "London, ON (Hybrid)");
  });
  it("London Ontario still caught at the end of a segment", () => {
    expect(classifyRegion("London, Ontario, Canada", false)).toBe("other");
    expect(classifyRegion("London, Canada Square", false)).toBe("london");
  });
  it.each(["Remote - US", "Remote, United States", "USA - Remote", "Remote - India", "Remote, Brazil"])("remote text pinned abroad fails: %s", (loc) => {
    expect(passesLocationFilter(loc, true, "").pass).toBe(false);
  });
  it.each(["Hybrid", "Work from home", "Home Based", "Flexible", "Multiple Locations"])("remote flag with an unnamed place passes: %s", (loc) => {
    expect(passesLocationFilter(loc, true, "").pass).toBe(true);
  });
  it.each(["Intern II", "Graduate Programme Phase II", "Summer Intern - Part II", "Trainee Team Manager Graduate Scheme"])("legit title passes: %s", (t) => {
    expect(passesTitleFilter(t)).toBe(true);
  });
  it.each(["Sheffield", "Newcastle upon Tyne", "Luxembourg", "Prague, Czechia", "Athens, Greece", "Bucharest, Romania"])("UK/EU place passes: %s", (loc) => {
    expect(passesLocationFilter(loc, false, "").pass).toBe(true);
  });
  it.each(["Newcastle, NSW, Australia", "Cambridge, MA, United States", "Birmingham, US"])("UK city namesake abroad fails: %s", (loc) => {
    expect(passesLocationFilter(loc, false, "").pass).toBe(false);
  });
});
