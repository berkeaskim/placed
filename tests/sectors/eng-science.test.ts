import { describe, it, expect } from "vitest";
import { archetypeScores } from "@/lib/ai/heuristics";
import { SYSTEM_PARSE_CV, SYSTEM_TAG_JOB } from "@/lib/ai/prompts";
import { RULES_BY_ID, rulesFor, weightsFor } from "@/lib/cv-rules";
import { resolvedMaxPages, resolvedSeverity, resolvedStatement } from "@/lib/cv-rules/adjust";
import { CHECKERS } from "@/lib/cv-score/checkers";
import type { CvContext } from "@/lib/cv-score/context";
import { withFieldPrior } from "@/lib/profile/field-prior";
import { QUESTIONS, scoreQuiz } from "@/lib/quiz/questions";
import { ROLE_TITLES } from "@/lib/quiz/view";
import { scoreFit } from "@/lib/scoring/fit";
import type { CoverageResult } from "@/lib/scoring/coverage";
import { extractSkills } from "@/lib/skills/extract";
import { LI_DIMENSION_WEIGHTS, LI_SECTOR_IMPORTANCE, liRulesFor } from "@/lib/linkedin-rules";
import { tailorPlaybook } from "@/lib/tailor/playbooks";
import { PLAYBOOKS } from "@/lib/playbooks";
import { ARCHETYPE_LABELS, type Archetype, type JobForScoring, type ParsedCV, type StudentProfile } from "@/lib/types";

// research/placement-year/07-engineering-science-sectors.md §7 test cases.

describe("job archetype detection (§7, title → top archetype)", () => {
  it.each([
    ["Mechanical Engineering Internship 2027", "", "engineering"],
    ["2027 Summer Internship - Mechanical Engineer - Cambridge", "", "engineering"],
    ["Undergraduate Airframe Engineer 2027", "", "engineering"],
    ["Industrial Placement – Civil Engineering", "Eurocodes, AutoCAD", "engineering"],
    ["12 Month Industrial Placement – Chemical Engineering", "", "engineering"],
    ["Software Engineer Placement", "", "software_eng"],
    ["Embedded Software Engineer Intern", "", "software_eng"],
    ["Systems Engineer", "Kubernetes, AWS", "software_eng"],
    ["Undergraduate Systems Engineer 2027", "requirements, V-model, aircraft", "engineering"],
    ["Test Engineer Placement", "rig testing, LabVIEW", "engineering"],
    ["Software Test Engineer", "", "software_eng"],
    ["UIPS – Analytical Chemistry", "HPLC, GC, NMR, GMP", "science_pharma"],
    ["Industrial Placement – Biopharmaceutical Development", "", "science_pharma"],
    ["Regulatory Affairs Placement", "", "science_pharma"],
    ["QC Analyst Placement", "", "science_pharma"],
    ["Research Scientist, Drug Discovery Placement", "GLP", "science_pharma"],
    ["Research Assistant, Machine Learning Group", "publications, PhD", "research"],
    ["PhD Research Internship – Computational Biology", "publications", "research"],
    ["Data Analyst – Pharma Commercial", "SQL, Power BI", "data_analytics"],
    ["Data Scientist Intern", "", "data_analytics"],
    ["Summer Analyst, Barclays PLC", "", "finance_banking"],
  ])("%s → %s", (title, body, expected) => {
    expect(archetypeScores(body, title)[0].key).toBe(expected);
  });

  it("never files a bare 'scientist' or 'laboratory' under research any more", () => {
    expect(archetypeScores("", "Laboratory Technician").find((s) => s.key === "research")!.score).toBe(0);
    expect(archetypeScores("", "Formulation Scientist").find((s) => s.key === "research")!.score).toBe(0);
  });

  it("the surname Meng is not an MEng degree", () => {
    expect(archetypeScores("Li Meng\nBSc Economics", "").find((s) => s.key === "engineering")!.score).toBe(0);
    expect(archetypeScores("MEng Mechanical Engineering", "").find((s) => s.key === "engineering")!.score).toBeGreaterThan(0);
  });

  it("tie-break: science_pharma beats research on pharma cues, engineering beats software on a discipline title", () => {
    // research (title "research scientist" ×3) vs science (body "pharma" + "gmp" + "glp" = 3): a tie broken by the pharma cue
    expect(archetypeScores("pharma GMP GLP", "Research Scientist")[0].key).toBe("science_pharma");
    // engineering (title "Electrical Engineer" ×3) vs software (body "software" ×3), the title has a discipline word
    expect(archetypeScores("software software software", "Electrical Engineer")[0].key).toBe("engineering");
  });
});

describe("CV archetype detection (§7)", () => {
  const top = (text: string) => archetypeScores(text).slice(0, 3).map((s) => s.key);
  it("BEng + SolidWorks + Formula Student → engineering", () => {
    expect(top("BEng Mechanical Engineering\nSolidWorks, MATLAB\nFormula Student suspension team")[0]).toBe("engineering");
  });
  it("MSci Chemistry + HPLC + NMR + COSHH → science_pharma", () => {
    expect(top("MSci Chemistry\nLaboratory: HPLC, NMR, TLC\nWrote COSHH assessments")[0]).toBe("science_pharma");
  });
  it("MSc ML + publications + PyTorch → research", () => {
    expect(top("MSc Artificial Intelligence\nPublications: two workshop papers\nPhD applicant, PyTorch")[0]).toBe("research");
  });
  it("Biomedical Engineering with ELISA and SolidWorks → engineering first, science second", () => {
    const t = top("BEng Biomedical Engineering\nSolidWorks, ANSYS\nELISA in the tissue lab");
    expect(t[0]).toBe("engineering");
    expect(t).toContain("science_pharma");
  });
});

describe("AI prompts define the new archetypes", () => {
  it.each([["tag", SYSTEM_TAG_JOB], ["parse", SYSTEM_PARSE_CV]])("%s prompt", (_, p) => {
    expect(p).toMatch(/engineering = mechanical/);
    expect(p).toMatch(/science_pharma = industrial lab/);
    expect(p).toMatch(/software_eng = software only/);
  });
});

describe("field prior (§4.3)", () => {
  const s = (key: Archetype, score: number) => ({ key, score, why: [] as string[] });
  it("a weak CV with field Engineering starts on engineering", () => {
    expect(withFieldPrior([s("software_eng", 20)], "Engineering")[0].key).toBe("engineering");
  });
  it("a tie is broken by the field", () => {
    expect(withFieldPrior([s("research", 100), s("science_pharma", 100)], "Natural Sciences")[0].key).toBe("science_pharma");
  });
  it("a clear CV signal is left alone", () => {
    const strong = [s("consulting", 100), s("engineering", 40)];
    expect(withFieldPrior(strong, "Engineering")).toBe(strong);
  });
  it("other fields and no field change nothing", () => {
    const weak = [s("software_eng", 10)];
    expect(withFieldPrior(weak, "Economics")).toBe(weak);
    expect(withFieldPrior(weak, null)).toBe(weak);
  });
});

describe("protected_titles checker (STM-02)", () => {
  const ctx = (text: string) => ({ text, pageTexts: [text], pageCount: 1, fileSize: 1000, cv: {} as ParsedCV, year: "2nd", spellingErrors: [] }) as CvContext;
  const run = (text: string) => CHECKERS.protected_titles(ctx(text), RULES_BY_ID.get("STM-02")!).status;
  it.each([
    "John Smith CEng",
    "MIMechE",
    "MRSC",
    "Jane Doe, BEng, IEng",
    "EngTech, Institution of Engineering and Technology",
    "CChem MRSC",
    "Priya Shah MIET",
    "Chartered Engineer (2025)",
    "CSci, Science Council",
    "FRSB",
    "Member: MICE",
  ])("fail: %s", (line) => expect(run(`Name\n${line}\nEducation`)).toBe("fail"));
  it.each([
    "MEng Mechanical Engineering (accredited by IMechE for CEng)",
    "Student member, IMechE",
    "Working towards CEng via the IMechE MPDS",
    "Student member of the RSC",
    "CEngineering Society treasurer",
    "Affiliate member, IMechE",
    "IMechE-accredited MEng, leading to CEng",
    "Member of the Engineering Society",
    "Chemistry Society (ChemSoc) social secretary",
    "Royal Society of Chemistry, student member",
    "Ceng is not a title",
  ])("pass: %s", (line) => expect(run(`Name\n${line}\nEducation`)).toBe("pass"));
  it("quotes the offending line in the fix", () => {
    const r = CHECKERS.protected_titles(ctx("A Student MIMechE"), RULES_BY_ID.get("STM-02")!);
    expect(r.evidenceLine).toBe("A Student MIMechE");
    expect(r.fix).toMatch(/Student member/);
  });
});

describe("rule packs (§7 rules library)", () => {
  const ids = (s: Archetype, t: "standard" | "spring" | "placement" = "standard") => rulesFor(s, t).map((r) => r.id);
  it("engineering gets ENG and STM rules and no software or research rules", () => {
    const e = ids("engineering");
    for (const id of ["ENG-01", "ENG-07", "STM-01", "STM-02", "STM-03"]) expect(e).toContain(id);
    expect(e.some((id) => /^(SWE|RES|SCI)-/.test(id))).toBe(false);
  });
  it("science_pharma gets SCI and STM rules and never RES-04 or RES-09", () => {
    const s = ids("science_pharma");
    for (const id of ["SCI-01", "SCI-08", "STM-01", "STM-02", "STM-03"]) expect(s).toContain(id);
    expect(s).not.toContain("RES-04");
    expect(s).not.toContain("RES-09");
    expect(s.some((id) => /^(SWE|ENG)-/.test(id))).toBe(false);
  });
  it("other sectors never see the STEM rules", () => {
    expect(ids("software_eng").some((id) => /^(ENG|SCI|STM)-/.test(id))).toBe(false);
    expect(ids("research").some((id) => /^(ENG|SCI|STM)-/.test(id))).toBe(false);
  });
  it("both sectors allow two pages and say so", () => {
    const g11 = RULES_BY_ID.get("G-11")!;
    for (const s of ["engineering", "science_pharma"] as const) {
      expect(resolvedMaxPages(g11, s, "2nd")).toBe(2);
      expect(resolvedStatement(g11, s)).toMatch(/One or two full A4 pages/);
    }
  });
  it("abbreviations are major for both sectors (HR screens first; GSK asks for few acronyms)", () => {
    const g07 = RULES_BY_ID.get("G-07")!;
    expect(resolvedSeverity(g07, "engineering", "2nd")).toBe("major");
    expect(resolvedSeverity(g07, "science_pharma", "2nd")).toBe("major");
    expect(resolvedSeverity(g07, "software_eng", "2nd")).toBe("minor");
  });
  it("G-21 names sector results", () => {
    expect(resolvedStatement(RULES_BY_ID.get("G-21")!, "engineering")).toMatch(/spec you met/);
    expect(resolvedStatement(RULES_BY_ID.get("G-21")!, "science_pharma")).toMatch(/yield, purity/);
  });
  it("STM rules carry a science wording", () => {
    expect(resolvedStatement(RULES_BY_ID.get("STM-01")!, "science_pharma")).toMatch(/practical lab work/);
    expect(resolvedStatement(RULES_BY_ID.get("STM-02")!, "science_pharma")).toMatch(/MRSC/);
    expect(resolvedStatement(RULES_BY_ID.get("STM-02")!, "engineering")).toMatch(/CEng/);
  });
  it("spring track skips STM-01 and ENG-04 and softens the core sector rules", () => {
    const e = ids("engineering", "spring");
    expect(e).not.toContain("STM-01");
    expect(e).not.toContain("ENG-04");
    expect(resolvedSeverity(RULES_BY_ID.get("ENG-01")!, "engineering", "2nd", "spring")).toBe("minor");
    expect(resolvedSeverity(RULES_BY_ID.get("SCI-03")!, "science_pharma", "2nd", "spring")).toBe("minor");
  });
  it("placement track: STM-01, ENG-02 and SCI-03 replace PLC-03 and PLC-04; PLC-05 only where no sector rule asks the same", () => {
    const e = ids("engineering", "placement");
    const s = ids("science_pharma", "placement");
    for (const x of [e, s]) {
      expect(x).toContain("STM-01");
      expect(x).not.toContain("PLC-03");
      expect(x).not.toContain("PLC-04");
      expect(x).toContain("PLC-01");
      expect(x).toContain("PLC-02");
    }
    expect(e).toContain("PLC-05");
    expect(s).not.toContain("PLC-05"); // SCI-02 asks for each technique with where it was used
    expect(s).toContain("SCI-02");
  });
  it("placement weights shift impact to uk for the new sectors too", () => {
    expect(weightsFor("engineering", "placement")).toEqual({ ats: 15, impact: 15, clarity: 20, relevance: 35, uk: 15 });
    expect(weightsFor("science_pharma", "placement")).toEqual({ ats: 15, impact: 10, clarity: 25, relevance: 35, uk: 15 });
  });
  it("ENG-04 is skipped for first years", () => {
    expect(RULES_BY_ID.get("ENG-04")!.yearAdjust?.["1st"]?.skip).toBe(true);
  });
});

describe("skills vocab (§4.5)", () => {
  it("names engineering tools and lab techniques as their own skills", () => {
    expect(extractSkills("Modelled the upright in SolidWorks and ran FEA in ANSYS")).toEqual(expect.arrayContaining(["SolidWorks", "FEA", "ANSYS"]));
    expect(extractSkills("HPLC, NMR and ELISA in the project lab")).toEqual(expect.arrayContaining(["HPLC", "NMR Spectroscopy", "ELISA"]));
  });
  it("microscopy no longer counts as HPLC or PCR", () => {
    const s = extractSkills("Confocal microscopy in the cell biology practical");
    expect(s).toContain("Microscopy");
    expect(s).not.toContain("HPLC");
    expect(s).not.toContain("PCR");
  });
  it("never reads Barclays PLC or a lean startup as engineering skills", () => {
    expect(extractSkills("Summer Analyst, Barclays plc")).not.toContain("PLC");
    expect(extractSkills("ran a lean startup sprint")).not.toContain("Lean Manufacturing");
  });
});

describe("quiz, labels, fit, LinkedIn and playbooks (§7)", () => {
  const pickFor = (key: Archetype) =>
    Object.fromEntries(QUESTIONS.map((q) => [q.id, q.options.find((o) => (o.weights[key] ?? 0) >= 2)?.id ?? q.options[0].id]));
  it.each(["engineering", "science_pharma"] as const)("%s can win the quiz", (a) => {
    expect(scoreQuiz(pickFor(a))[0].key).toBe(a);
  });
  it("labels and role titles", () => {
    expect(ARCHETYPE_LABELS.engineering).toBe("Engineering");
    expect(ARCHETYPE_LABELS.science_pharma).toBe("Science & Pharma");
    expect(ROLE_TITLES.engineering).toBe("Engineering Intern");
    expect(ROLE_TITLES.science_pharma).toBe("Lab Scientist Intern");
  });

  const student = (key: Archetype): StudentProfile => ({ year: "2nd", locationPref: ["london"], needsVisa: false, skills: [], archetypes: [{ key, score: 100, why: [] }] });
  const job = (archetype: Archetype): JobForScoring => ({
    id: "j", title: "Intern", location: "London", remote: false, archetype, yearEligibility: [], sponsorsVisa: "unknown",
    employmentType: "internship", firstYearFriendly: false, requirements: [], textLines: [], deadline: null, postedAt: null,
  });
  const cov: CoverageResult = { readable: true, weighted: 0.5, must: { matched: 0, total: 0 }, nice: { matched: 0, total: 0 }, items: [] };
  const sub = (s: Archetype, j: Archetype) => scoreFit(student(s), job(j), cov, "2026-10-20").sub.archetype;
  it("adjacent sectors score above unrelated ones", () => {
    expect(sub("engineering", "software_eng")).toBeGreaterThan(sub("engineering", "finance_banking"));
    expect(sub("science_pharma", "research")).toBeGreaterThan(sub("science_pharma", "marketing_growth"));
    expect(sub("engineering", "science_pharma")).toBe(sub("science_pharma", "engineering"));
  });

  it.each(["engineering", "science_pharma"] as const)("LinkedIn scores %s without throwing", (a) => {
    expect(liRulesFor(a).length).toBeGreaterThan(20);
    expect(Object.values(LI_DIMENSION_WEIGHTS[a]).reduce((n, x) => n + x, 0)).toBe(100);
    expect(LI_SECTOR_IMPORTANCE[a].note.length).toBeGreaterThan(20);
  });

  it.each(["engineering", "science_pharma"] as const)("%s has role and tailor playbooks", (a) => {
    expect(PLAYBOOKS[a].signals.length).toBeGreaterThanOrEqual(5);
    expect(PLAYBOOKS[a].actions.length).toBeGreaterThanOrEqual(10);
    expect(tailorPlaybook(a)?.pitfalls.some((p) => /CEng|GMP/.test(p))).toBe(true);
  });
});
