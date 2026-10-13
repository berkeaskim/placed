import { describe, it, expect } from "vitest";
import { verifyTailoring, revertBlocked, toTailored, gapsStillOpen, buildFactCorpus, type Issue } from "@/lib/verify/tailoring";
import type { ParsedCV, TailoredCV } from "@/lib/types";

const source: ParsedCV = {
  name: "A", email: null, phone: null, location: null, links: [], summary: null,
  education: [{ id: "e0", institution: "UCL", degree: "BSc Economics", dates: "2024–2027", grade: "Predicted 2:1", details: [] }],
  experience: [{ id: "x0", org: "Finance Society", title: "Events Officer", dates: "2025", location: "", bullets: [
    { id: "x0-b0", text: "Organised weekly society events for 60 members" },
    { id: "x0-b1", text: "Used Python to analyse ticket sales" },
  ] }],
  projects: [], leadership: [], skills: [{ group: "Skills", items: ["Python", "Excel"] }], interests: null, sectionOrder: [], yearGuess: null, archetypes: [],
};
const sourceText = "Organised weekly society events for 60 members\nUsed Python to analyse ticket sales\nPython, Excel";
const base = (t: TailoredCV) => ({ source, sourceText, confirmedFacts: [] as string[], tailored: t, jdKeywords: ["stakeholder", "events"], coverageBefore: 0.5, coverageAfter: 0.6 });

function withBullet(text: string, sourceRefs = ["x0-b1"], extra: Partial<TailoredCV> = {}): TailoredCV {
  const t = toTailored(source);
  t.experience[0].bullets[1] = { id: "x0-b1", text, sourceRefs };
  return { ...t, ...extra };
}
const has = (issues: Issue[], type: Issue["type"], severity?: Issue["severity"]) =>
  issues.some((i) => i.type === type && (!severity || i.severity === severity));

describe("verifyTailoring (brief)", () => {
  it("passes an honest reorder/rephrase", () => {
    const t = withBullet("Analysed ticket sales using Python");
    const r = verifyTailoring(base(t));
    expect(r.issues).toEqual([]);
    expect(r.verdict).toBe("pass");
  });
  it("blocks invented metrics, unless the student confirmed them", () => {
    const t = withBullet("Used Python to analyse ticket sales, increasing revenue by 40%");
    const r = verifyTailoring(base(t));
    expect(r.verdict).toBe("block");
    expect(r.issues.find((i) => i.type === "inventedMetrics")!.claim).toBe("40%");
    // one number, one issue: the scoped check does not double-report a globally invented figure
    expect(r.issues.filter((i) => i.type === "inventedMetrics")).toHaveLength(1);
    expect(verifyTailoring({ ...base(t), confirmedFacts: ["Ticket revenue grew 40%"] }).issues.some((i) => i.type === "inventedMetrics")).toBe(false);
  });
  it("blocks used → built authorship escalation", () => {
    const r = verifyTailoring(base(withBullet("Built a Python pipeline to analyse ticket sales")));
    expect(r.issues.some((i) => i.type === "authorshipEscalation" && i.severity === "block")).toBe(true);
  });
  it("blocks injected gap skills in bullets or the skills list", () => {
    const t = withBullet("Used Python and Tableau to analyse ticket sales");
    expect(verifyTailoring(base(t)).issues.find((i) => i.type === "skillInjection")!.claim).toBe("Tableau");
    const t2 = toTailored(source); t2.skills = [{ group: "Skills", items: ["Python", "Excel", "SQL"] }];
    expect(verifyTailoring(base(t2)).verdict).toBe("block");
  });
  it("blocks orphan bullets and forbidden phrases", () => {
    expect(verifyTailoring(base(withBullet("Analysed sales", []))).issues.some((i) => i.type === "orphanBullets")).toBe(true);
    expect(verifyTailoring(base(withBullet("Analysed sales", ["nope"]))).issues.some((i) => i.type === "orphanBullets")).toBe(true);
    expect(verifyTailoring(base(withBullet("Proven track record of analysing ticket sales with Python"))).issues.some((i) => i.type === "forbiddenPhrases" && i.severity === "block")).toBe(true);
  });
  it("blocks changed employers/titles not in the source", () => {
    const t = toTailored(source); t.experience[0] = { ...t.experience[0], title: "Head of Events" };
    expect(verifyTailoring(base(t)).issues.some((i) => i.type === "unsupportedFacts")).toBe(true);
    const t2 = toTailored(source); t2.experience[0] = { ...t2.experience[0], org: "Goldman Sachs" };
    expect(verifyTailoring(base(t2)).verdict).toBe("block");
  });
  // Amendment #1b overrides the brief: a real number moving into a bullet that doesn't cite it is a block, not a warn.
  it("blocks (scoped) when a real number migrates from an uncited bullet", () => {
    const r = verifyTailoring(base(withBullet("Used Python to analyse ticket sales for 60 members")));
    expect(r.verdict).toBe("block");
    const i = r.issues.find((x) => x.type === "inventedMetrics")!;
    expect(i.check).toBe("scopedMetrics");
    expect(i.claim).toContain("60");
  });
  it("warns when coverage did not improve, and never silently passes without coverage numbers", () => {
    expect(verifyTailoring({ ...base(toTailored(source)), coverageAfter: 0.5 }).issues.some((i) => i.type === "coverage")).toBe(true);
    const r = verifyTailoring({ ...base(toTailored(source)), coverageBefore: null, coverageAfter: null });
    expect(r.verdict).toBe("warn");
    expect(has(r.issues, "coverage", "warn")).toBe(true);
  });
  it("reports keywordCoverage with JD keywords still missing from the tailored CV", () => {
    const r = verifyTailoring(base(toTailored(source)));
    expect(r.keywordCoverage).toEqual({ before: 0.5, after: 0.6, missing: ["stakeholder"] });
  });
});

describe("fact corpus soundness (C7)", () => {
  it("never includes ids, archetypes, yearGuess or section order", () => {
    const cv: ParsedCV = { ...source, archetypes: [{ key: "data_analytics", score: 87, why: ["Tableau"] }], yearGuess: "2nd", sectionOrder: ["experience"] };
    const corpus = buildFactCorpus(cv, sourceText, []);
    expect(corpus).not.toMatch(/x0-b0|data_analytics|87|Tableau|2nd/);
    expect(corpus).toContain("Events Officer");
    const t = withBullet("Used Python to analyse ticket sales across 87 events");
    expect(verifyTailoring({ ...base(t), source: cv }).verdict).toBe("block");
  });
  it("'Served 65 customers daily' with no 65 in the CV blocks (inventedMetrics)", () => {
    const t = withBullet("Served 65 customers daily", ["x0-b0"]);
    const r = verifyTailoring(base(t));
    expect(r.verdict).toBe("block");
    expect(r.issues.find((i) => i.type === "inventedMetrics")!.claim).toBe("65");
  });
  it("title 'Lead' blocks even though 'leadership' appears in the CV (whole-token)", () => {
    const cv: ParsedCV = { ...source, interests: "Debating and leadership" };
    const t = toTailored(cv); t.experience[0] = { ...t.experience[0], title: "Lead" };
    const r = verifyTailoring({ ...base(t), source: cv, sourceText: sourceText + "\nDebating and leadership" });
    expect(r.verdict).toBe("block");
    expect(r.issues.find((i) => i.type === "unsupportedFacts")!.claim).toBe("Lead");
  });
  it("phone numbers in the raw text don't license invented metrics", () => {
    const t = withBullet("Used Python to analyse 7700 ticket sales");
    expect(verifyTailoring({ ...base(t), sourceText: sourceText + "\n+44 7700 900123" }).verdict).toBe("block");
  });
});

// ---------- Required fixtures (amendments, 05 §3) ----------

const src2: ParsedCV = {
  name: "B", email: null, phone: null, location: "London", links: [], summary: null,
  education: [{ id: "e0", institution: "UCL", degree: "BSc Computer Science", dates: "2023–2026", grade: "First", details: [] }],
  experience: [{ id: "x1", org: "Tech Society", title: "Committee Member", dates: "Sep 2023 – Jun 2024", location: "London", bullets: [
    { id: "x1-b0", text: "Helped organise 3 society events" },
    { id: "x1-b1", text: "Used Python (pandas) to clean survey data" },
    { id: "x1-b2", text: "Deployed a ticketing API on AWS Lambda" },
    { id: "x1-b3", text: "Built a dashboard with a team of 4" },
    { id: "x1-b4", text: "Increased sign-ups by 20% through an email campaign" },
    { id: "x1-b5", text: "Raised £500 for a charity bake sale" },
    { id: "x1-b6", text: "Mentored 12 first-year students in Python" },
  ] }],
  projects: [{ id: "p0", org: "Personal", title: "Budget App", dates: "2024", location: "", bullets: [{ id: "p0-b0", text: "Wrote a budgeting app in React" }] }],
  leadership: [], skills: [{ group: "Technical", items: ["Python", "Pandas", "AWS", "Azure", "Excel", "React"] }], interests: null,
  sectionOrder: [], yearGuess: null, archetypes: [],
};
const src2Text = [
  ...src2.experience[0].bullets.map((b) => b.text), "Wrote a budgeting app in React", "Python, Pandas, AWS, Azure, Excel, React",
].join("\n");
const fx = (edit: (t: TailoredCV) => void, extra: Partial<Parameters<typeof verifyTailoring>[0]> = {}) => {
  const t = toTailored(src2);
  edit(t);
  return verifyTailoring({ source: src2, sourceText: src2Text, confirmedFacts: [], tailored: t, jdKeywords: ["Python", "data cleaning", "CFA Level I"], coverageBefore: 0.4, coverageAfter: 0.6, ...extra });
};
const setBullet = (t: TailoredCV, i: number, text: string, refs?: string[]) => {
  const b = t.experience[0].bullets[i];
  t.experience[0].bullets[i] = { ...b, text, sourceRefs: refs ?? b.sourceRefs, changeType: "rephrased" };
};

describe("required fixtures (05 §3)", () => {
  it("(a) 'Helped organise' → 'Led' blocks", () => {
    const r = fx((t) => setBullet(t, 0, "Led 3 society events"));
    expect(r.verdict).toBe("block");
    expect(has(r.issues, "authorshipEscalation", "block")).toBe(true);
    expect(has(r.issues, "qualifierDrop", "block")).toBe(true);
  });
  it("(b) 'Used pandas' → 'Built a PyTorch pipeline' blocks", () => {
    const r = fx((t) => setBullet(t, 1, "Built a survey pipeline in PyTorch"));
    expect(r.verdict).toBe("block");
    expect(has(r.issues, "authorshipEscalation", "block")).toBe(true);
    expect(r.issues.find((i) => i.type === "skillInjection")!.claim).toBe("PyTorch");
  });
  it("(c) AWS Lambda → Azure blocks (sibling swap, even though Azure is elsewhere in the CV)", () => {
    const r = fx((t) => setBullet(t, 2, "Deployed a ticketing API on Azure"));
    expect(r.verdict).toBe("block");
    expect(r.issues.find((i) => i.type === "siblingContamination")!.claim).toBe("Azure");
    expect(has(r.issues, "skillInjection")).toBe(false);
  });
  it("(c') AWS Lambda → Azure Functions blocks", () => {
    expect(fx((t) => setBullet(t, 2, "Deployed a ticketing API on Azure Functions")).verdict).toBe("block");
  });
  it("(d) dropping 'team of 4' blocks", () => {
    const r = fx((t) => setBullet(t, 3, "Built a dashboard for the society"));
    expect(r.verdict).toBe("block");
    expect(has(r.issues, "qualifierDrop", "block")).toBe(true);
  });
  it("(e) 20% → 25% blocks", () => {
    const r = fx((t) => setBullet(t, 4, "Increased sign-ups by 25% through an email campaign"));
    expect(r.verdict).toBe("block");
    expect(r.issues.find((i) => i.type === "inventedMetrics")!.claim).toBe("25%");
  });
  it("(f) a number moved across two cited refs blocks", () => {
    const r = fx((t) => {
      t.experience[0].bullets[6] = { id: "x1-m0", text: "Mentored 500 first-year students in Python", sourceRefs: ["x1-b5", "x1-b6"], changeType: "merged" };
      t.experience[0].bullets.splice(5, 1);
    });
    expect(r.verdict).toBe("block");
    const i = r.issues.find((x) => x.type === "inventedMetrics")!;
    expect(i.check).toBe("scopedMetrics");
    expect(i.claim).toContain("500");
  });
  it("(g) a pure reorder plus a JD synonym already in the CV passes", () => {
    const r = fx((t) => {
      t.experience[0].bullets.reverse();
      const i = t.experience[0].bullets.findIndex((b) => b.id === "x1-b1");
      setBullet(t, i, "Cleaned survey data using Python (pandas)");
    });
    expect(r.issues).toEqual([]);
    expect(r.verdict).toBe("pass");
  });
  it("(h) the JD trap 'CFA Level I' shows up only in gapsStillOpen", () => {
    const r = fx(() => {});
    expect(r.verdict).toBe("pass");
    expect(JSON.stringify(r.issues)).not.toContain("CFA");
    const gaps = gapsStillOpen({ source: src2, sourceText: src2Text, confirmedFacts: [], jdKeywords: ["Python", "data cleaning", "CFA Level I"] });
    expect(gaps).toEqual(["data cleaning", "CFA Level I"]);
    expect(gaps).not.toContain("Python");
  });
});

describe("the JD is never a fact source", () => {
  it("a skill present only in the JD and added to the tailored CV blocks", () => {
    const r = fx((t) => setBullet(t, 1, "Used Python (pandas) and Tableau to clean survey data"), { jdKeywords: ["Tableau"] });
    expect(r.issues.find((i) => i.type === "skillInjection")!.claim).toBe("Tableau");
  });
  it("a JD credential smuggled into the summary blocks", () => {
    const r = fx((t) => { t.summary = "Computer science student working towards CFA Level I"; });
    expect(r.verdict).toBe("block");
    expect(r.issues.find((i) => i.type === "skillInjection")!.claim).toBe("CFA Level I");
  });
  it("gapsStillOpen ignores the tailored CV: a gap stays open even if tailoring wrote it in", () => {
    expect(gapsStillOpen({ source: src2, sourceText: src2Text, confirmedFacts: [], jdKeywords: ["Tableau"] })).toEqual(["Tableau"]);
    expect(gapsStillOpen({ source: src2, sourceText: src2Text, confirmedFacts: ["I passed CFA Level I in 2025"], jdKeywords: ["CFA Level I"] })).toEqual([]);
  });
});

describe("other checks", () => {
  it("blocks a bullet that cites a bullet from a different role", () => {
    const r = fx((t) => setBullet(t, 0, "Wrote a budgeting app in React", ["p0-b0"]));
    expect(has(r.issues, "orphanBullets", "block")).toBe(true);
  });
  it("blocks a merged bullet with a single ref", () => {
    const r = fx((t) => { t.experience[0].bullets[0] = { ...t.experience[0].bullets[0], changeType: "merged" }; });
    expect(has(r.issues, "orphanBullets", "block")).toBe(true);
  });
  it("blocks an unknown proper noun or acronym (tool/employer) that isn't in the CV", () => {
    const r = fx((t) => setBullet(t, 1, "Used Python (pandas) to clean survey data for Deloitte"));
    expect(r.issues.find((i) => i.type === "unsupportedFacts")!.claim).toBe("Deloitte");
  });
  it("blocks changed education or dates", () => {
    expect(fx((t) => { t.education = [{ ...t.education[0], grade: "First Class Honours (1st)" }]; }).verdict).toBe("block");
    expect(fx((t) => { t.experience[0] = { ...t.experience[0], dates: "Sep 2022 – Jun 2024" }; }).verdict).toBe("block");
  });
  it("warns on generic phrases and cliché-dense output", () => {
    const r = fx((t) => { t.summary = "Passionate about data, a results-driven and detail-oriented team player in a fast-paced environment"; });
    expect(r.verdict).toBe("warn");
    expect(has(r.issues, "forbiddenPhrases", "warn")).toBe(true);
    expect(has(r.issues, "clicheDensity", "warn")).toBe(true);
  });
  it("forbidden phrase already in the source bullet is a warn (reverting can't remove it)", () => {
    const cv: ParsedCV = { ...source, experience: [{ ...source.experience[0], bullets: [{ id: "x0-b0", text: "Proven track record of running events" }] }] };
    const r = verifyTailoring({ ...base(toTailored(cv)), source: cv, sourceText: "Proven track record of running events" });
    expect(has(r.issues, "forbiddenPhrases", "block")).toBe(false);
    expect(has(r.issues, "forbiddenPhrases", "warn")).toBe(true);
  });
  it("blocks a mid-sentence authorship escalation the lead-verb check can't see", () => {
    const r = fx((t) => setBullet(t, 1, "Used Python (pandas) and founded a survey data team"));
    expect(has(r.issues, "authorshipEscalation", "block")).toBe(true);
  });
  it("warns on heavy drift (many new content words)", () => {
    const r = fx((t) => setBullet(t, 1, "Used Python (pandas) to clean survey data, reconciling duplicate respondents, normalising timestamps, flagging outliers"));
    expect(has(r.issues, "perBulletDrift", "warn")).toBe(true);
  });
  it("structural loss (a bullet silently disappears) warns", () => {
    const r = fx((t) => { t.experience[0].bullets.splice(6, 1); });
    expect(r.verdict).toBe("warn");
    expect(has(r.issues, "structuralLoss", "warn")).toBe(true);
  });
  it("an explicitly dropped bullet is not checked and not rendered as a loss", () => {
    const r = fx((t) => { t.experience[0].bullets[6] = { ...t.experience[0].bullets[6], text: "Led 900 people", changeType: "dropped", dropReason: "not relevant" }; });
    expect(r.verdict).toBe("pass");
  });
});

describe("revertBlocked", () => {
  it("restores offending bullets to the original text and removes injected skills", () => {
    const t = withBullet("Built a Tableau dashboard to analyse ticket sales");
    t.skills = [{ group: "Skills", items: ["Python", "Excel", "Tableau"] }];
    const r = verifyTailoring(base(t));
    const { tailored, reverted, removedSkills } = revertBlocked(t, source, r.issues);
    expect(tailored.experience[0].bullets[1].text).toBe("Used Python to analyse ticket sales");
    expect(tailored.skills[0].items).not.toContain("Tableau");
    expect(removedSkills).toContain("Tableau");
    expect(reverted.map((x) => x.bulletId)).toContain("x0-b1");
    expect(verifyTailoring(base(tailored)).verdict).not.toBe("block");
  });
  it("splits a blocked merged bullet back into its original bullets and restores headers", () => {
    const t = toTailored(src2);
    t.experience[0].bullets[6] = { id: "x1-m0", text: "Mentored 500 first-year students in Python", sourceRefs: ["x1-b5", "x1-b6"], changeType: "merged" };
    t.experience[0].bullets.splice(5, 1);
    t.experience[0].title = "Head of Mentoring";
    t.summary = "Aspiring analyst working towards CFA Level I";
    const input = { source: src2, sourceText: src2Text, confirmedFacts: [], tailored: t, jdKeywords: ["CFA Level I"], coverageBefore: 0.4, coverageAfter: 0.6 };
    const r = verifyTailoring(input);
    expect(r.verdict).toBe("block");
    const out = revertBlocked(t, src2, r.issues);
    const texts = out.tailored.experience[0].bullets.map((b) => b.text);
    expect(texts).toContain("Raised £500 for a charity bake sale");
    expect(texts).toContain("Mentored 12 first-year students in Python");
    expect(out.tailored.experience[0].title).toBe("Committee Member");
    expect(out.tailored.summary).toBeNull();
    expect(out.reverted.map((x) => x.bulletId)).toEqual(expect.arrayContaining(["x1-m0", "summary"]));
    expect(verifyTailoring({ ...input, tailored: out.tailored }).verdict).not.toBe("block");
  });
  it("drops orphan bullets entirely", () => {
    const t = withBullet("Analysed sales", []);
    const out = revertBlocked(t, source, verifyTailoring(base(t)).issues);
    expect(out.tailored.experience[0].bullets.map((b) => b.id)).toEqual(["x0-b0"]);
    expect(out.reverted[0].bulletId).toBe("x0-b1");
  });
});
