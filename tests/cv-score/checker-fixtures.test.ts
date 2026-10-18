import { describe, it, expect } from "vitest";
import { CHECKERS, confirmedSpellingErrors, hasQuantity } from "@/lib/cv-score/checkers";
import type { CvContext } from "@/lib/cv-score/context";
import type { CvRule } from "@/lib/cv-rules/types";
import { RULES_BY_ID } from "@/lib/cv-rules";
import type { ParsedCV, Year } from "@/lib/types";

// Audit 2026-10-18 fixture tables: 01#1/#2/#17/#18/#25, 02#2/#4/#8/#16, 03#2/#3/#13/#15/#26.
// Each detector gets at least 10 positive and 10 negative real phrasings taken from the reports.

const cv = (over: Partial<ParsedCV> = {}): ParsedCV => ({
  name: "Priya Shah", email: "p@x.co", phone: "07700 900123", location: null, links: [], summary: null,
  education: [], experience: [], projects: [], leadership: [], skills: [], interests: null,
  sectionOrder: ["education", "experience"], yearGuess: null, archetypes: [], ...over,
});
const ctx = (over: Partial<CvContext> = {}): CvContext => ({
  text: "", pageTexts: ["x"], pageCount: 1, fileSize: 1000, cv: cv(), year: "2nd", spellingErrors: [], ...over,
});
const R = (id: string) => RULES_BY_ID.get(id)!;
const edu = (line: string) => [{ id: "e0", institution: "University", degree: "BSc Economics", dates: "2024 – 2027", grade: null, details: [{ id: "d0", text: line }] }];
const entry = (title: string, bullets: string[] = []) => ({ id: "x", org: "Org", title, dates: "2025", location: "", bullets: bullets.map((text, i) => ({ id: `b${i}`, text })) });

describe("uk_grades: any stated result, in any format (G-32)", () => {
  const grade = (line: string, year: Year = "2nd") => CHECKERS.uk_grades(ctx({ year, cv: cv({ education: edu(line) }) }), R("G-32")).status;
  it.each([
    "First Class Honours",
    "Predicted 2:1",
    "2.1 (expected)",
    "Upper Second Class Honours",
    "Lower Second Class Honours (2:2)",
    "Third Class Honours",
    "MSc Finance, Distinction (predicted)",
    "MSc Data Science (Merit)",
    "Pass with Merit",
    "GPA 3.8/4.0",
    "CGPA 8.9/10",
    "IB Diploma: 38/45",
    "Year 1 average: 65%",
    "On track for a First",
    "Grade: 1st",
    "Overall average 68%",
  ])("pass: %s", (line) => expect(grade(line)).toBe("pass"));

  it.each([
    "A-levels",
    "A-levels: Maths, Economics, History",
    "Econometrics (72%)",
    "Modules: Statistics 72%, Probability 68%",
    "Predicted",
    "First place in UKMT Senior Challenge",
    "First-year representative",
    "Merit Scholarship recipient",
    "Third year group project",
    "Dean's List",
    "Python 3.10",
    "Distinction Award for outreach volunteering",
  ])("fail: %s", (line) => expect(grade(line)).toBe("fail"));

  it("a degree grade in the grade field passes", () => {
    const c = ctx({ cv: cv({ education: [{ id: "e0", institution: "U", degree: "BSc", dates: "", grade: "2:2", details: [] }] }) });
    expect(CHECKERS.uk_grades(c, R("G-32")).status).toBe("pass");
  });
  it("first-years with A-level grades but no university marks yet pass; later years need a degree result", () => {
    expect(grade("A-levels: Maths A*, Economics A, History A", "1st")).toBe("pass");
    expect(grade("A-levels: Maths A*, Economics A, History A", "final")).toBe("fail");
  });
  it("the fix text never tells a finalist to add A-levels", () => {
    const out = CHECKERS.uk_grades(ctx({ year: "final", cv: cv({ education: edu("Modules: Statistics") }) }), R("G-32"));
    expect(out.fix).not.toMatch(/A-level/i);
  });
});

describe("uk_personal_details: labelled personal data only, never nationality (G-17)", () => {
  const pd = (text: string) => CHECKERS.uk_personal_details(ctx({ text }), R("G-17")).status;
  it.each([
    "Date of Birth: 01/01/2005",
    "DOB: 1 Jan 2005",
    "D.O.B. 01.01.05",
    "Age: 19",
    "19 years old",
    "Marital status: Single",
    "Gender: Female",
    "Sex: Male",
    "Religion: Muslim",
    "Ethnicity: White British",
    "Nationality: British | DOB: 01/01/2005",
    "Birth date: 3 March 2006",
  ])("fail: %s", (text) => expect(pd(text)).toBe("fail"));

  it.each([
    "Nationality: British",
    "Modules: Nationality and Citizenship Law",
    "Gender Studies Society, Treasurer",
    "A-levels: Religious Studies (A)",
    "Agile methodologies; age-appropriate tutoring",
    "Intern, Dobson & Co (Jun 2025)",
    "Volunteer, Age UK (2024)",
    "Researched ethnicity gaps in pay for a dissertation",
    "Single-cell sequencing project",
    "Date: Sep 2024 – Jun 2025",
    "Right to work: Graduate visa, no sponsorship needed",
  ])("pass: %s", (text) => expect(pd(text)).toBe("pass"));
});

describe("github_link: real code or portfolio URLs only (SWE-07, DAT-06)", () => {
  const gh = (text: string, links: string[] = []) => CHECKERS.github_link(ctx({ text, cv: cv({ links }) }), R("DAT-06")).status;
  it.each([
    ["github.com/priyashah", []],
    ["https://gitlab.com/p/stack", []],
    ["kaggle.com/priyashah", []],
    ["public.tableau.com/app/profile/priya", []],
    ["huggingface.co/priya", []],
    ["priya-demo.streamlit.app", []],
    ["", ["https://priyashah.co.uk"]],
    ["bitbucket.org/priya/thesis", []],
    ["www.priyashah.dev", []],
    ["observablehq.com/@priya", []],
    ["https://devpost.com/priya", []],
    ["Portfolio: https://priya.netlify.app", []],
  ] as [string, string[]][])("pass: %s %j", (text, links) => expect(gh(text, links)).toBe("pass"));

  it.each([
    ["Portfolio Management Society, Treasurer", []],
    ["Managed a mock investment portfolio of £10k", []],
    ["Portfolio website (project)", []],
    ["Built a chat app with Socket.io", []],
    ["Stack: React, socket.io, Node.js", []],
    ["Followed web.dev performance guides", []],
    ["linkedin.com/in/priya", ["https://linkedin.com/in/priya"]],
    ["GitHub available on request", []],
    ["Python, Node.js, Next.js, Vue.js", []],
    ["priya@gmail.com", ["mailto:priya@gmail.com"]],
  ] as [string, string[]][])("fail: %s", (text, links) => expect(gh(text, links)).toBe("fail"));
});

describe("hasQuantity: dates, module codes and year labels don't count (G-22)", () => {
  it.each([
    "Served 200+ customers per shift",
    "Raised £1,450 for charity",
    "Cut report time by 40%",
    "Led a team of 6 volunteers",
    "Built a dashboard used by 3 store managers",
    "Grew followers from 800 to 2,300 in 10 weeks",
    "Ranked 2nd of 80 teams",
    "Processed 40k survey rows in Python",
    "Saved 2 hours a week by automating rotas",
    "Tutored 4 students weekly",
  ])("counts: %s", (b) => expect(hasQuantity(b)).toBe(true));

  it.each([
    "Organised weekly society events (Sep 2024 – Jun 2025)",
    "Year 2 group project on market entry",
    "COMP0002 coursework: built a parser",
    "First-year representative, 2024/25",
    "Worked 1 day a week alongside my studies",
    "Summer 2025 internship in the risk team",
    "Upgraded the site to Next.js 15",
    "Python 3.12 scripts for data cleaning",
    "Q3 planning support for the events team",
    "Helped the 2nd-year cohort settle in",
  ])("ignores: %s", (b) => expect(hasQuantity(b)).toBe(false));
});

describe("education_first: Education must come first (FCQ-02)", () => {
  const ef = (order: ParsedCV["sectionOrder"], year: Year = "2nd") => CHECKERS.education_first(ctx({ year, cv: cv({ sectionOrder: order }) }), R("FCQ-02")).status;
  it("passes when Education is first", () => expect(ef(["education", "experience", "skills"])).toBe("pass"));
  it("fails Experience then Education for a penultimate-year student", () => expect(ef(["experience", "education"])).toBe("fail"));
  it("is partial for finalists or Master's students who lead with experience", () => {
    expect(ef(["experience", "education"], "final")).toBe("partial");
    expect(ef(["experience", "education"], "masters")).toBe("partial");
  });
  it("is not applicable when no section order was parsed", () => expect(ef([])).toBe("not_applicable"));
});

describe("leadership_lexicon: positions of responsibility, incl. projects (FIN-06, CON-02)", () => {
  const lead = (where: "leadership" | "projects" | "experience", title: string, bullets: string[] = []) =>
    CHECKERS.leadership_lexicon(ctx({ cv: cv({ [where]: [entry(title, bullets)] }) }), R("CON-02")).status;
  it.each([
    ["leadership", "Founder, Coding Society", []],
    ["leadership", "Member", ["Founded a 60-member coding society"]],
    ["leadership", "Member", ["Co-founded a peer-tutoring scheme"]],
    ["projects", "Revision app", ["Launched an app used by 300 students"]],
    ["leadership", "Team lead, Hackathon", []],
    ["leadership", "Head Girl", []],
    ["leadership", "Prefect", []],
    ["experience", "Shift supervisor", ["Managed a team of 4 on weekends"]],
    ["leadership", "Member", ["Coordinated volunteers for a 200-guest fundraiser"]],
    ["leadership", "Member", ["Trained 3 new starters on the till"]],
    ["leadership", "President, Debating Society", []],
  ] as ["leadership" | "projects" | "experience", string, string[]][])("pass: %s %s %j", (w, t, b) => expect(lead(w, t, b)).toBe("pass"));

  it.each([
    ["leadership", "Member, Chess Club", []],
    ["experience", "Sales Assistant", ["Served customers at the till"]],
    ["projects", "Weather app", ["Built a weather app in React"]],
    ["leadership", "Volunteer", ["Helped at events"]],
    ["experience", "Barista", ["Made coffee and cleaned the store"]],
    ["leadership", "Member", ["Attended weekly debates"]],
    ["experience", "Intern", ["Supported the deal team"]],
    ["projects", "Leading-edge ML model", ["Studied leading indicators"]],
    ["leadership", "Participant", ["Took part in a case competition"]],
    ["experience", "Tutor", ["Explained algebra to students"]],
  ] as ["leadership" | "projects" | "experience", string, string[]][])("fail: %s %s %j", (w, t, b) => expect(lead(w, t, b)).toBe("fail"));
});

describe("skill_rating_glyphs: bars, stars, /5, /10 and % next to a skill (G-05)", () => {
  const sk = (text: string) => CHECKERS.skill_rating_glyphs(ctx({ text, cv: cv({ skills: [{ group: "Skills", items: ["Python", "Java", "SQL", "Excel"] }] }) }), R("G-05")).status;
  it.each([
    "Python ●●●●○", "SQL ● ● ● ○ ○", "Excel ★★★☆☆", "Python 8/10", "Java – 4/5", "Python (90%)", "SQL: 85%",
    "Excel ■■■□□", "Java (3/5)", "Python ◼◼◼◻◻",
    // Block-character bars, found by the gold-set harness (docs/validation, synthetic syn-05).
    "Python ████████░░ 80%", "Java ██████░░░░", "SQL ▰▰▰▱▱", "Excel ▓▓▓▒▒",
  ])("fail: %s", (t) => expect(sk(t)).toBe("fail"));
  it.each([
    "Python (proficient)", "SQL (familiar)", "Raised 40% more funds", "Scored 8/10 in a quiz night", "Excel: pivot tables, XLOOKUP",
    "Java, SQL, Python", "GPA 3.8/4.0", "Grade 5/5 in GCSE Maths", "Cut costs 15%", "Python — advanced",
    "Section break ────────", "█",
  ])("pass: %s", (t) => expect(sk(t)).toBe("pass"));
});

describe("cv_title: the name is the title (G-15)", () => {
  const t = (first: string) => CHECKERS.cv_title(ctx({ pageTexts: [`${first}\nPriya Shah\nEducation`] }), R("G-15")).status;
  it.each(["CURRICULUM VITAE", "Curriculum Vitae", "CV", "Resume", "Résumé", "Curriculum Vitae:"])("fail: %s", (l) => expect(t(l)).toBe("fail"));
  it.each(["Priya Shah", "PRIYA SHAH", "Priya Shah — CV skills", "Education"])("pass: %s", (l) => expect(t(l)).toBe("pass"));
});

describe("photo_present (G-39): uses the upload scan; never guesses", () => {
  const img = (over: Partial<{ page: number; x: number; y: number; w: number; h: number }> = {}) => ({ page: 1, x: 450, y: 700, w: 90, h: 110, pageW: 595, pageH: 842, ...over });
  const ph = (images: ReturnType<typeof img>[] | undefined) =>
    CHECKERS.photo_present(ctx({ safety: images === undefined ? { verdict: "clean", issues: [] } : { verdict: "clean", issues: [], images } }), R("G-39")).status;
  it("fails a headshot in the top third of page 1", () => expect(ph([img()])).toBe("fail"));
  it("passes a CV with no images", () => expect(ph([])).toBe("pass"));
  it("ignores a wide logo, a tiny icon and an image lower down or on page 2", () => {
    expect(ph([img({ w: 300, h: 40 })])).toBe("pass");
    expect(ph([img({ w: 12, h: 12 })])).toBe("pass");
    expect(ph([img({ y: 200 })])).toBe("pass");
    expect(ph([img({ page: 2 })])).toBe("pass");
  });
  it("is not applicable for CVs scanned before images were recorded", () => expect(ph(undefined)).toBe("not_applicable"));
});

describe("summary_length counts words (G-19)", () => {
  const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");
  const sl = (summary: string | null) => CHECKERS.summary_length(ctx({ cv: cv({ summary }) }), R("G-19")).status;
  it("no profile is fine", () => expect(sl(null)).toBe("not_applicable"));
  it("≤100 words pass, 101–150 partial, >150 fail", () => {
    expect(sl(words(100))).toBe("pass");
    expect(sl(words(120))).toBe("partial");
    expect(sl(words(151))).toBe("fail");
  });
});

describe("experience_present counts society roles and dated projects (EV-01)", () => {
  it("passes a first-year whose only experience is a society role", () => {
    expect(CHECKERS.experience_present(ctx({ cv: cv({ leadership: [entry("Treasurer, Netball Club")] }) }), R("EV-01")).status).toBe("pass");
  });
  it("fails a CV with nothing at all", () => {
    expect(CHECKERS.experience_present(ctx(), R("EV-01")).status).toBe("fail");
  });
});

describe("spelling: only confirmed errors count (G-25, 04#3)", () => {
  const text = "Analysed sales for Tesco. Managment of the Kaggle team at Ayşe's Bakery. Recieved an award.";
  const skills = { skills: [{ group: "Tools", items: ["PySpark", "Kaggle"] }] };
  it("drops capitalised names, skills, acronyms, UK/US variants and words not in the text", () => {
    expect(confirmedSpellingErrors(["Managment", "Recieved", "Ayşe", "PySpark", "EBITDA", "analysed", "teh", "Kaggle"], text, cv(skills)))
      .toEqual(["Managment", "Recieved"]);
  });
  it("1–2 confirmed errors are partial, 3+ fail", () => {
    const sp = (errs: string[]) => CHECKERS.spelling(ctx({ text: `${errs.join(" ")} words`, spellingErrors: errs }), R("G-25")).status;
    expect(sp(["recieve"])).toBe("partial");
    expect(sp(["recieve", "managment", "acheive"])).toBe("fail");
    expect(CHECKERS.spelling(ctx({ spellingErrors: null }), R("G-25")).status).toBe("not_applicable");
  });
});

describe("page_count: two full pages are fine outside finance; spillover is partial (G-11, 03#1)", () => {
  const full = "x".repeat(3000);
  const pc = (sector: CvContext["sector"], pages: string[]) => CHECKERS.page_count(ctx({ sector, pageCount: pages.length, pageTexts: pages }), R("G-11")).status;
  it("software: two full pages pass", () => expect(pc("software_eng", [full, full])).toBe("pass"));
  it("software: a second page with a few lines is partial", () => expect(pc("software_eng", [full, "x".repeat(200)])).toBe("partial"));
  it("finance: two pages are not one", () => expect(pc("finance_banking", [full, full])).not.toBe("pass"));
  it("three pages fail everywhere", () => expect(pc("software_eng", [full, full, full])).toBe("fail"));
  it("one page always passes", () => expect(pc("consulting", [full])).toBe("pass"));
});

describe("read_time (AU-03) passes the Education-first layout", () => {
  it("name + first education entry + a date in the top third", () => {
    const page = `Priya Shah\nUniversity of Leeds, BSc Economics, 2024 – 2027\n${"filler ".repeat(300)}\nIntern, Acme, Jun 2025`;
    const c = ctx({
      pageTexts: [page],
      cv: cv({ education: [{ id: "e", institution: "University of Leeds", degree: "BSc Economics", dates: "2024 – 2027", grade: null, details: [] }], experience: [entry("Intern")], sectionOrder: ["education", "experience"] }),
    });
    expect(CHECKERS.read_time(c, R("AU-03")).status).toBe("pass");
  });
});

it("every new checker is wired to a rule", () => {
  const used = new Set([...RULES_BY_ID.values()].filter((r: CvRule) => r.check === "code").map((r) => r.checker));
  for (const id of ["photo_present", "cv_title"]) expect(used.has(id as never), id).toBe(true);
});
