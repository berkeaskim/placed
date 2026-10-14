/**
 * Task 22b acceptance probe: legitimate Economics-student rephrasings must never block, and the adversarial list must.
 * Fixture: UCL BSc Economics 2024–2027; Economics Society Events Officer; Northside Market Retail Assistant; 2025 pandas
 * footfall project; 2025 Food Bank Excel volunteering.
 */
import { describe, it, expect } from "vitest";
import { verifyTailoring, toTailored } from "@/lib/verify/tailoring";
import type { ParsedCV, TailoredCV } from "@/lib/types";

const cv: ParsedCV = {
  name: "D", email: null, phone: null, location: "London", links: [], summary: null,
  education: [{ id: "e0", institution: "UCL", degree: "BSc Economics", dates: "2024–2027", grade: "Predicted 2:1", details: [] }],
  experience: [
    { id: "x0", org: "Economics Society", title: "Events Officer", dates: "Sep 2025 – Jun 2026", location: "London", bullets: [
      { id: "x0-b0", text: "Organised weekly society events for 60 members" },
    ] },
    { id: "x1", org: "Northside Market", title: "Retail Assistant", dates: "Jun 2024 – Aug 2025", location: "London", bullets: [
      { id: "x1-b0", text: "Served customers on the till during weekend shifts" },
    ] },
  ],
  projects: [{ id: "p0", org: "", title: "Footfall Analysis", dates: "2025", location: "", bullets: [
    { id: "p0-b0", text: "Analysed shop footfall data with pandas to suggest staffing changes" },
  ] }],
  leadership: [{ id: "l0", org: "Food Bank", title: "Volunteer", dates: "2025", location: "London", bullets: [
    { id: "l0-b0", text: "Tracked weekly donations in Excel" },
  ] }],
  skills: [{ group: "Skills", items: ["Excel", "Python", "pandas"] }], interests: null, sectionOrder: [], yearGuess: null, archetypes: [],
};
const cvText = "UCL BSc Economics 2024–2027 Predicted 2:1\nEconomics Society Events Officer Sep 2025 – Jun 2026\nOrganised weekly society events for 60 members\n" +
  "Northside Market Retail Assistant Jun 2024 – Aug 2025\nServed customers on the till during weekend shifts\nFootfall Analysis 2025\n" +
  "Analysed shop footfall data with pandas to suggest staffing changes\nFood Bank Volunteer 2025\nTracked weekly donations in Excel\nExcel, Python, pandas";

type Where = "summary" | "events" | "retail" | "project" | "foodbank";
const run = (where: Where, text: string, jd: string[] = ["Excel", "stakeholder", "Xero"]) => {
  const t: TailoredCV = toTailored(cv);
  const set = (b: { text: string; changeType?: string }) => Object.assign(b, { text, changeType: "rephrased" });
  if (where === "summary") t.summary = text;
  else if (where === "events") set(t.experience[0].bullets[0]);
  else if (where === "retail") set(t.experience[1].bullets[0]);
  else if (where === "project") set(t.projects[0].bullets[0]);
  else set(t.leadership[0].bullets[0]);
  return verifyTailoring({ source: cv, sourceText: cvText, confirmedFacts: [], tailored: t, jdKeywords: jd, coverageBefore: 0.3, coverageAfter: 0.5 });
};

export const LEGIT: [Where, string][] = [
  // summaries with compound adjectives
  ["summary", "Evidence-based Economics student at UCL (2024–2027)"],
  ["summary", "Commercially-savvy Economics student at UCL, graduating 2027"],
  ["summary", "Financially-literate BSc Economics student at UCL"],
  ["summary", "Technically-proficient Economics student at UCL with Excel and pandas"],
  ["summary", "Digitally-literate Economics student at UCL, 2027 graduate"],
  ["summary", "Analytics-ready Economics student at UCL"],
  ["summary", "Commercially-astute UCL Economics student, Class of 2027"],
  ["summary", "Numerically-skilled Economics student at UCL with Python and Excel"],
  ["summary", "Economically-literate and Evidence-led student at UCL"],
  ["summary", "Internationally-experienced Economics student at UCL"],
  ["summary", "Quantitatively-trained Economics student at UCL, predicted 2:1"],
  ["summary", "Evidence-informed Economics student at UCL; Events Officer since 2025"],
  ["summary", "Insight-led Economics student at UCL with a 2025 pandas footfall project"],
  ["summary", "Insight-based, Policy-literate Economics student at UCL"],
  ["summary", "Analytics-literate Economics student at UCL, Retail Assistant 2024–2025"],
  ["summary", "Career-ready Economics student at UCL"],
  ["summary", "Interview-ready, Workplace-ready Economics student at UCL"],
  ["summary", "Audit-ready Economics student at UCL with Excel"],
  ["summary", "Media-savvy Events Officer and Economics student at UCL"],
  ["summary", "Digital-savvy and Commerce-savvy Economics student at UCL"],
  ["summary", "Model-literate, Theory-grounded Economics student at UCL"],
  ["summary", "Survey-based research interests; Economics student at UCL"],
  ["summary", "Revenue-led thinking from retail work at Northside Market"],
  ["summary", "Office-proficient Economics student at UCL"],
  ["summary", "Event-experienced Economics student at UCL"],
  ["summary", "Data-driven Economics student at UCL, graduating in 2027"],
  ["summary", "Detail-oriented Economics student at UCL"],
  ["summary", "Customer-focused Retail Assistant and UCL Economics student"],
  ["summary", "Policy-focused Economics student at UCL"],
  ["summary", "Results-focused Economics student at UCL, 2024–2027"],
  ["summary", "Excel-trained Economics student at UCL"],
  ["summary", "Self-funded Economics student at UCL"],
  ["summary", "Society-trained events organiser and Economics student at UCL"],
  ["summary", "Research-minded Economics student at UCL"],
  ["summary", "Finance-literate Economics student at UCL"],
  ["summary", "Market-aware Economics student with Northside Market retail experience"],
  ["summary", "Client-minded retail experience at Northside Market; Economics student at UCL"],
  ["summary", "Team-oriented Economics student at UCL"],
  ["summary", "Community-minded Food Bank volunteer and Economics student at UCL"],
  ["summary", "Process-literate, Quality-focused Economics student at UCL"],
  ["summary", "Risk-aware, Impact-driven Economics student at UCL"],
  ["summary", "Customer-service experienced Economics student at UCL"],
  ["summary", "Stakeholder-ready Economics student at UCL"],
  ["summary", "Fully trained Retail Assistant and Economics student at UCL"],
  ["summary", "Economics student at UCL using Microsoft Excel and pandas"],
  ["summary", "UCL Economics student (2027); Events Officer 2025–2026; Food Bank volunteer 2025"],
  ["summary", "Economics student at UCL, Commercially-savvy and Numerically-skilled"],
  ["summary", "Economics student at UCL, Evidence-based and Data-literate"],
  // bullets
  ["events", "Organised weekly Society-run events for 60 members"],
  ["events", "Organised weekly society events for 60 members as Events Officer 2025"],
  ["events", "Planned and organised weekly society events for 60 members"],
  ["events", "Organised weekly, member-focused society events for 60 members"],
  ["events", "Trained volunteers while organising weekly society events for 60 members"],
  ["retail", "Served customers on the till during busy weekend shifts"],
  ["retail", "Served customers on the till during weekend shifts, starting 2024"],
  ["retail", "Customer-facing: served customers on the till during weekend shifts"],
  ["retail", "Served customers on the till during weekend shifts at Northside Market"],
  ["project", "Analysed shop footfall data with pandas to suggest staffing changes"],
  ["project", "2025 project: analysed shop footfall data with pandas to suggest staffing changes"],
  ["project", "Evidence-based staffing changes suggested from shop footfall data analysed with pandas"],
  ["project", "Analysed shop footfall data in Python (pandas) to suggest staffing changes"],
  ["project", "Data-led: analysed shop footfall data with pandas to suggest staffing changes"],
  ["foodbank", "Tracked weekly donations in Microsoft Excel"],
  ["foodbank", "Tracked weekly food bank donations in Excel during 2025"],
  ["foodbank", "Excel-based tracking of weekly donations"],
  ["foodbank", "Tracked weekly donations in Excel‑based records"],
];

export const ADVERSARIAL: [Where, string][] = [
  ["summary", "Xero-literate Economics student at UCL"],
  ["summary", "Economics student at UCL, Xero-literate"],
  ["summary", "Economics student at UCL, Xero-proficient"],
  ["summary", "Economics student at UCL, Xero-experienced"],
  ["summary", "Economics student at UCL, Xero-skilled"],
  ["summary", "Economics student at UCL, Xero-fluent"],
  ["summary", "Economics student at UCL, Xero-ready"],
  ["retail", "Served customers on the till using Xero-based stock records"],
  ["summary", "Economics student at UCL, Alteryx-literate"],
  ["summary", "Economics student at UCL, EViews-literate"],
  ["events", "Organised weekly Zorblax-led society events for 60 members"],
  ["summary", "Zorblax-mentored Economics student at UCL"],
  ["project", "Analysed shop footfall data with pandas for a Zorblax-commissioned study"],
  ["summary", "Zorblax-trained Economics student at UCL"],
  ["summary", "Zorblax-sponsored Economics student at UCL"],
  ["events", "Organised weekly Unilever-led society events for 60 members"],
  ["summary", "Unilever-sponsored Economics student at UCL"],
  ["summary", "Unilever-trained Economics student at UCL"],
  ["summary", "Unilever-backed Economics student at UCL"],
  ["summary", "Mercer-sponsored Economics student at UCL"],
  ["summary", "Mercer-trained Economics student at UCL"],
  ["summary", "Mercer-backed Economics student at UCL"],
  ["summary", "Experian-sponsored Economics student at UCL"],
  ["summary", "Experian-trained Economics student at UCL"],
  ["summary", "Experian-backed Economics student at UCL"],
  ["events", "Organised weekly Ocado-sponsored society events for 60 members"],
  ["summary", "PwC-trained Economics student at UCL"],
  ["summary", "McKinsey-mentored Economics student at UCL"],
  ["summary", "Unilever‑sponsored Economics student at UCL"],
  ["summary", "Unilever–sponsored Economics student at UCL"],
  ["summary", "Unilever sponsored Economics student at UCL"],
  ["summary", "Mercer trained Economics student at UCL"],
  ["events", "Unilever sponsored weekly society events for 60 members"],
  ["summary", "Ex-Deloitte Economics student at UCL"],
  ["foodbank", "Tracked weekly donations in Microsoft Access"],
  ["project", "Analysed shop footfall data with pandas and Apache Spark"],
];

describe("task 22b probe: legitimate rephrasings never block", () => {
  it(`has at least 60 legitimate cases (${LEGIT.length})`, () => { expect(LEGIT.length).toBeGreaterThanOrEqual(60); });
  it.each(LEGIT)("%s: '%s'", (where, text) => {
    const r = run(where, text);
    expect(r.issues.filter((i) => i.severity === "block")).toEqual([]);
    expect(r.verdict).not.toBe("block");
  });
});

describe("task 22b probe: adversarial rephrasings block", () => {
  it.each(ADVERSARIAL)("%s: '%s'", (where, text) => {
    expect(run(where, text).verdict).toBe("block");
  });
});

// ---------- Task 22b fix round 1 ----------

/** Run against a CV variant: `edit` changes the source CV before tailoring; the bullet edit targets the food-bank entry. */
const runCv = (edit: (c: ParsedCV) => void, where: Where, text: string, jd: string[] = []) => {
  const c = structuredClone(cv);
  edit(c);
  const t: TailoredCV = toTailored(c);
  const set = (b: { text: string; changeType?: string }) => Object.assign(b, { text, changeType: "rephrased" });
  if (where === "summary") t.summary = text;
  else if (where === "events") set(t.experience[0].bullets[0]);
  else if (where === "retail") set(t.experience[1].bullets[0]);
  else if (where === "project") set(t.projects[0].bullets[0]);
  else set(t.leadership[0].bullets[0]);
  const srcText = [cvText, ...[...c.experience, ...c.projects, ...c.leadership].flatMap((e) => [e.dates, ...e.bullets.map((b) => b.text)])].join("\n");
  return verifyTailoring({ source: c, sourceText: srcText, confirmedFacts: [], tailored: t, jdKeywords: jd, coverageBefore: 0.3, coverageAfter: 0.5 });
};
const same = () => undefined;

describe("fix round 1 ruling 1: the JD never makes a head ordinary", () => {
  it.each([
    [["xero"], "Economics student at UCL, Xero-literate"],
    [["xero"], "Economics student at UCL, Xero-proficient"],
    [["Xero accounting"], "Economics student at UCL, Xero-literate"],
    [["xero accounting"], "Xero-literate Economics student at UCL"],
    [["XeRo"], "Economics student at UCL, Xero-literate"],
    [["Alteryx workflows"], "Economics student at UCL, Alteryx-literate"],
    [["alteryx"], "Alteryx-literate Economics student at UCL"],
    [["Sage accounting"], "Sage-trained Economics student at UCL"],
    [["sage"], "Economics student at UCL, Sage-trained"],
    [["unilever graduate scheme"], "Unilever-sponsored Economics student at UCL"],
    [["Unilever graduate scheme"], "Economics student at UCL, Unilever-sponsored"],
    [["unilever"], "Unilever sponsored Economics student at UCL"],
    [["unilever"], "Unilever-sponsored Economics student at UCL"],
  ] as [string[], string][])("JD %j: '%s' blocks", (jd, text) => {
    expect(runCv(same, "summary", text, jd).verdict).toBe("block");
  });
});

describe("fix round 1 ruling 2: date-field tokens never stem-launder a head", () => {
  const marCv = (c: ParsedCV) => { c.experience[0].dates = "Mar 2025 – Jun 2025"; };
  it.each(["Mars-sponsored Economics student at UCL", "Economics student at UCL, Mars-sponsored", "Economics student at UCL, Mars-trained",
    "Economics student at UCL, Junes-literate"])("CV dated 'Mar 2025 – Jun 2025': '%s' blocks", (text) => {
    expect(runCv(marCv, "summary", text).verdict).toBe("block");
  });
});

describe("fix round 1 ruling 3: affiliation tails need a list/adverb/domain head, never a bare CV word", () => {
  const bootsCv = (c: ParsedCV) => { c.experience[1].bullets[0].text = "Served customers on the till during weekend shifts, selling boots and next season stock"; };
  it.each(["Boots-sponsored Economics student at UCL", "Boots sponsored Economics student at UCL", "Economics student at UCL, Boots-sponsored",
    "Next-trained Economics student at UCL", "Economics student at UCL, Next-trained", "Next sponsored Economics student at UCL",
    "Economics student at UCL, Boots-funded", "Economics student at UCL, Boots-mentored", "Economics student at UCL, Boots-run"])(
    "CV with lowercase boots/next: '%s' blocks", (text) => {
      expect(runCv(bootsCv, "summary", text).verdict).toBe("block");
    });
  it.each(["Till-trained Economics student at UCL", "Self-funded Economics student at UCL", "Society-trained Economics student at UCL",
    "Quantitatively-trained Economics student at UCL", "Excel-trained Economics student at UCL", "Excel-certified Economics student at UCL",
    "Student-led society events organiser at UCL", "Economics student at UCL, Peer-mentored"])("'%s' still passes", (text) => {
    expect(runCv(bootsCv, "summary", text).verdict).not.toBe("block");
  });
});

describe("fix round 1 ruling 4: a known employer is in the CV only when written as a name", () => {
  const lowerCv = (c: ParsedCV) => {
    c.projects[0].bullets[0].text = "Analysed shop footfall data with pandas and linear regression to suggest staffing changes for apple and shell stock";
    c.leadership[0].bullets[0].text = "Tracked weekly donations in Excel with faculty support, a wise use of time";
  };
  it.each(["Apple-trained Economics student at UCL", "Shell-sponsored Economics student at UCL", "Linear-sponsored Economics student at UCL",
    "Faculty-trained Economics student at UCL", "Wise-sponsored Economics student at UCL", "Economics student at UCL, Shell-sponsored",
    "Economics student at UCL, Apple-trained"])("CV with lowercase apple/shell/linear/faculty/wise: '%s' blocks", (text) => {
    expect(runCv(lowerCv, "summary", text).verdict).toBe("block");
  });
  it("a capitalised employer that is on the CV still passes", () => {
    const shellCv = (c: ParsedCV) => { c.experience[1].org = "Shell"; };
    expect(runCv(shellCv, "summary", "Economics student at UCL with retail experience at Shell").verdict).not.toBe("block");
  });
});

describe("fix round 1 ruling 5: em dash and spaced hyphen compounds", () => {
  it.each(["Unilever—sponsored Economics student at UCL", "Unilever - sponsored Economics student at UCL",
    "Economics student at UCL, Unilever - sponsored", "Economics student at UCL, Mercer—trained", "Economics student at UCL, Xero - literate"])(
    "'%s' blocks", (text) => { expect(runCv(same, "summary", text).verdict).toBe("block"); });
  it.each(["Policy—focused Economics student at UCL", "Economics student at UCL, Evidence - based and numerate",
    "Society - funded events for 60 members, organised weekly"])("'%s' passes", (text) => {
    expect(runCv(same, text.startsWith("Society") ? "events" : "summary", text).verdict).not.toBe("block");
  });
});

// ---------- Task 22b fix round 2 ----------

describe("fix round 2 ruling 1: employer-shaped names opening a sentence block", () => {
  it.each([
    ["summary", "Unilever summer intern 2025; Economics student at UCL"],
    ["project", "Mercer placement project: analysed shop footfall data with pandas to suggest staffing changes"],
    ["retail", "Served customers on the till during weekend shifts. Linklaters trainee programme alumnus"],
    ["summary", "Boeing graduate scheme applicant and Economics student at UCL"],
    ["summary", "Schroders spring week attendee; Economics student at UCL"],
    ["summary", "Prudential insight programme participant; Economics student at UCL"],
    ["summary", "Admiral summer analyst and Economics student at UCL"],
    ["summary", "Gartner work experience; Economics student at UCL"],
    ["summary", "Experian internship 2025; Economics student at UCL"],
    ["summary", "Jupiter graduate associate; Economics student at UCL"],
    ["summary", "Slaughter and May vacation scheme; Economics student at UCL"],
    ["summary", "Economics student at UCL. Brightwater apprenticeship completed"],
    ["summary", "Silverwater Partners graduate scheme; Economics student at UCL"],
    ["events", "Unilever intern; organised weekly society events for 60 members"],
    ["summary", "Economics student at UCL; Unilever placement 2025"],
    ["summary", "Economics student at UCL, Boeing intern"],
  ] as [Where, string][])("%s: '%s' blocks", (where, text) => {
    expect(runCv(same, where, text).verdict).toBe("block");
  });
  const cafeCv = (c: ParsedCV) => { c.experience[1].org = "Northside Café"; };
  it.each([
    ["summary", "Summer intern at Northside Café and Economics student at UCL"],
    ["summary", "Economics Society events officer and UCL student"],
    ["summary", "Graduate scheme applicant; Economics student at UCL"],
    ["summary", "Spring week applicant; Economics student at UCL"],
    ["summary", "Economics graduate (2027) from UCL"],
    ["summary", "Charity volunteer and Economics student at UCL"],
    ["summary", "Events Officer; Economics student at UCL seeking an internship"],
    ["summary", "Aspiring Economist and Economics student at UCL"],
    ["summary", "Economics student at UCL aiming to become an Analyst or Researcher"],
  ] as [Where, string][])("%s: '%s' passes", (where, text) => {
    expect(runCv(cafeCv, where, text).verdict).not.toBe("block");
  });
});

describe("fix round 2 ruling 2: a skills-list tool is not an employer", () => {
  const tools = ["Snowflake", "Figma", "Databricks", "Datadog", "Palantir", "UiPath", "Vercel", "Notion", "Bloomberg"];
  const withTool = (tool: string) => (c: ParsedCV) => { c.skills = [{ group: "Skills", items: ["Excel", "Python", "pandas", tool] }]; };
  const claims = (tool: string) => [`Economics student at UCL, former ${tool} intern`, `${tool}-sponsored Economics student at UCL`,
    `Economics student at UCL who interned at ${tool}`, `Economics student at UCL; ${tool} summer internship`];
  it.each(tools.flatMap((tool) => claims(tool).map((text) => [tool, text])))("skills list has %s: '%s' blocks", (tool, text) => {
    expect(runCv(withTool(tool), "summary", text).verdict).toBe("block");
  });
  it.each(tools)("skills list has %s: a tool-usage claim still passes", (tool) => {
    expect(runCv(withTool(tool), "summary", `Economics student at UCL using ${tool} and Excel`).verdict).not.toBe("block");
  });
  it("an org mention still counts as presence", () => {
    expect(runCv((c) => { c.experience[1].org = "Datadog"; }, "summary", "Economics student at UCL, former Datadog intern").verdict).not.toBe("block");
  });
});

describe("fix round 2 cheap: generic org heads and participles", () => {
  it.each(["Grant-funded", "Committee-led", "Board-approved", "Hospitality-ready", "Shop-run", "Weekend-trained", "Employer-sponsored",
    "Company-sponsored", "Firm-wide", "Trust-funded", "Union-backed", "Manager-approved", "Supervisor-trained", "Shift-based", "Members-only",
    "Donations-led", "Weekly-run"])("'%s' passes at the start and mid-sentence", (c) => {
    expect(runCv(same, "summary", `${c} Economics student at UCL`).verdict).not.toBe("block");
    expect(runCv(same, "summary", `Economics student at UCL, ${c} and numerate`).verdict).not.toBe("block");
  });
  it.each(["Unilever run Economics society events", "Mercer owned Economics student at UCL", "Unilever hired Economics student at UCL",
    "Mercer placed Economics student at UCL", "Experian partnered Economics student at UCL", "Unilever approved Economics student at UCL"])(
    "'%s' blocks", (text) => { expect(runCv(same, "summary", text).verdict).toBe("block"); });
});

// ---------- Task 22b fix round 3 ----------

describe("fix round 3 ruling A: ordinary words before a role noun are not names", () => {
  it.each([
    "Seeking an analyst role; Economics student at UCL",
    "Pursuing an internship in markets; Economics student at UCL",
    "Applying for spring weeks and summer internships; Economics student at UCL",
    "Preparing for summer analyst applications; Economics student at UCL",
    "Developing analyst skills with Python and Excel; Economics student at UCL",
    "Organising an internship programme talk for the Economics Society",
    "Consulting internship applicant; Economics student at UCL",
    "Investment banking summer analyst applicant; Economics student at UCL",
    "Operations analyst applicant; Economics student at UCL",
    "Insurance graduate scheme applicant; Economics student at UCL",
    "Econometrics analyst in training; Economics student at UCL",
    "Prospective summer analyst; Economics student at UCL",
    "Mentoring programme for 60 society members",
    "Networking programme with alumni; Economics student at UCL",
    "Careers programme support for Economics Society members",
    "Policy analyst internship applicant; Economics student at UCL",
    "Trainee analyst applicant with Excel and pandas",
    "Insight programme attendee; Economics student at UCL",
    "Economics student at UCL. Python analyst skills from a 2025 pandas footfall project",
  ])("summary '%s' passes", (text) => {
    const r = runCv(same, "summary", text);
    expect(r.issues.filter((i) => i.severity === "block")).toEqual([]);
  });
});

describe("fix round 3 ruling B: tool use is not an employer claim", () => {
  const toolCv = (c: ParsedCV) => { c.skills = [{ group: "Skills", items: ["Excel", "Python", "pandas", "SQL", "Snowflake", "Figma", "Bloomberg", "Databricks"] }]; };
  it.each([
    "Wrote SQL queries for Snowflake data warehouse; Economics student at UCL",
    "Economics student at UCL who designed event posters for Figma prototypes",
    "Economics student at UCL who compared forecasts with Bloomberg analyst consensus",
    "Economics student at UCL who built pipelines for Databricks notebooks",
    "Bloomberg analyst consensus tracker built in Excel; Economics student at UCL",
  ])("CV skills include the tool: '%s' passes", (text) => {
    expect(runCv(toolCv, "summary", text).issues.filter((i) => i.severity === "block")).toEqual([]);
  });
  const claims = (x: string) => [`Economics student at UCL, former ${x} intern`, `${x}-sponsored Economics student at UCL`,
    `Economics student at UCL who interned at ${x}`, `Economics student at UCL who interned with ${x}`, `Economics student at UCL; ${x}'s summer internship`,
    `Economics student at UCL; ${x}’s summer internship`, `Economics student at UCL; ${x} 2025 internship`, `Economics student at UCL and ${x} employee`,
    `Secured ${x} sponsorship as an Economics student at UCL`];
  it.each(["Snowflake", "Figma", "Bloomberg", "Databricks"].flatMap((x) => claims(x).map((t) => [x, t])))("skills-only %s: '%s' blocks", (_x, text) => {
    expect(runCv(toolCv, "summary", text).verdict).toBe("block");
  });
});

describe("fix round 3 ruling C: punctuation, years and possessives between name and role", () => {
  it.each([
    ["summary", "Prudential, summer intern 2025; Economics student at UCL"],
    ["summary", "Prudential: summer intern 2025; Economics student at UCL"],
    ["summary", "Prudential — summer intern; Economics student at UCL"],
    ["summary", "Prudential 2025 internship; Economics student at UCL"],
    ["summary", "Prudential (2025) internship; Economics student at UCL"],
    ["summary", "Prudential’s graduate scheme; Economics student at UCL"],
    ["summary", "Prudential's graduate scheme; Economics student at UCL"],
    ["summary", "Admiral’s internship 2025; Economics student at UCL"],
    ["summary", "- Prudential summer intern; Economics student at UCL"],
    ["summary", "Economics student at UCL. Admiral – internship 2025"],
  ] as [Where, string][])("%s '%s' blocks", (where, text) => {
    expect(runCv(same, where, text).verdict).toBe("block");
  });
});

// ---------- Task 22b fix round 4 ----------

const r4ToolCv = (c: ParsedCV) => {
  c.skills = [{ group: "Skills", items: ["Excel", "Python", "pandas", "SQL", "Snowflake", "Figma", "Bloomberg", "Tableau", "Salesforce"] }];
};
const R4_TOOLS = ["Bloomberg", "Snowflake", "Figma", "Tableau", "Salesforce"];

describe("fix round 4 ruling 1: the tool-modifier shortcut is only a bare 'analyst'", () => {
  const claims = (x: string) => [
    `${x} graduate scheme; Economics student at UCL`, `Economics student at UCL and ${x} graduate`,
    `${x} insight programme attendee; Economics student at UCL`, `Economics student at UCL; ${x} analyst (2025)`,
    `Economics student at UCL; ${x} analyst since 2025`, `${x} analyst intern; Economics student at UCL`,
    `Economics student at UCL; ${x} associate 2024–2025`, `Economics student at UCL; ${x} analyst programme 2025`,
    `Economics student at UCL; ${x} Analyst, 2025`, `Economics student at UCL and ${x} Associate`,
  ];
  it.each(R4_TOOLS.flatMap((x) => claims(x).map((t) => [x, t])))("skills-only %s: '%s' blocks", (_x, text) => {
    expect(runCv(r4ToolCv, "summary", text).verdict).toBe("block");
  });
  it.each([
    "Python analyst for the Economics Society; Economics student at UCL",
    "Excel analyst for the food bank; Economics student at UCL",
    "Tableau analyst for society events; Economics student at UCL",
    "Economics student at UCL who compared forecasts with Bloomberg analyst consensus",
    "Economics student at UCL using Bloomberg / Excel analyst tools",
  ])("CV skills include the tool: '%s' passes", (text) => {
    expect(runCv(r4ToolCv, "summary", text).issues.filter((i) => i.severity === "block")).toEqual([]);
  });
});

describe("fix round 4 ruling 2: for/with/at a tool after a work word is an employer claim", () => {
  const claims = (x: string) => [
    `Economics student at UCL who worked for ${x}`, `Economics student at UCL who worked for ${x} as a summer analyst`,
    `Economics student at UCL interning for ${x}`, `Economics student at UCL; summer internship for ${x} in 2025`,
    `Economics student at UCL; analyst for ${x}, 2025`, `Economics student at UCL; placement with ${x}`,
  ];
  it.each(R4_TOOLS.flatMap((x) => claims(x).map((t) => [x, t])))("skills-only %s: '%s' blocks", (_x, text) => {
    expect(runCv(r4ToolCv, "summary", text).verdict).toBe("block");
  });
  it.each([
    "Wrote SQL queries for Snowflake data warehouse; Economics student at UCL",
    "Economics student at UCL who designed event posters for Figma prototypes",
    "Economics student at UCL who pulled prices with Bloomberg",
  ])("CV skills include the tool: '%s' passes", (text) => {
    expect(runCv(r4ToolCv, "summary", text).issues.filter((i) => i.severity === "block")).toEqual([]);
  });
});

describe("fix round 4 ruling 3: seasons, years, places, company suffixes and separators between name and role", () => {
  const forms = (x: string) => [
    `${x} summer 2025 internship; Economics student at UCL`, `${x} (Summer 2025) internship; Economics student at UCL`,
    `${x}; summer intern. Economics student at UCL`, `${x} | summer intern. Economics student at UCL`,
    `${x} / summer intern. Economics student at UCL`, `${x} — 2025 — summer intern. Economics student at UCL`,
    `${x}, London summer intern. Economics student at UCL`, `${x} (London) internship; Economics student at UCL`,
    `${x} plc summer intern; Economics student at UCL`,
  ];
  it.each(["Prudential", "Harrowgate"].flatMap((x) => forms(x)))("'%s' blocks", (text) => {
    expect(runCv(same, "summary", text).verdict).toBe("block");
  });
  it.each(["Prudential", "Admiral", "Brightwater", "Harrowgate"])("'%s employee since 2025' blocks", (x) => {
    expect(runCv(same, "summary", `${x} employee since 2025; Economics student at UCL`).verdict).toBe("block");
  });
});

// ---------- Task 22b fix round 5 ----------

const passes = (edit: (c: ParsedCV) => void, where: Where, text: string) =>
  expect(runCv(edit, where, text).issues.filter((i) => i.severity === "block")).toEqual([]);

describe("fix round 5 ruling a: 'with <tool>' is tool use unless an employment word or role/date follows", () => {
  it.each([
    "Economics student at UCL who has worked with Bloomberg data",
    "Economics student at UCL who worked with Bloomberg and Excel",
    "Economics student at UCL experienced working with Bloomberg, Excel and SQL",
    "Economics student at UCL comfortable working with Snowflake and SQL",
    "Economics student at UCL confident working with Tableau and Excel",
    "Economics student at UCL seeking a role working with Tableau and SQL",
    "Economics student at UCL seeking an analyst position working with Bloomberg",
    "Economics student at UCL looking for an internship working with Snowflake",
    "Economics student at UCL keen to work with Tableau and Python",
    "Economics student at UCL aiming for an analyst role with Bloomberg skills",
    "Economics student at UCL and data analyst with Tableau",
    "Economics student at UCL; Excel analyst with Bloomberg experience",
    "Economics student at UCL; analyst with Bloomberg skills",
  ])("CV skills include the tool: '%s' passes", (text) => { passes(r4ToolCv, "summary", text); });
  it.each([
    "Economics student at UCL who worked with Bloomberg as a summer analyst",
    "Economics student at UCL who interned with Bloomberg",
    "Economics student at UCL; placement with Bloomberg",
    "Economics student at UCL who worked with Bloomberg in 2025",
    "Economics student at UCL who worked with Bloomberg since 2025",
    "Economics student at UCL who worked with Bloomberg 2025",
  ])("skills-only tool: '%s' blocks", (text) => { expect(runCv(r4ToolCv, "summary", text).verdict).toBe("block"); });
});

describe("fix round 5 ruling b: unknown capitalised name + capitalised role title", () => {
  it.each([
    "Prudential Analyst; Economics student at UCL", "Admiral Associate; Economics student at UCL", "Harrowgate Analyst; Economics student at UCL",
    "Admiral Analyst, 2025; Economics student at UCL", "Prudential Analyst, London; Economics student at UCL",
    "Economics student at UCL. Brightwater Intern 2025", "Harrowgate Trainee; Economics student at UCL", "Prudential Consultant; Economics student at UCL",
    "Admiral Apprentice; Economics student at UCL",
  ])("'%s' blocks", (text) => { expect(runCv(same, "summary", text).verdict).toBe("block"); });
  it.each([
    "Data Analyst applicant; Economics student at UCL", "Investment Analyst applicant; Economics student at UCL",
    "Policy Analyst applicant; Economics student at UCL", "Junior Analyst applicant; Economics student at UCL",
    "Research Assistant applicant; Economics student at UCL", "Summer Analyst applicant; Economics student at UCL",
    "Equity Research Analyst applicant; Economics student at UCL", "Strategy Consultant applicant; Economics student at UCL",
    "Economics Society Analyst; Economics student at UCL",
  ])("'%s' is not a name claim", (text) => {
    // "Research Assistant" / "Equity Research" are vocab skills, so skillInjection may still flag them; ruling b is about names
    expect(runCv(same, "summary", text).issues.filter((i) => i.severity === "block" && i.type === "unsupportedFacts")).toEqual([]);
  });
});

describe("fix round 5 ruling c: tool + analyst followed by a role, season, month or place is a role", () => {
  const forms = (x: string) => [`Economics student at UCL; ${x} analyst placement`, `Economics student at UCL; ${x} analyst role`,
    `Economics student at UCL; ${x} analyst position`, `Economics student at UCL; ${x} analyst, summer`, `Economics student at UCL; ${x} analyst (summer)`,
    `Economics student at UCL; ${x} analyst, Jun–Aug 2025`, `Economics student at UCL; ${x} Analyst — London`, `Economics student at UCL; ${x} analyst in London`];
  it.each(["Bloomberg", "Tableau"].flatMap((x) => forms(x)))("skills-only tool: '%s' blocks", (text) => {
    expect(runCv(r4ToolCv, "summary", text).verdict).toBe("block");
  });
});

describe("fix round 5 ruling d: more employment words and phrases", () => {
  const forms = (x: string) => [`Economics student at UCL who worked as a consultant for ${x}`, `Economics student at UCL; contractor for ${x}`,
    `Economics student at UCL who consulted for ${x}`, `Economics student at UCL who volunteered for ${x}`, `Economics student at UCL hired by ${x}`,
    `Economics student at UCL employed by ${x}`, `Economics student at UCL with an offer from ${x}`, `Economics student at UCL with a return offer from ${x}`,
    `Economics student at UCL who spent summer 2025 with ${x}`];
  it.each(["Bloomberg", "Snowflake"].flatMap((x) => forms(x)))("skills-only tool: '%s' blocks", (text) => {
    expect(runCv(r4ToolCv, "summary", text).verdict).toBe("block");
  });
  it.each(["Economics student at UCL hired by Prudential", "Economics student at UCL with a return offer from Prudential"])("'%s' blocks", (text) => {
    expect(runCv(same, "summary", text).verdict).toBe("block");
  });
});

describe("fix round 5 ruling e: skills implied by a CV tool are not injected", () => {
  it.each([
    [["Tableau"], "Built Tableau dashboards for Economics Society events"],
    [["Power BI"], "Built Power BI dashboards for Economics Society events"],
    [["Looker"], "Built Looker dashboards for Economics Society events"],
    [["Salesforce"], "Economics student at UCL who logged members in Salesforce CRM"],
    [["HubSpot"], "Economics student at UCL who logged members in HubSpot CRM"],
  ] as [string[], string][])("CV skills %j: '%s' passes", (extra, text) => {
    passes((c) => { c.skills[0].items.push(...extra); }, "summary", text);
  });
  it("without the tool, dashboards are still an injected skill", () => {
    expect(runCv(same, "summary", "Built dashboards for Economics Society events").verdict).toBe("block");
  });
});

// ---------- Task 22c ----------

describe("task 22c ruling 1: 'with <tool>' after a role/season/hiring word, or before a possessive, month, season, place or programme", () => {
  const phrases = (x: string) => [
    `Economics student at UCL; summer analyst with ${x}`, `Summer Analyst with ${x}; Economics student at UCL`,
    `Economics student at UCL; graduate analyst with ${x}`, `Economics student at UCL; insight analyst with ${x}`,
    `Economics student at UCL; work experience with ${x}`, `Economics student at UCL who worked with ${x} over summer 2025`,
    `Economics student at UCL who worked with ${x} during summer 2025`, `Economics student at UCL who worked with ${x}, Jun–Aug 2025`,
    `Economics student at UCL who worked with ${x} (Jun–Aug 2025)`, `Economics student at UCL who worked with ${x} in London`,
    `Economics student at UCL who worked with ${x}'s equities team`, `Economics student at UCL who worked with ${x} as part of its graduate programme`,
    `Economics student at UCL who secured a summer role with ${x}`, `Economics student at UCL who began a role with ${x}`,
    `Economics student at UCL who was offered a position with ${x}`, `Economics student at UCL; spring week with ${x}`,
    `Economics student at UCL; insight week with ${x}`, `Economics student at UCL who spent a summer with ${x}`,
  ];
  it.each(["Bloomberg", "Snowflake", "Tableau"].flatMap((x) => phrases(x)))("skills-only tool: '%s' blocks", (text) => {
    expect(runCv(r4ToolCv, "summary", text).verdict).toBe("block");
  });
  it.each([
    "Economics student at UCL who worked with Bloomberg’s equities team",
    "Economics student at UCL who worked with Bloomberg on its graduate scheme",
    "Economics student at UCL who worked with Bloomberg, summer 2025",
  ])("skills-only tool: '%s' blocks", (text) => { expect(runCv(r4ToolCv, "summary", text).verdict).toBe("block"); });
});

describe("task 22c ruling 2: capitalised multi-word sector titles are not names", () => {
  const TITLES = ["Investment Banking Analyst", "Private Equity Analyst", "Asset Management Analyst", "Credit Risk Analyst", "Corporate Finance Analyst",
    "Wealth Management Associate", "Sustainability Analyst", "Regulatory Analyst", "Payments Analyst", "Risk Analyst", "Economic Policy Analyst"];
  const forms = (t: string) => [`${t} applicant; Economics student at UCL`, `Aspiring ${t}; Economics student at UCL`,
    `Economics student at UCL and Aspiring ${t}`, `Economics student at UCL and Future ${t}`];
  it.each(TITLES.flatMap((t) => forms(t)))("'%s' passes", (text) => { passes(same, "summary", text); });
  it.each([
    "Prudential Analyst; Economics student at UCL", "Admiral Associate; Economics student at UCL", "Harrowgate Analyst; Economics student at UCL",
    "Aspiring Prudential Analyst; Economics student at UCL", "Prudential Investment Banking Analyst; Economics student at UCL",
  ])("'%s' blocks", (text) => { expect(runCv(same, "summary", text).verdict).toBe("block"); });
});

describe("ordinary-word employers at sentence start (2026-10-14 seed additions: Visa, Intel, Sky)", () => {
  const withWords = (c: ParsedCV) => { c.experience[1].bullets[0].text = "Handled visa applications, gathered intel on competitors and met sky-high demand"; };
  const employerBlocks = (r: ReturnType<typeof runCv>) => r.issues.filter((i) => i.check === "knownEmployer").map((i) => i.claim);
  it.each([
    "Visa applications handled for 40 customers each week",
    "Intel on competitors shaped weekly pricing",
    "Sky-high demand met during peak season",
  ])("the CV's own word, capitalised: %s", (text) => {
    expect(employerBlocks(runCv(withWords, "retail", text))).toEqual([]);
  });
  it("still blocks when the CV never had the word", () => {
    expect(employerBlocks(runCv(same, "retail", "Visa applications handled for 40 customers each week"))).toEqual(["Visa"]);
  });
  it("still blocks an affiliation claim", () => {
    expect(employerBlocks(runCv(withWords, "retail", "Handled customers. Interned at Visa in 2025"))).toEqual(["Visa"]);
  });
  it("mid-sentence capitalised name is still an employer", () => {
    expect(employerBlocks(runCv(withWords, "retail", "Handled applications for Visa and Mastercard customers"))).toContain("Visa");
  });
});

describe("ordinary-word exemption never excuses a fabricated employer (review round 2)", () => {
  const applePie = (c: ParsedCV) => { c.experience[1].bullets[0].text = "Sold apple pie at the weekend market"; };
  const blocks = (r: ReturnType<typeof runCv>) => r.issues.filter((i) => i.check === "knownEmployer").map((i) => i.claim);
  it.each([
    "Apple: built an iOS prototype for clients",
    "Apple (2025): built an iOS prototype for clients",
    "Apple, 2025 - built an iOS prototype",
    "Apple engineers mentored me on an iOS prototype",
    "Built a prototype. Apple then adopted it for clients",
  ])("%s", (text) => {
    expect(blocks(runCv(applePie, "retail", text))).toEqual(["Apple"]);
  });
  it("the CV's own phrase is still fine", () => {
    expect(blocks(runCv(applePie, "retail", "Apple pie sales doubled at the weekend market"))).toEqual([]);
  });
});
