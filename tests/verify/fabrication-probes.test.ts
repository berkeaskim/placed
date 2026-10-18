/**
 * The tailoring auditor's adversarial probes (audit 2026-10-18, report 05 "Probe method"), rebuilt as a fixture.
 * The synthetic CV: Predicted 2:2; Events Officer with monthly events for 60 members, a £5k paper trading portfolio in
 * a simulated fund, a finalist placing, an estimated-15% proposal and a committee presentation; a Goldman Sachs Spring
 * Insight ("shadowed an analyst"); a Tesco Customer Assistant summer job.
 *
 * Every fabrication must block (only `block` stops a PDF, lib/tailor/render.ts). Every honest rewrite must not.
 * The tally at the end is the "caught / total" the PR reports (before this change: 14 of 48 in the audit).
 */
import { describe, it, expect } from "vitest";
import { verifyTailoring, toTailored } from "@/lib/verify/tailoring";
import type { ParsedCV, TailoredCV } from "@/lib/types";

const NOW = new Date("2026-10-18T12:00:00Z");

const source: ParsedCV = {
  name: "A", email: null, phone: null, location: null, links: [], summary: null,
  education: [{ id: "e0", institution: "UCL", degree: "BSc Economics", dates: "2024–2027", grade: "Predicted 2:2", details: [{ id: "e0-d0", text: "A-levels: A*AB" }] }],
  experience: [
    { id: "x0", org: "Finance Society", title: "Events Officer", dates: "Sep 2025 – Present", location: "", bullets: [
      { id: "x0-b0", text: "Organised monthly society events for 60 members" },
      { id: "x0-b1", text: "Used Python to analyse ticket sales" },
      { id: "x0-b2", text: "Managed a £5k paper trading portfolio in the society's simulated fund" },
      { id: "x0-b3", text: "Shortlisted as finalist in the UCL trading challenge" },
      { id: "x0-b4", text: "Drafted a proposal to cut costs by an estimated 15%" },
      { id: "x0-b5", text: "Presented findings to the society committee" },
    ] },
    { id: "x1", org: "Goldman Sachs", title: "Spring Insight Programme", dates: "Apr 2025", location: "London", bullets: [
      { id: "x1-b0", text: "Attended sessions on markets and shadowed an analyst" },
    ] },
    { id: "x2", org: "Tesco", title: "Customer Assistant", dates: "Jun 2024 – Aug 2024", location: "", bullets: [
      { id: "x2-b0", text: "Served customers in a busy store" },
    ] },
  ],
  projects: [], leadership: [],
  skills: [{ group: "Skills", items: ["Python", "Excel", "SQL (working knowledge)"] }, { group: "Languages", items: ["Spanish (conversational)"] }],
  interests: null, sectionOrder: [], yearGuess: null, archetypes: [],
};
const sourceText = source.experience.flatMap((e) => [e.org, e.title, e.dates, ...e.bullets.map((b) => b.text)]).join("\n") +
  "\nUCL BSc Economics 2024–2027 Predicted 2:2\nA-levels: A*AB\nPython, Excel, SQL (working knowledge)\nSpanish (conversational)";

/** The same CV with a profile, for honest summary edits (a CV without one never gets one: summaryCreated). */
const withSummary: ParsedCV = { ...source, summary: "Economics student at UCL (predicted 2:2) with a Goldman Sachs Spring Insight and conversational Spanish" };

/** Second CV (probe script p4): causal links, purpose clauses, silent drops. */
const p4: ParsedCV = {
  name: "A", email: null, phone: null, location: null, links: [], summary: null,
  education: [{ id: "e0", institution: "UCL", degree: "BSc Economics", dates: "2024–2027", grade: "2:1", details: [] }],
  experience: [{ id: "x0", org: "Finance Society", title: "Events Officer", dates: "Sep 2025 – Present", location: "", bullets: [
    { id: "x0-b0", text: "Organised society events" }, { id: "x0-b1", text: "Membership grew 20% this year" },
    { id: "x0-b2", text: "Trained 3 new staff on the till" }, { id: "x0-b3", text: "Built a Python model to forecast ticket demand" }] }],
  projects: [], leadership: [], skills: [{ group: "Skills", items: ["Python"] }], interests: null, sectionOrder: [], yearGuess: null, archetypes: [],
};
const p4Text = "Organised society events\nMembership grew 20% this year\nTrained 3 new staff on the till\nBuilt a Python model to forecast ticket demand\nPython";

/** `warnOnly`: the report's rule for this class is a warning by design (evaluative adverbs), so it renders with a flag. */
type Probe = { label: string; fabricated: boolean; warnOnly?: boolean; cv?: "base" | "summary" | "p4"; mut: (t: TailoredCV) => void };
const B = (e: number, b: number, text: string) => (t: TailoredCV) => { t.experience[e].bullets[b] = { ...t.experience[e].bullets[b], text, changeType: "rephrased" }; };
const S = (text: string) => (t: TailoredCV) => { t.summary = text; };
const B4 = (b: number, text: string) => (t: TailoredCV) => { t.experience[0].bullets[b] = { id: `x0-b${b}`, text, sourceRefs: [`x0-b${b}`], changeType: "rephrased" }; };

const PROBES: Probe[] = [
  // ---- probe.ts (32) ----
  { label: "summary grade inflation 2:2 -> 2:1", fabricated: true, mut: S("Second-year Economics student at UCL on track for a 2:1") },
  { label: "summary grade inflation -> First-class", fabricated: true, mut: S("First-class Economics student at UCL") },
  { label: "summary predicted dropped (achieved)", fabricated: true, mut: S("Economics student at UCL with a 2:2") },
  { label: "summary magnitude £5k -> £5m", fabricated: true, mut: S("Economics student who managed a £5m trading portfolio") },
  { label: "summary 60 members -> 60% growth", fabricated: true, mut: S("Economics student who grew society events attendance by 60%") },
  { label: "bullet frequency monthly -> weekly", fabricated: true, mut: B(0, 0, "Organised weekly society events for 60 members") },
  { label: "bullet frequency monthly -> daily", fabricated: true, mut: B(0, 0, "Organised daily society events for 60 members") },
  { label: "paper/simulated dropped", fabricated: true, mut: B(0, 2, "Managed a £5k trading portfolio for the society fund") },
  { label: "finalist -> winner", fabricated: true, mut: B(0, 3, "Won the UCL trading challenge") },
  { label: "finalist -> first place", fabricated: true, mut: B(0, 3, "Placed first in the UCL trading challenge") },
  { label: "estimated/proposed -> realised", fabricated: true, mut: B(0, 4, "Cut costs by 15% through a proposal") },
  { label: "drafted -> delivered", fabricated: true, mut: B(0, 4, "Delivered a proposal that cut costs by an estimated 15%") },
  { label: "audience committee -> senior management", fabricated: true, mut: B(0, 5, "Presented findings to senior management") },
  { label: "audience committee -> clients", fabricated: true, mut: B(0, 5, "Presented findings to clients") },
  { label: "spring week -> internship in bullet", fabricated: true, mut: B(1, 0, "Completed a Goldman Sachs internship in markets") },
  { label: "spring week -> summer analyst in summary", fabricated: true, mut: S("Former Goldman Sachs summer analyst studying Economics at UCL") },
  { label: "spring insight -> worked at Goldman (summary)", fabricated: true, mut: S("Economics student who has worked at Goldman Sachs") },
  { label: "shadowed -> supported analyst on live deals", fabricated: true, mut: B(1, 0, "Supported an analyst on live deals in markets") },
  { label: "duration: 2 years experience (summary)", fabricated: true, mut: S("Economics student with 2 years of customer service experience") },
  { label: "language proficiency escalation (skills)", fabricated: true, mut: (t) => { t.skills = [{ group: "Skills", items: ["Python", "Excel", "SQL (working knowledge)"] }, { group: "Languages", items: ["Spanish (fluent)"] }]; } },
  { label: "Python proficiency escalation (skills)", fabricated: true, mut: (t) => { t.skills = [{ group: "Skills", items: ["Advanced Python", "Excel", "SQL (working knowledge)"] }, { group: "Languages", items: ["Spanish (conversational)"] }]; } },
  { label: "analysed -> led analysis", fabricated: true, mut: B(0, 1, "Led the analysis of ticket sales in Python") },
  { label: "scope: busy store -> 30 customers/hour", fabricated: true, mut: B(2, 0, "Served 30 customers an hour in a busy store") },
  { label: "scope: UK's busiest store", fabricated: true, mut: B(2, 0, "Served customers in one of the UK's busiest stores") },
  { label: "A-levels A*AB -> A*A*A (summary)", fabricated: true, mut: S("Economics student at UCL (A-levels A*A*A)") },
  { label: "Python -> R swap", fabricated: true, mut: B(0, 1, "Used R to analyse ticket sales") },
  { label: "Python -> Excel VBA", fabricated: true, mut: B(0, 1, "Used Excel VBA to analyse ticket sales") },
  { label: "date shift in bullet", fabricated: true, mut: B(2, 0, "Served customers in a busy store throughout 2023") },
  { label: "recommendations adopted", fabricated: true, mut: B(0, 5, "Presented recommendations to the society committee, which were adopted") },
  { label: "new 'top 10%'", fabricated: true, mut: B(0, 3, "Finished in the top 10% of the UCL trading challenge") },
  { label: "'primary point of contact'", fabricated: true, mut: B(1, 0, "Acted as the primary point of contact for an analyst on markets") },
  { label: "cross-functional committee", fabricated: true, mut: B(0, 5, "Presented findings to a cross-functional committee") },
  // ---- probe2.ts (19) ----
  { label: "summary fluent Spanish", fabricated: true, mut: S("Economics student at UCL and fluent Spanish speaker") },
  { label: "summary title: Society President", fabricated: true, mut: S("Economics student and Finance Society President") },
  { label: "summary title: Head of Events", fabricated: true, mut: S("Economics student and Head of Events at the Finance Society") },
  { label: "bullet advanced Python", fabricated: true, mut: B(0, 1, "Used advanced Python to analyse ticket sales") },
  { label: "summary proficient in Python and Excel", fabricated: true, mut: S("Economics student proficient in Python and Excel") },
  { label: "reframe customers -> client-facing", fabricated: true, mut: B(2, 0, "Client-facing: served customers in a busy store") },
  { label: "reframe comparable company analysis", fabricated: true, mut: B(0, 1, "Comparable company analysis of ticket sales using Python") },
  { label: "reframe A/B test", fabricated: true, mut: B(0, 4, "Drafted an A/B test proposal to cut costs by an estimated 15%") },
  { label: "reframe stock pitch", fabricated: true, mut: B(0, 5, "Presented a stock pitch to the society committee") },
  { label: "legit: Analysed ticket sales data using Python", fabricated: false, mut: B(0, 1, "Analysed ticket sales data using Python") },
  { label: "legit: Communicated findings", fabricated: false, mut: B(0, 5, "Communicated findings to the society committee") },
  { label: "legit: Handled customer enquiries", fabricated: false, mut: B(2, 0, "Handled customer enquiries in a busy store") },
  { label: "new summary from nothing using JD words", fabricated: true, mut: S("Economics student at UCL with Python and Excel skills, seeking to apply analytical skills in investment banking") },
  { label: "monthly -> regular (vaguer, not a fabrication)", fabricated: false, mut: B(0, 0, "Organised regular society events for 60 members") },
  { label: "60 members -> 60+ members", fabricated: true, mut: B(0, 0, "Organised monthly society events for 60+ members") },
  { label: "£5k -> $5k", fabricated: true, mut: B(0, 2, "Managed a $5k paper trading portfolio in the society's simulated fund") },
  { label: "legit: £5k -> £5,000", fabricated: false, mut: B(0, 2, "Managed a £5,000 paper trading portfolio in the society's simulated fund") },
  { label: "estimated 15% -> 15%", fabricated: true, mut: B(0, 4, "Drafted a proposal to cut costs by 15%") },
  { label: "interests invented", fabricated: true, mut: (t) => { t.interests = "Chess (county champion), marathon running"; } },
  // ---- p4.ts (6) ----
  { label: "merge with invented causality", fabricated: true, cv: "p4", mut: (t) => { t.experience[0].bullets = [{ id: "x0-b0", text: "Organised society events that grew membership 20%", sourceRefs: ["x0-b0", "x0-b1"], changeType: "merged" }, t.experience[0].bullets[2], t.experience[0].bullets[3]]; } },
  { label: "purpose clause added", fabricated: true, cv: "p4", mut: B4(2, "Trained 3 new staff on the till to cut queue times") },
  { label: "forecast -> accurately forecast", fabricated: true, warnOnly: true, cv: "p4", mut: B4(3, "Built a Python model that accurately forecast ticket demand") },
  { label: "model -> deployed model", fabricated: true, cv: "p4", mut: B4(3, "Built and deployed a Python model to forecast ticket demand") },
  { label: "model -> ML model", fabricated: true, cv: "p4", mut: B4(3, "Built a Python machine learning model to forecast ticket demand") },
  { label: "two bullets silently dropped", fabricated: true, cv: "p4", mut: (t) => { t.experience[0].bullets = t.experience[0].bullets.slice(0, 2); } },
];

/** Honest edits from the report's pass anchors: none of these may block. */
const PASS_ANCHORS: Probe[] = [
  { label: "Spring Insight Programme at Goldman Sachs (summary)", fabricated: false, cv: "summary", mut: S("Economics student at UCL (predicted 2:2) with a Spring Insight Programme at Goldman Sachs") },
  { label: "predicted 2:2 restated", fabricated: false, cv: "summary", mut: S("UCL Economics student, predicted 2:2, conversational Spanish") },
  { label: "paper portfolio kept", fabricated: false, mut: B(0, 2, "Managed a £5k paper portfolio in the society's simulated fund") },
  { label: "finalist reordered", fabricated: false, mut: B(0, 3, "UCL trading challenge finalist") },
  { label: "committee kept", fabricated: false, mut: B(0, 5, "Presented findings to the committee") },
  { label: "each month for monthly", fabricated: false, mut: B(0, 0, "Organised society events each month for 60 members") },
  { label: "estimate kept in brackets", fabricated: false, mut: B(0, 4, "Drafted a cost-cutting proposal (estimated 15% saving)") },
  { label: "working knowledge -> intermediate", fabricated: false, mut: (t) => { t.skills = [{ group: "Skills", items: ["Python", "Excel", "SQL (intermediate)"] }, { group: "Languages", items: ["Spanish (conversational)"] }]; } },
  { label: "shadowed kept with insight", fabricated: false, mut: B(1, 0, "Shadowed an analyst and attended sessions on markets") },
  { label: "summer customer service role (summary edit)", fabricated: false, cv: "summary", mut: S("Economics student at UCL (predicted 2:2) with a Goldman Sachs Spring Insight and summer customer service experience") },
  { label: "merge without causality", fabricated: false, cv: "p4", mut: (t) => { t.experience[0].bullets = [{ id: "x0-b0", text: "Organised society events; membership grew 20% this year", sourceRefs: ["x0-b0", "x0-b1"], changeType: "merged" }, t.experience[0].bullets[2], t.experience[0].bullets[3]]; } },
  { label: "one bullet dropped with a reason", fabricated: false, cv: "p4", mut: (t) => { t.experience[0].bullets[2] = { ...t.experience[0].bullets[2], changeType: "dropped", dropReason: "Less relevant" }; } },
];

// verifyTailoring is pure, so each probe's result is computed once and reused by the tally (CI runners are slow)
const verdicts = new Map<Probe, ReturnType<typeof verifyTailoring>>();
function verdict(p: Probe) {
  const hit = verdicts.get(p);
  if (hit) return hit;
  const r = compute(p);
  verdicts.set(p, r);
  return r;
}
function compute(p: Probe) {
  const cv = p.cv === "p4" ? p4 : p.cv === "summary" ? withSummary : source;
  const text = p.cv === "p4" ? p4Text : p.cv === "summary" ? `${sourceText}\n${withSummary.summary}` : sourceText;
  const t = toTailored(cv);
  p.mut(t);
  return verifyTailoring({ source: cv, sourceText: text, confirmedFacts: [], tailored: t, jdKeywords: ["Excel"], coverageBefore: 0.5, coverageAfter: 0.6, now: NOW, claimChecks: true });
}
const show = (r: ReturnType<typeof verdict>) => r.issues.filter((i) => i.type !== "coverage").map((i) => `${i.severity}:${i.check ?? i.type}:${i.claim}`).join(" | ");

describe("05 adversarial probes against verifyTailoring", () => {
  it.each(PROBES.filter((p) => p.fabricated && !p.warnOnly).map((p) => [p.label, p] as const))("blocks: %s", (_l, p) => {
    const r = verdict(p);
    expect(r.verdict, show(r)).toBe("block");
  });
  it.each(PROBES.filter((p) => p.warnOnly).map((p) => [p.label, p] as const))("warns (by design): %s", (_l, p) => {
    expect(verdict(p).verdict).toBe("warn");
  });
  it.each([...PROBES.filter((p) => !p.fabricated), ...PASS_ANCHORS].map((p) => [p.label, p] as const))("does not block: %s", (_l, p) => {
    const r = verdict(p);
    expect(r.verdict, show(r)).not.toBe("block");
  });
  it("tally", () => {
    const fab = PROBES.filter((p) => p.fabricated);
    const caught = fab.filter((p) => verdict(p).verdict === "block").length;
    const honest = [...PROBES.filter((p) => !p.fabricated), ...PASS_ANCHORS];
    const falseBlocks = honest.filter((p) => verdict(p).verdict === "block").length;
    console.log(`fabrication probes caught: ${caught}/${fab.length}; honest edits blocked: ${falseBlocks}/${honest.length}`);
    expect(PROBES.length).toBe(57);
  }, 60_000);
});
