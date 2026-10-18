import { describe, it, expect } from "vitest";
import type { ParsedCV } from "@/lib/types";
import type { ScoredRuleResult } from "@/lib/cv-score/context";
import { cosmeticEdit, planDelta, scopeKey, splitSections, unattributedText } from "@/lib/cv-score/delta";
import { prepareJudgeInput } from "@/lib/cv-score/pii";

// Audit 04#9 / #30: "a whitespace-only re-export keeps its score, but a one-character fix re-rolls every verdict".

const cv = (bullet: string, extra: Partial<ParsedCV> = {}): ParsedCV => ({
  name: "Alex Taylor", email: "alex.taylor@example.com", phone: "07700 900456", location: "London", links: [], summary: null,
  education: [{ id: "e0", institution: "University of Westbridge", degree: "BSc Economics", dates: "2024–2027", grade: "68% (2:1)", details: [{ id: "d0", text: "A-levels: Mathematics A*, Economics A, History A" }] }],
  experience: [{ id: "x0", org: "Northgate Bank", title: "Spring Week", dates: "Apr 2025", location: "", bullets: [
    { id: "b0", text: bullet },
    { id: "b1", text: "Built a comparable-companies analysis of 8 UK retailers with a team of 4" },
  ] }],
  projects: [], leadership: [], skills: [{ group: "Technical", items: ["Excel", "PowerPoint"] }], interests: null,
  sectionOrder: ["education", "experience", "skills"], yearGuess: "2nd", archetypes: [], ...extra,
});
const rawOf = (bullet: string, tail = "") => [
  "Alex Taylor", "alex.taylor@example.com | 07700 900456", "EDUCATION", "University of Westbridge — BSc Economics, 2024–2027 68% (2:1)",
  "A-levels: Mathematics A*, Economics A, History A", "EXPERIENCE", "Spring Week, Northgate Bank, Apr 2025", `• ${bullet}`,
  "• Built a comparable-companies analysis of 8 UK retailers with a team of 4", "SKILLS", "Technical: Excel, PowerPoint", tail,
].join("\n");
const input = (bullet: string, tail = "", extra: Partial<ParsedCV> = {}) => prepareJudgeInput(cv(bullet, extra), rawOf(bullet, tail));

const TYPO = "Manged a £3,500 budget across 14 events";
const FIXED = "Managed a £3,500 budget across 14 events";

const r = (ruleId: string, status: ScoredRuleResult["status"], evidenceLine: string | null = null, detail?: string): ScoredRuleResult =>
  ({ ruleId, status, evidenceLine, fix: status === "pass" ? null : "x", ...(detail ? { detail } : {}) });

const prevResults: ScoredRuleResult[] = [
  r("G-33", "pass", "A-levels: Mathematics A*, Economics A, History A"), // EDUCATION
  r("FCQ-06", "pass", "Technical: Excel, PowerPoint"), // SKILLS
  r("G-21", "pass", "Built a comparable-companies analysis of 8 UK retailers with a team of 4"), // entries, quotes the untouched bullet
  r("SWE-08", "pass", TYPO), // entries, quotes the line that was fixed
  r("CON-03", "fail", null, "absent: EXPERIENCE"), // entries, a fail
  r("G-20", "pass", "Built a comparable-companies analysis of 8 UK retailers with a team of 4"), // wording-sensitive
  r("G-13", "pass", "EDUCATION"), // whole-CV rule
  r("G-29", "could_not_assess"),
];
const ids = prevResults.map((x) => x.ruleId);

describe("cosmeticEdit", () => {
  it("accepts a few small spelling fixes and nothing else", () => {
    expect(cosmeticEdit(rawOf(TYPO), rawOf(FIXED))).toBe(true);
    expect(cosmeticEdit("Recieved teh award", "Received the award")).toBe(true);
    expect(cosmeticEdit("same text", "same  text")).toBe(false); // no change at all
    expect(cosmeticEdit("Managed a £2,000 budget", "Managed a £20,000 budget")).toBe(false); // a number is content
    expect(cosmeticEdit("Managed a budget", "Managed a large budget")).toBe(false); // added word
    expect(cosmeticEdit("strong teamwork", "strong team work")).toBe(false);
    expect(cosmeticEdit("Led the team", "Ran the team")).toBe(false); // different word, not a typo
    expect(cosmeticEdit("aa bb cc dd eeee ffff gggg hhhh", "aa bb cc dd eeex fffx gggx hhhx")).toBe(false); // > 3 words
  });
});

describe("evidence scopes", () => {
  it("splits the structured rendering into its sections and finds raw lines the parser didn't place", () => {
    const i = input(FIXED, "AWARDS\nDean's List 2025");
    expect(splitSections(i.structuredText).get("SKILLS")).toContain("Technical: Excel, PowerPoint");
    expect(unattributedText(i)).toContain("Dean's List 2025");
    expect(unattributedText(i)).not.toContain(FIXED);
  });
  it("is whitespace-insensitive", () => {
    const a = input(FIXED), b = { ...a, redactedText: a.redactedText.replace(/ /g, "  ") };
    for (const id of ids) expect(scopeKey(id, a)).toBe(scopeKey(id, b));
  });
});

describe("planDelta", () => {
  it("a one-character typo fix keeps unrelated verdicts and re-judges only what it could affect", () => {
    const plan = planDelta({ ruleIds: ids, prev: input(TYPO), prevResults, next: input(FIXED) });
    expect(plan.cosmetic).toBe(true);
    expect(plan.reuse.map((x) => x.ruleId).sort()).toEqual(["FCQ-06", "G-13", "G-21", "G-33"]);
    expect(plan.rejudge.sort()).toEqual([
      "CON-03", // a fail in the edited section: the fix might add evidence
      "G-20", // about wording
      "G-29", // never assessed
      "SWE-08", // quoted the line that changed
    ]);
  });
  it("a real content edit re-judges every rule on the edited sections and the whole CV, but keeps other sections", () => {
    const next = input(FIXED, "", { experience: [{ ...cv(FIXED).experience[0], bullets: [...cv(FIXED).experience[0].bullets, { id: "b2", text: "Presented to 2 VPs" }] }] });
    const nextRaw = { ...next, redactedText: next.redactedText.replace("SKILLS", "• Presented to 2 VPs\nSKILLS") };
    const plan = planDelta({ ruleIds: ids, prev: input(FIXED), prevResults: prevResults.map((x) => (x.ruleId === "SWE-08" ? { ...x, evidenceLine: FIXED } : x)), next: nextRaw });
    expect(plan.cosmetic).toBe(false);
    expect(plan.reuse.map((x) => x.ruleId).sort()).toEqual(["FCQ-06", "G-33"]);
    expect(plan.rejudge).toEqual(expect.arrayContaining(["G-21", "SWE-08", "G-13"]));
  });
  it("a grade change in Education re-judges the Education rule but keeps the Skills one", () => {
    const changed = (s: string) => s.replace("Economics A,", "Economics B,");
    const prev = input(FIXED);
    const nextBase = prepareJudgeInput(
      { ...cv(FIXED), education: [{ ...cv(FIXED).education[0], details: [{ id: "d0", text: changed("A-levels: Mathematics A*, Economics A, History A") }] }] },
      changed(rawOf(FIXED)),
    );
    const plan = planDelta({ ruleIds: ["G-33", "FCQ-06"], prev, prevResults, next: nextBase });
    expect(plan.reuse.map((x) => x.ruleId)).toEqual(["FCQ-06"]);
    expect(plan.rejudge).toEqual(["G-33"]);
  });
  it("text the parser didn't place in a section invalidates section-scoped verdicts too", () => {
    const plan = planDelta({ ruleIds: ["G-33", "FCQ-06"], prev: input(FIXED), prevResults, next: input(FIXED, "AWARDS\nDean's List 2025") });
    expect(plan.reuse).toEqual([]);
  });
  it("a verdict whose quoted line disappeared is re-judged even if its own section is unchanged", () => {
    const quotesElsewhere = [r("FCQ-06", "pass", TYPO)];
    const plan = planDelta({ ruleIds: ["FCQ-06"], prev: input(TYPO), prevResults: quotesElsewhere, next: input(FIXED) });
    expect(plan.rejudge).toEqual(["FCQ-06"]);
  });
  it("never reuses context presets (skipped for the year, needs a job advert)", () => {
    const presets = [r("G-30", "not_applicable", null, "needs: jd"), r("G-33", "not_applicable", null, "skipped for this year or track")];
    const plan = planDelta({ ruleIds: ["G-30", "G-33"], prev: input(FIXED), prevResults: presets, next: input(FIXED) });
    expect(plan.reuse).toEqual([]);
  });
});
