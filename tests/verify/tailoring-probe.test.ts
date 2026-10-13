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
