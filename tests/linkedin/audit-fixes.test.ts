import { readFileSync } from "node:fs";
import path from "node:path";
import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import type { ParsedCV } from "@/lib/types";
import { LI_RULES, liJudgeQuestion, liRulesFor } from "@/lib/linkedin-rules";
import { parseLinkedInExport, type LiExperience, type ParsedLinkedIn } from "@/lib/linkedin/parse-export";
import { NotLinkedInArchiveError, archiveDate, parseCsv, parseLinkedInArchive } from "@/lib/linkedin/parse-archive";
import { LI_CHECKERS, runLiCodeChecks } from "@/lib/linkedin-score/checkers";
import { crossCheckDates, mismatchedOrgs } from "@/lib/linkedin-score/cross-check";
import { CRITICAL_CAP_LABEL, aggregateLiScore } from "@/lib/linkedin-score/aggregate";
import { scoreLinkedIn } from "@/lib/linkedin-score/score";
import type { LiContext } from "@/lib/linkedin-score/context";
import { buildLiJudgePrompt, isJudged, requireQuoteForCritical, type LiJudgeInput, type LiJudgeResult } from "@/lib/ai/judgeLinkedIn";

/** Regression tests for the LinkedIn findings in docs/research/audit-2026-10-18/08-linkedin.md. */

const TEXT = readFileSync(path.join(__dirname, "fixtures", "ayse-synthetic-export.txt"), "utf8");
const AYSE_CV = JSON.parse(readFileSync(path.join(process.cwd(), "seed", "demo", "ayse.json"), "utf8")) as ParsedCV;
const TODAY = new Date("2026-10-18T12:00:00Z");
const li = parseLinkedInExport(TEXT, { knownName: "Ayşe Demir" });
const ctx = (over: Partial<ParsedLinkedIn> = {}, c: Partial<LiContext> = {}): LiContext => ({
  li: { ...li, ...over }, text: TEXT, cv: AYSE_CV, sector: "data_analytics", year: "2nd", today: TODAY, ...c,
});
const check = (id: string, c: LiContext) => LI_CHECKERS[id](c, liRulesFor(c.sector).find((r) => r.id === id) ?? (LI_RULES.find((r) => r.id === id)! as never));
const naJudge = async (i: LiJudgeInput): Promise<LiJudgeResult> => ({
  results: i.rules.map((r) => ({ ruleId: r.id, status: "not_applicable", evidenceLine: null, fix: null })), spellingErrors: [], modelId: "stub", cacheable: false,
});

const role = (company: string, title: string, dates: string, start: [number, number | null], end: [number, number | null] | null): LiExperience => ({
  company, title, dates, start: { year: start[0], month: start[1] }, end: end ? { year: end[0], month: end[1] } : null, location: null, description: "",
});
const cvWith = (exp: { org: string; dates: string }[], lead: { org: string; dates: string }[] = []): ParsedCV => ({
  ...AYSE_CV,
  experience: exp.map((e, k) => ({ id: `x${k}`, org: e.org, title: "Role", dates: e.dates, location: "", bullets: [] })),
  leadership: lead.map((e, k) => ({ id: `l${k}`, org: e.org, title: "Role", dates: e.dates, location: "", bullets: [] })),
});

describe("08 #1: CV↔LinkedIn date cross-check", () => {
  it("a promotion LinkedIn splits into two roles is not a contradiction", () => {
    const cv = cvWith([{ org: "Pret A Manger", dates: "Jun 2023 – Present" }]);
    const roles = [
      role("Pret A Manger", "Team Member", "June 2023 - December 2023 (7 months)", [2023, 6], [2023, 12]),
      role("Pret A Manger", "Team Leader", "January 2024 - Present (2 years 10 months)", [2024, 1], null),
    ];
    expect(crossCheckDates(cv, roles)).toEqual([]);
  });
  it("a society role as one CV line but two terms on LinkedIn is not a contradiction", () => {
    const cv = cvWith([], [{ org: "UCL Finance Society", dates: "2023–2025" }]);
    const roles = [
      role("UCL Finance Society", "Events Officer", "September 2023 - June 2024 (10 months)", [2023, 9], [2024, 6]),
      role("UCL Finance Society", "Vice President", "September 2024 - June 2025 (10 months)", [2024, 9], [2025, 6]),
    ];
    expect(crossCheckDates(cv, roles)).toEqual([]);
  });
  it("CV 'Summer 2025' agrees with LinkedIn Jun-Aug 2025", () => {
    const cv = cvWith([{ org: "Barclays", dates: "Summer 2025" }]);
    expect(crossCheckDates(cv, [role("Barclays", "Summer Analyst", "June 2025 - August 2025 (3 months)", [2025, 6], [2025, 8])])).toEqual([]);
  });
  it("still flags a LinkedIn start well before the CV's earliest date", () => {
    const cv = cvWith([{ org: "Barclays", dates: "Jun 2025 – Aug 2025" }]);
    expect(crossCheckDates(cv, [role("Barclays", "Analyst", "January 2025 - August 2025 (8 months)", [2025, 1], [2025, 8])])).toHaveLength(1);
  });
  it("flags Present vs ended on the latest role only", () => {
    const cv = cvWith([{ org: "Pret A Manger", dates: "Jun 2023 – Dec 2024" }]);
    const roles = [
      role("Pret A Manger", "Team Member", "June 2023 - December 2023 (7 months)", [2023, 6], [2023, 12]),
      role("Pret A Manger", "Team Leader", "January 2024 - Present (2 years 10 months)", [2024, 1], null),
    ];
    const m = crossCheckDates(cv, roles);
    expect(m).toHaveLength(1);
    expect(m[0].linkedin).toMatch(/^January 2024/);
  });
  it("flags a LinkedIn end more than a month after the CV end", () => {
    const cv = cvWith([{ org: "Barclays", dates: "Jun 2025 – Aug 2025" }]);
    expect(crossCheckDates(cv, [role("Barclays", "Analyst", "June 2025 - December 2025 (7 months)", [2025, 6], [2025, 12])])).toHaveLength(1);
  });
  it("counts organisations, not roles", () => {
    expect(mismatchedOrgs([{ company: "Barclays", cv: "", linkedin: "", evidenceLine: "" }, { company: "Barclays plc", cv: "", linkedin: "", evidenceLine: "" }])).toBe(1);
  });
  it("one organisation's mismatch scores as major with no cap; two organisations stay critical and cap", async () => {
    const one = await scoreLinkedIn({ li, rawText: TEXT, cv: AYSE_CV, sector: "data_analytics", year: "penultimate", today: TODAY, judge: naJudge });
    expect(one.capsApplied).not.toContain(CRITICAL_CAP_LABEL);
    expect(one.fixes.find((f) => f.ruleId === "LI-GEN-01")?.severity).toBe("major");

    const cv = cvWith([{ org: "Marlowe Café", dates: "2026–2026" }], [{ org: "UCL Finance Society", dates: "2026–present" }]);
    const two = await scoreLinkedIn({ li, rawText: TEXT, cv, sector: "data_analytics", year: "penultimate", today: TODAY, judge: naJudge });
    expect(two.results.find((r) => r.ruleId === "LI-GEN-01")?.detail).toMatch(/2 organisation/);
    expect(two.capsApplied).toContain(CRITICAL_CAP_LABEL);
  });
});

describe("08 #2, #14: LLM-only critical rules", () => {
  const rules = liRulesFor("finance_banking");
  const allPass = (over: Record<string, { status: "fail"; evidenceLine: string | null }>) =>
    rules.filter((r) => r.dimension !== "presence").map((r) => ({ ruleId: r.id, fix: null, ...(over[r.id] ?? { status: "pass" as const, evidenceLine: "x" }) }));
  it("a critical LLM fail with no quoted line becomes could_not_assess", () => {
    const out = requireQuoteForCritical([{ ruleId: "LI-GEN-03", status: "fail", evidenceLine: null, fix: "x" }, { ruleId: "LI-GEN-05", status: "fail", evidenceLine: null, fix: "x" }], rules, "finance_banking", "2nd");
    expect(out[0]).toMatchObject({ status: "could_not_assess" });
    expect(out[1].status).toBe("fail");
  });
  it("a quoted fail on a D-graded critical rule (LI-GEN-03) does not cap the score", () => {
    const s = aggregateLiScore({ rules, results: allPass({ "LI-GEN-03": { status: "fail", evidenceLine: "Analysed sales data for Tesco's Clubcard team" } }), sector: "finance_banking", year: "2nd", facts: { nearlyEmpty: false } });
    expect(s.capsApplied).not.toContain(CRITICAL_CAP_LABEL);
  });
  it("LI-FINANCE_BANKING-06 is major: an LLM finfluencer fail doesn't cap", () => {
    expect(rules.find((r) => r.id === "LI-FINANCE_BANKING-06")?.severity).toBe("major");
    const s = aggregateLiScore({ rules, results: allPass({ "LI-FINANCE_BANKING-06": { status: "fail", evidenceLine: "Made 40% on my ISA this year" } }), sector: "finance_banking", year: "2nd", facts: { nearlyEmpty: false } });
    expect(s.capsApplied).not.toContain(CRITICAL_CAP_LABEL);
  });
  it("a code-detected paid-signals promotion stays critical and caps", async () => {
    const s = await scoreLinkedIn({ li: { ...li, headline: "Economics @ UCL | Crypto trader | DM for signals" }, rawText: TEXT, cv: null, sector: "finance_banking", year: "2nd", today: TODAY, judge: naJudge });
    expect(s.results.find((r) => r.ruleId === "LI-FINANCE_BANKING-06")).toMatchObject({ status: "fail" });
    expect(s.capsApplied).toContain(CRITICAL_CAP_LABEL);
    expect(s.fixes[0]).toMatchObject({ ruleId: "LI-FINANCE_BANKING-06", severity: "critical", risk: true });
  });
  it("LI-GEN-03 asks a decidable question: naming a client is not a fail", () => {
    const q = liJudgeQuestion(LI_RULES.find((r) => r.id === "LI-GEN-03")!);
    expect(q).toMatch(/Naming an employer or client alone is NOT a fail/);
  });
});

describe("08 #3, #15: the judge gets year, sector and resolved thresholds", () => {
  const base = { redactedText: "x", structuredText: "x", cvText: null };
  it("renders the student line and the 1st-year threshold", () => {
    const rules = liRulesFor("finance_banking").filter(isJudged);
    const p = buildLiJudgePrompt({ ...base, rules, sector: "finance_banking", year: "1st", source: "pdf" });
    expect(p).toMatch(/^STUDENT: year=1st; target sector=Finance/);
    expect(p).toMatch(/\[LI-FINANCE_BANKING-08\][^\n]*threshold for this student: 60; upper bound 200/);
    const p2 = buildLiJudgePrompt({ ...base, rules, sector: "finance_banking", year: "final" });
    expect(p2).toMatch(/\[LI-FINANCE_BANKING-08\][^\n]*threshold for this student: 80/);
  });
  it("uses the sector's params (consulting 1st-year threshold 1)", () => {
    const p = buildLiJudgePrompt({ ...base, rules: liRulesFor("consulting").filter(isJudged), sector: "consulting", year: "1st" });
    expect(p).toMatch(/\[LI-CONSULTING-03\][^\n]*threshold for this student: 1\b/);
  });
  it("marks critical rules as needing a quote", () => {
    const p = buildLiJudgePrompt({ ...base, rules: liRulesFor("data_analytics").filter(isJudged), sector: "data_analytics", year: "2nd" });
    expect(p).toMatch(/\[LI-GEN-02\] \(CRITICAL: a fail must quote the line\)/);
  });
  it("never tells the judge that code checks ran", () => {
    for (const r of LI_RULES.filter((x) => (x.check === "llm" || x.check === "hybrid") && !x.advisory)) {
      const q = liJudgeQuestion(r);
      expect(q, r.id).not.toMatch(/\b(Code|Regex|regex|Lexicon|lexicon|keyword bank|Digit density|Spell-check|pre-filter)\b/);
      expect(q.length, r.id).toBeGreaterThan(20);
    }
  });
  it("judges personal contribution, not grammatical person (08 #25)", () => {
    for (const id of ["LI-SOFTWARE_ENG-08", "LI-FINANCE_BANKING-08", "LI-FINANCE_BANKING-10", "LI-CONSULTING-05"]) {
      expect(LI_RULES.find((r) => r.id === id)!.statement, id).not.toMatch(/first person|\('I'\)/i);
    }
  });
});

describe("08 #20: code rules without a checker are counted in coverage", () => {
  it("returns input:unimplemented, which aggregate counts as not covered", () => {
    const rules = liRulesFor("data_analytics").map((r) => (r.id === "LI-GEN-11" ? { ...r, id: "LI-GEN-XX" } : r));
    const res = runLiCodeChecks(rules.filter((r) => r.id === "LI-GEN-XX"), ctx());
    expect(res[0]).toMatchObject({ status: "not_applicable", detail: "input:unimplemented" });
    expect(aggregateLiScore({ rules, results: res, sector: "data_analytics", year: "2nd", facts: { nearlyEmpty: false } }).notCovered).toBe(1);
  });
});

describe("08 #4, #29: what each input can see", () => {
  it("PDF: pdfContested rules are not judged and are counted as not covered", async () => {
    let seen: LiJudgeInput | null = null;
    const s = await scoreLinkedIn({ li, rawText: TEXT, cv: null, sector: "software_eng", year: "2nd", today: TODAY, source: "pdf", judge: async (i) => { seen = i; return naJudge(i); } });
    expect(seen!.rules.some((r) => r.id === "LI-SOFTWARE_ENG-04")).toBe(false);
    expect(s.results.find((r) => r.ruleId === "LI-SOFTWARE_ENG-04")?.detail).toBe("input:pdf_contested");
  });
  it("archive/extension: contested rules are judged", async () => {
    let seen: LiJudgeInput | null = null;
    await scoreLinkedIn({ li: { ...li, skillsScope: "all" }, rawText: TEXT, cv: null, sector: "software_eng", year: "2nd", today: TODAY, source: "archive", judge: async (i) => { seen = i; return naJudge(i); } });
    expect(seen!.rules.some((r) => r.id === "LI-SOFTWARE_ENG-04")).toBe(true);
    expect(seen!.source).toBe("archive");
  });
  it("top-skills rules: PDF judges the shown skills; a full list is not assessable; no list is n/a", () => {
    const top = { topSkills: ["Microsoft Excel", "Python"], skillsScope: "top" as const };
    const all = { topSkills: ["Microsoft Excel", "Python", "SQL"], skillsScope: "all" as const };
    expect(check("LI-SOFTWARE_ENG-06", ctx(top, { sector: "software_eng" })).status).toBe("fail");
    expect(check("LI-SOFTWARE_ENG-06", ctx(all, { sector: "software_eng" }))).toMatchObject({ status: "not_applicable", detail: "input:top_skills_unknown" });
    expect(check("LI-DATA_ANALYTICS-03", ctx(all))).toMatchObject({ status: "not_applicable", detail: "input:top_skills_unknown" });
    expect(check("LI-DATA_ANALYTICS-03", ctx({ topSkills: ["Python"], skillsScope: "all" })).status).toBe("fail");
    expect(check("LI-DATA_ANALYTICS-03", ctx({ topSkills: [], skillsScope: "none" })).status).toBe("not_applicable");
  });
  it("office padding: seen in any list fails; absent from the PDF's top 3 is not assessable; absent from the full list passes", () => {
    const q = { sector: "quant_trading" as const };
    expect(check("LI-QUANT_TRADING-08", ctx({ topSkills: ["Python", "Excel"], skillsScope: "top" }, q)).status).toBe("fail");
    expect(check("LI-QUANT_TRADING-08", ctx({ topSkills: ["Python", "C++"], skillsScope: "top" }, q))).toMatchObject({ status: "not_applicable", detail: "input:full_skills_needed" });
    expect(check("LI-QUANT_TRADING-08", ctx({ topSkills: ["Python", "C++", "Probability"], skillsScope: "all" }, q)).status).toBe("pass");
  });
  it("skills-count rules run only on the full list", () => {
    expect(check("LI-CONSULTING-09", ctx({ skillsScope: "top" }, { sector: "consulting" })).detail).toBe("input:full_skills_needed");
    const sk = ["Problem Solving", "Data Analysis", "Microsoft Excel", "PowerPoint", "Market Research", "Stakeholder Management"];
    expect(check("LI-CONSULTING-09", ctx({ topSkills: sk, skillsScope: "all" }, { sector: "consulting" })).status).toBe("pass");
    expect(check("LI-CONSULTING-09", ctx({ topSkills: sk.slice(0, 3), skillsScope: "all" }, { sector: "consulting" })).status).toBe("fail");
    expect(check("LI-PRODUCT-10", ctx({ topSkills: ["User Research", "SQL", "Figma", "A/B Testing", "Hard-working"], skillsScope: "all" }, { sector: "product" })).status).toBe("fail");
    expect(check("LI-MARKETING_GROWTH-09", ctx({ topSkills: ["Social Media Marketing", "Copywriting", "GA4", "Canva", "SEO", "Excel", "Python", "Photography", "Teamwork", "Video Editing"], skillsScope: "all" }, { sector: "marketing_growth" })).status).toBe("pass");
  });
});

describe("08 checker bugs", () => {
  it("#5: the playbook's Good headline passes LI-GEN-08; a pipe-stuffed one fails", () => {
    expect(check("LI-GEN-08", ctx({ headline: "Maths & Stats @ UCL (2nd yr) | Aspiring Data Analyst | SQL · Python (pandas) · Power BI | Seeking 2027 summer internship" })).status).toBe("pass");
    expect(check("LI-GEN-08", ctx({ headline: "CS @ Imperial '27 | Product + data | Shipped a Chrome extension (1.2k weekly users) · SQL · A/B testing | Product Manager Intern 2027" })).status).toBe("pass");
    expect(check("LI-GEN-08", ctx({ headline: "Python | SQL | Excel | Tableau | Power BI | Data" })).status).toBe("fail");
  });
  it("#6: a non-UK location is never a fail; blank still is", () => {
    expect(check("LI-GEN-10", ctx({ location: "Lagos, Nigeria" }))).toMatchObject({ status: "not_applicable", detail: "non-UK location" });
    expect(check("LI-GEN-10", ctx({ location: "Mumbai, Maharashtra, India" })).status).toBe("not_applicable");
    expect(check("LI-GEN-10", ctx({ location: "Swansea, Wales" })).status).toBe("pass");
    expect(check("LI-GEN-10", ctx({ location: null })).status).toBe("fail");
  });
  it("#8: 'Expected graduation' is not a grade (SWE-11 still needs modules)", () => {
    const edu = [{ school: "UCL", degree: "BSc Computer Science", startYear: 2024, endYear: 2027, details: "Expected graduation: June 2027" }];
    expect(check("LI-SOFTWARE_ENG-11", ctx({ education: edu }, { sector: "software_eng" })).status).toBe("fail");
    expect(check("LI-SOFTWARE_ENG-11", ctx({ education: [{ ...edu[0], details: "Predicted 2:1" }] }, { sector: "software_eng" })).status).toBe("pass");
  });
  it("#9: FIN-11 never penalises a missing grade", () => {
    const f = { sector: "finance_banking" as const };
    const edu = [{ school: "UCL", degree: "BSc Economics", startYear: 2024, endYear: 2027, details: "Modules: Econometrics" }];
    expect(check("LI-FINANCE_BANKING-11", ctx({ education: edu }, f)).status).toBe("not_applicable");
    expect(check("LI-FINANCE_BANKING-11", ctx({ education: [] }, f)).status).toBe("not_applicable");
    expect(check("LI-FINANCE_BANKING-11", ctx({ education: [{ ...edu[0], details: "Grade: 2:1 (predicted)" }] }, f)).status).toBe("pass");
  });
  it("#16: 'my first step into trading' is not a competition", () => {
    const q = { sector: "quant_trading" as const };
    expect(check("LI-QUANT_TRADING-03", ctx({ honors: [], about: "This internship was my first step into trading.", experience: [] }, q)).status).toBe("not_applicable");
    expect(check("LI-QUANT_TRADING-03", ctx({ honors: ["Kaggle competition 2025"], about: "", experience: [] }, q)).status).toBe("fail");
  });
  it("#17: a slug ending in a year passes", () => {
    expect(check("LI-GEN-11", ctx({ profileUrl: "www.linkedin.com/in/jane-doe-2003" })).status).toBe("pass");
    expect(check("LI-GEN-11", ctx({ profileUrl: "www.linkedin.com/in/aisha-khan-2027" })).status).toBe("pass");
    expect(check("LI-GEN-11", ctx({ profileUrl: "www.linkedin.com/in/jane-doe-1a2b3c4d" })).status).toBe("fail");
  });
  it("#18: R&D is not R; the word 'portfolio' is not a link", () => {
    expect(check("LI-DATA_ANALYTICS-04", ctx({ topSkills: ["Tableau"], about: "R&D Intern at GSK.", experience: [], education: [], certifications: [], honors: [], headline: "" })).status).toBe("fail");
    expect(check("LI-SOFTWARE_ENG-01", ctx({ links: [], about: "I manage a portfolio of society events." }, { sector: "software_eng" })).status).toBe("fail");
    expect(check("LI-DATA_ANALYTICS-07", ctx({ links: [], about: "My portfolio is available on request." })).status).toBe("fail");
    expect(check("LI-SOFTWARE_ENG-01", ctx({ links: [], about: "Code: https://github.com/ayse" }, { sector: "software_eng" })).status).toBe("pass");
  });
  it("#19: DATA-07 no longer claims a reachability check", () => {
    expect(LI_RULES.find((r) => r.id === "LI-DATA_ANALYTICS-07")!.statement).not.toMatch(/reachable/);
  });
  it("#30: 'Start date TBC' is not a placeholder", () => {
    expect(check("LI-GEN-23", ctx({ headline: "Incoming Analyst (team TBC)", about: "Offer accepted. Start date TBC.", experience: [] })).status).toBe("pass");
    expect(check("LI-GEN-23", ctx({ headline: "[Company] analyst", about: "", experience: [] })).status).toBe("fail");
  });
});

describe("08 #10, #26: wording", () => {
  it("CFA fix copy says when 'CFA Program candidate' may be used", () => {
    const r = check("LI-FINANCE_BANKING-04", ctx({ headline: "Economics | CFA Level I candidate" }, { sector: "finance_banking" }));
    expect(r.fix).toMatch(/only while registered for an upcoming exam or awaiting results/);
  });
  it("virtual work experience is named as such", () => {
    expect(LI_RULES.find((r) => r.id === "LI-GEN-02")!.statement).toMatch(/virtual work experience or job simulations/);
  });
});

describe("08 #11: LinkedIn data archive (Download your data)", () => {
  const PROFILE = 'First Name,Last Name,Maiden Name,Address,Birth Date,Headline,Summary,Industry,Zip Code,Geo Location,Twitter Handles,Websites,Instant Messengers\n'
    + 'Ayşe,Demir,,,,"Economics @ UCL | Data analysis in Python & SQL","Second-year economics student.\nI built a pricing dashboard, cutting reporting from 6 hours to 20 minutes.",Higher Education,,"London, England, United Kingdom",,"[PORTFOLIO:https://github.com/ayse-demir]",\n';
  const POSITIONS = 'Company Name,Title,Description,Location,Started On,Finished On\n'
    + 'Brew & Co,Data Analyst Intern,"Built a pricing dashboard in Python and SQL, used by 12 store managers.","London, United Kingdom",Jun 2025,Aug 2025\n'
    + 'UCL Finance Society,Events Officer,Ran weekly events.,,Sep 2024,\n';
  const EDUCATION = 'School Name,Start Date,End Date,Notes,Degree Name,Activities\nUCL,2024,2027,"Grade: First (predicted)",BSc Economics,Finance Society\n';
  const SKILLS = 'Name\nPython (Programming Language)\nSQL\nData Analysis\n';
  const PROJECTS = 'Title,Description,Url,Started On,Finished On\nFare model,Logistic regression on TfL data.,https://ayse.dev/fare,,\n';
  const zip = (files: Record<string, string>) => zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)])));

  it("parses CSVs with quoted commas and newlines", () => {
    expect(parseCsv('a,b\n"x, y","line1\nline2"\n')).toEqual([["a", "b"], ["x, y", "line1\nline2"]]);
    expect(archiveDate("Jun 2025")).toEqual({ year: 2025, month: 6 });
    expect(archiveDate("2024")).toEqual({ year: 2024, month: null });
    expect(archiveDate("06/2025")).toEqual({ year: 2025, month: 6 });
  });
  it("reads profile, positions, education, full skills and projects from the zip", () => {
    const { li: a, text } = parseLinkedInArchive(zip({ "Profile.csv": PROFILE, "Positions.csv": POSITIONS, "Education.csv": EDUCATION, "Skills.csv": SKILLS, "Projects.csv": PROJECTS, "messages.csv": "secret" }));
    expect(a.name).toBe("Ayşe Demir");
    expect(a.headline).toMatch(/^Economics @ UCL/);
    expect(a.location).toBe("London, England, United Kingdom");
    expect(a.experience[0]).toMatchObject({ company: "Brew & Co", title: "Data Analyst Intern", dates: "Jun 2025 - Aug 2025", start: { year: 2025, month: 6 }, end: { year: 2025, month: 8 } });
    expect(a.experience[1]).toMatchObject({ dates: "Sep 2024 - Present", end: null });
    expect(a.education[0]).toMatchObject({ school: "UCL", degree: "BSc Economics", startYear: 2024, endYear: 2027 });
    expect(a.education[0].details).toContain("Grade: First");
    expect(a.skillsScope).toBe("all");
    expect(a.topSkills).toEqual(["Python (Programming Language)", "SQL", "Data Analysis"]);
    expect(a.projects[0].title).toBe("Fare model");
    expect(a.links).toEqual(["https://github.com/ayse-demir", "https://ayse.dev/fare"]);
    expect(text).not.toContain("secret");
  });
  it("scores an archive end to end: the date rule and the cross-check read archive dates", async () => {
    const { li: a, text } = parseLinkedInArchive(zip({ "Profile.csv": PROFILE, "Positions.csv": POSITIONS, "Education.csv": EDUCATION, "Skills.csv": SKILLS }));
    const s = await scoreLinkedIn({ li: a, rawText: text, cv: AYSE_CV, sector: "data_analytics", year: "2nd", today: TODAY, judge: naJudge, source: "archive" });
    expect(s.results.find((r) => r.ruleId === "LI-GEN-15")?.status).toBe("pass");
    expect(s.results.find((r) => r.ruleId === "LI-DATA_ANALYTICS-07")?.status).toBe("pass");
    expect(s.assessed).toBeGreaterThan(5);
  });
  it("without Skills.csv the skills rules are n/a, not fails", () => {
    const { li: a } = parseLinkedInArchive(zip({ "Profile.csv": PROFILE, "Positions.csv": POSITIONS }));
    expect(a.skillsScope).toBe("none");
    expect(check("LI-DATA_ANALYTICS-03", ctx(a)).status).toBe("not_applicable");
  });
  it("rejects a zip without the profile files, and non-zip bytes", () => {
    expect(() => parseLinkedInArchive(zip({ "notes.txt": "hi" }))).toThrow(NotLinkedInArchiveError);
    expect(() => parseLinkedInArchive(strToU8("not a zip"))).toThrow(NotLinkedInArchiveError);
  });
});
