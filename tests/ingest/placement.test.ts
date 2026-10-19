import { describe, it, expect } from "vitest";
import { classifyPlacement, durations, placementType } from "@/lib/ingest/placement";
import { reconcileProgramme } from "@/lib/ingest/spring-week";
import { detectEmploymentType, passesTitleFilter, placementRegion } from "@/lib/ingest/filter";
import { heuristicTagJob } from "@/lib/ai/heuristics";
import { T } from "./fixtures/placement-titles";

// Real titles from employer feeds and the local DB (research/placement-year/02-employer-ats.md §3, 06-codebase-fit.md).
// P = UK placement year, I = internship/short, G = graduate, A = apprenticeship/pre-uni, X = other sense, ? = ambiguous.

describe("classifyPlacement on titles alone (105 real titles)", () => {
  const placements = T.filter(([t, e]) => e === "P" && t !== "Audit");
  it.each(placements)("%s is a placement, or waits for its body", (title) => {
    const v = classifyPlacement(title);
    expect(v.kind === "placement" || (v.kind === null && v.needsBody), JSON.stringify(v)).toBe(true);
  });
  it.each(T.filter(([, e]) => e !== "P"))("%s (%s) is never a placement", (title) => {
    expect(classifyPlacement(title).kind).not.toBe("placement");
  });
  it("labels the traps by kind", () => {
    expect(classifyPlacement("Placement Specialist").kind).toBe("not_student");
    expect(classifyPlacement("Associate - Consulting - Financial Crime (Placement: Yogyakarta)").kind).toBe("not_student");
    expect(classifyPlacement("Social Media Manager - 12 month FTC").kind).toBe("not_student");
    expect(classifyPlacement("2027 Graduate Placement in Strategic Communications").kind).toBe("graduate");
    expect(classifyPlacement("T Level Industry Placement - Business Administration").kind).toBe("apprenticeship");
    expect(classifyPlacement("Product Engineer Placement (6 Months)").kind).toBe("internship");
    expect(classifyPlacement("2027 UK Summer Placement Programme").kind).toBe("internship");
    expect(classifyPlacement("Werkstudent / Working student Sales").kind).toBe("internship");
  });
  it("mixed durations wait for the body", () => {
    expect(classifyPlacement("Business Analyst Intern (3, 6 and 12 months) - 2027")).toMatchObject({ kind: null, needsBody: true });
  });
});

describe("classifyPlacement with the posting body", () => {
  const SANDWICH = "A 12-month placement starting in July 2027, for students on a sandwich degree who will return to university for their final year.";
  it("a title with no placement word becomes a placement from its body (Pfizer)", () => {
    expect(classifyPlacement("Materials Characterisation Team Undergraduate", SANDWICH).kind).toBe("placement");
  });
  it("an off-cycle title with a 12-month body is a placement", () => {
    expect(classifyPlacement("2027 Operations Off-Cycle Analyst Programme (Glasgow)", "This is a 12 month programme running from September 2027 to September 2028.").kind).toBe("placement");
  });
  it("a 6-month body keeps a 'Placement Analyst' an internship (Citi)", () => {
    expect(classifyPlacement("Banking, Financing, Equity Capital Markets, Placement Analyst, London - United Kingdom 2027", "The placement lasts 6 months, starting January 2027.").kind).toBe("internship");
  });
  it("8 months or less is an internship, 9–15 a placement", () => {
    expect(classifyPlacement("Engineering Placement Student", "This placement lasts 8 months.").kind).not.toBe("placement");
    expect(classifyPlacement("Engineering Placement Student", "This placement lasts 9 months.").kind).toBe("placement");
  });
  it("outside the UK/Ireland a 12-month role is a long internship unless the body says sandwich", () => {
    expect(classifyPlacement("Program Manager Intern (12 months) - FY27", "Based in Munich.", undefined, "europe").kind).toBe("internship");
    expect(classifyPlacement("Program Manager Intern (12 months) - FY27", SANDWICH, undefined, "europe").kind).toBe("placement");
  });
  it("a structured programme field settles bare service-line titles (Deloitte 'Audit')", () => {
    expect(classifyPlacement("Audit", "", { programme: "Industrial Placement" }).kind).toBe("placement");
  });
  it("ignores '12 months of experience' style durations", () => {
    expect(durations("Industrial Placement (12 months)")).toEqual([[12, 12]]);
    expect(classifyPlacement("Engineering Student", "You will need at least 12 months' experience.").kind).not.toBe("placement");
  });
});

describe("placementType maps verdicts onto employment types", () => {
  it.each([
    ["2027 Technology Industrial Placement Programme (London)", "placement"],
    ["Placement Specialist", "permanent"],
    ["Apprentice Process Engineer (M/F/X)", "other"],
    ["2027 Graduate Placement in Strategic Communications", "graduate"],
    ["Working Student Finance/Accounting", "internship"],
    ["Software Engineer", null],
  ] as const)("%s → %s", (title, expected) => {
    expect(placementType(title)).toBe(expected);
  });
});

describe("detectEmploymentType with placements", () => {
  it.each([
    ["Undergraduate Industrial Placement", "placement"],
    ["One Year Internship - Supply, Trading & Shipping - UK", "placement"],
    ["Construction Manager Intern (12 months) - 2027", "placement"],
    ["2027 Summer Placements – Belgian Practice", "internship"],
    ["Investment Banking Analyst, Debt Private Placements", "permanent"],
    ["Spring Week 2027", "spring_week"],
    ["Graduate Programme 2027", "graduate"],
  ] as const)("%s → %s", (title, expected) => {
    expect(detectEmploymentType(title)).toBe(expected);
  });
});

describe("placementRegion", () => {
  it.each([
    ["London, UK", "uk"], ["Dublin, Ireland", "ie"], ["Munich, Germany", "europe"], ["", "uk"], ["Remote", "uk"],
  ] as const)("%s → %s", (loc, r) => {
    expect(placementRegion(loc)).toBe(r);
  });
});

describe("passesTitleFilter", () => {
  it("keeps placements a function word used to drop (Boeing)", () => {
    expect(passesTitleFilter("Talent Acquisition Intern - 12 Month Placement")).toBe(true);
  });
  it("negatives match whole words, not substrings", () => {
    expect(passesTitleFilter("Directorate Industrial Placement 2027")).toBe(true);
    expect(passesTitleFilter("Director of Placements")).toBe(false);
    expect(passesTitleFilter("Talent Acquisition Partner")).toBe(false);
    expect(passesTitleFilter("Senior Industrial Placement Manager")).toBe(false);
  });
});

describe("reconcileProgramme for placements", () => {
  const base = heuristicTagJob({ title: "x", textLines: [] });
  it("promotes a tagger's internship to a placement and opens it to 2nd years", () => {
    const t = reconcileProgramme({ ...base, employmentType: "internship", yearEligibility: ["penultimate"] }, "Construction Manager Intern (12 months) - 2027", "");
    expect(t.employmentType).toBe("placement");
    expect(t.yearEligibility).toEqual(expect.arrayContaining(["2nd", "penultimate"]));
  });
  it("demotes a tagger's placement that is really a working-student job", () => {
    const t = reconcileProgramme({ ...base, employmentType: "placement" }, "Werkstudent / Working student Sales", "");
    expect(t.employmentType).toBe("internship");
  });
  it("demotes a 'Placement Specialist' to a permanent role", () => {
    expect(reconcileProgramme({ ...base, employmentType: "placement" }, "Placement Specialist", "").employmentType).toBe("permanent");
  });
  it("uses the region: a 12-month role in Munich stays an internship", () => {
    expect(reconcileProgramme({ ...base, employmentType: "internship" }, "Program Manager Intern (12 months) - FY27", "Based in Munich.", null, "europe").employmentType).toBe("internship");
  });
  it("keeps the tagger when the classifier has no signal", () => {
    expect(reconcileProgramme({ ...base, employmentType: "placement" }, "Business Analyst", "").employmentType).toBe("placement");
  });
  it("a curated kind still wins", () => {
    expect(reconcileProgramme({ ...base, employmentType: "internship" }, "Placement Year", "", "placement").employmentType).toBe("placement");
  });
  it("spring weeks are unaffected", () => {
    expect(reconcileProgramme({ ...base, employmentType: "internship" }, "Spring Week 2027", "").employmentType).toBe("spring_week");
  });
});

describe("heuristicTagJob on placements", () => {
  it("defaults placement years to 2nd/penultimate", () => {
    const t = heuristicTagJob({ title: "2027 Technology Industrial Placement Programme (London)", textLines: ["Join us for 12 months."] });
    expect(t.employmentType).toBe("placement");
    expect(t.yearEligibility).toEqual(expect.arrayContaining(["2nd", "penultimate"]));
  });
});

describe("dry-run regressions (local DB, 2026-10-18)", () => {
  it("tenure ('>1 year in the associate role') is not the programme length (Nova Founders)", () => {
    expect(classifyPlacement("Marketing Internship at Nova Founders", "Examples of people who have completed the internship, and been >1 year in the associate role.").kind).not.toBe("placement");
  });
  it("an advert offering both lengths is not promoted", () => {
    expect(classifyPlacement("2027 - Internship, Software Engineering and Quantitative Development", "Programme duration: 3–6 months or 12-month industrial placement, starting in 2027.").kind).not.toBe("placement");
    expect(classifyPlacement("Business Intelligence Intern London", "Internship lengths are either 3 or 12 months.").kind).not.toBe("placement");
  });
  it("a graduation window is not a placement span", () => {
    expect(classifyPlacement("2027 Quantitative Masters Internship Programme - Investments - London", "For students graduating between August 2027 and July 2028.").kind).not.toBe("placement");
  });
  it("a twelve-month off-cycle stays a placement", () => {
    expect(classifyPlacement("2027 Investment Management Off-cycle Internship - Emerging Markets Debt (London)", "The internship will commence in January 2027 and typically lasts twelve months.").kind).toBe("placement");
  });
});

describe("TargetJobs listings (sourceType)", () => {
  const base = heuristicTagJob({ title: "x", textLines: [] });
  it("a listing typed Placement stays a placement when the classifier has no say", () => {
    expect(reconcileProgramme({ ...base, employmentType: "other" }, "Food Technology Industrial Placement", "Mixed: 6 or 12 months.", null, "uk", "placement").employmentType).toBe("placement");
    expect(reconcileProgramme({ ...base, employmentType: "other" }, "Placement Student - Compliance Project Support", "", null, "uk", "placement").employmentType).toBe("placement");
  });
  it("but the classifier still overrules it (summer placements, coordinators)", () => {
    expect(reconcileProgramme({ ...base, employmentType: "other" }, "Engineering Summer Placement", "", null, "uk", "placement").employmentType).toBe("internship");
    expect(reconcileProgramme({ ...base, employmentType: "other" }, "Placement Coordinator", "", null, "uk", "placement").employmentType).not.toBe("placement");
  });
  it("UK-only boards keep unrecognised UK towns", () => {
    expect(passesTitleFilter("Industrial Placement - Systems Engineering")).toBe(true);
  });
});

describe("title length settles it (Enterprise, live 2026-10-19)", () => {
  it("a one-year title stays a placement even when the page also mentions a summer internship", () => {
    expect(classifyPlacement("One Year Management Placement / Internship - Ayr", "We also run a 10-week summer internship. This role lasts 12 months.").kind).toBe("placement");
  });
  it("'Temporary Industrial Placement' is a placement, not a contract job", () => {
    expect(classifyPlacement("Temporary Industrial Placement – Design Engineer").kind).not.toBe("not_student");
  });
});

describe("placementRegion for towns we don't list", () => {
  it.each([["Ayr", "uk"], ["Gloucester", "uk"], ["Barrow-in-Furness, Portsmouth", "uk"], ["Bangalore, India", "other"]] as const)("%s → %s", (loc, r) => {
    expect(placementRegion(loc)).toBe(r);
  });
});

describe("more TargetJobs titles (live 2026-10-19)", () => {
  it.each([
    "Quality Improvement Technician (undergraduate placement)",
    "GRAHAM academy - Student Planner (Year Out Placement)",
    "Junior Finance Officer (Undergraduate Placement Year 2027-28)",
  ])("%s is a placement", (title) => {
    expect(classifyPlacement(title).kind).toBe("placement");
  });
});
