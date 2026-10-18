import { describe, it, expect } from "vitest";
import { verifyTailoring, revertBlocked, toTailored, gapsStillOpen, buildFactCorpus, type Issue } from "@/lib/verify/tailoring";
import type { ParsedCV, TailoredCV } from "@/lib/types";

const source: ParsedCV = {
  name: "A", email: null, phone: null, location: null, links: [], summary: "Economics student at UCL",
  education: [{ id: "e0", institution: "UCL", degree: "BSc Economics", dates: "2024–2027", grade: "Predicted 2:1", details: [] }],
  experience: [{ id: "x0", org: "Finance Society", title: "Events Officer", dates: "2025", location: "", bullets: [
    { id: "x0-b0", text: "Organised weekly society events for 60 members" },
    { id: "x0-b1", text: "Used Python to analyse ticket sales" },
  ] }],
  projects: [], leadership: [], skills: [{ group: "Skills", items: ["Python", "Excel"] }], interests: null, sectionOrder: [], yearGuess: null, archetypes: [],
};
const sourceText = "Organised weekly society events for 60 members\nUsed Python to analyse ticket sales\nPython, Excel";
const base = (t: TailoredCV) => ({ source, sourceText, confirmedFacts: [] as string[], tailored: t, jdKeywords: ["stakeholder", "events"], coverageBefore: 0.5, coverageAfter: 0.6, claimChecks: true });

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
  it("does not read an everyday phrase as a skill: 'data collection' is not Experimental Design", () => {
    const src: ParsedCV = { ...source, experience: [{ ...source.experience[0], bullets: [
      source.experience[0].bullets[0], { id: "x0-b1", text: "Ran the collection script weekly on AWS" },
    ] }] };
    const t = toTailored(src);
    t.experience[0].bullets[1] = { id: "x0-b1", text: "Ran the data collection script weekly on AWS", sourceRefs: ["x0-b1"] };
    const r = verifyTailoring({ ...base(t), source: src, sourceText: "Organised weekly society events for 60 members\nRan the collection script weekly on AWS\nPython, Excel" });
    expect(has(r.issues, "skillInjection")).toBe(false);
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
  name: "B", email: null, phone: null, location: "London", links: [], summary: "Computer Science student at UCL",
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
  return verifyTailoring({ source: src2, sourceText: src2Text, confirmedFacts: [], tailored: t, jdKeywords: ["Python", "data cleaning", "CFA Level I"], coverageBefore: 0.4, coverageAfter: 0.6, claimChecks: true, ...extra });
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
    expect(out.tailored.summary).toBe(src2.summary); // reverted to the CV's own profile
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

// ---------- Fix round 1 (adversarial review) ----------

const blocksWith = (r: ReturnType<typeof verifyTailoring>, type: Issue["type"]) => r.verdict === "block" && has(r.issues, type, "block");

describe("fix 1: word and multiplier metrics", () => {
  it.each([
    [4, "Tripled sign-ups through an email campaign"],
    [4, "Doubled sign-ups through an email campaign"],
    [4, "Halved churn through an email campaign"],
    [4, "Increased sign-ups 3-fold through an email campaign"],
    [0, "Helped organise a dozen society events"],
    [0, "Helped organise dozens of society events"],
    [6, "Mentored hundreds of first-year students in Python"],
    [6, "Mentored scores of first-year students in Python"],
    [4, "Increased sign-ups by a quarter through an email campaign"],
    [4, "Increased sign-ups by twenty-five percent through an email campaign"],
    [6, "Mentored thirty first-year students in Python"],
  ])("blocks bullet %i → %s", (i, text) => {
    expect(blocksWith(fx((t) => setBullet(t, i as number, text as string)), "inventedMetrics")).toBe(true);
  });
  it("word ↔ digit equivalence passes", () => {
    expect(fx((t) => setBullet(t, 6, "Mentored twelve first-year students in Python")).verdict).toBe("pass");
    expect(fx((t) => setBullet(t, 0, "Helped organise three society events")).verdict).toBe("pass");
  });
  it("a confirmed multiplier passes", () => {
    const r = fx((t) => setBullet(t, 4, "Doubled sign-ups through an email campaign"), { confirmedFacts: ["Sign-ups doubled after the email campaign"] });
    expect(has(r.issues, "inventedMetrics")).toBe(false);
  });
  it("'half' ≡ 50% and 'a dozen' ≡ 12 when the source says so", () => {
    const cv: ParsedCV = { ...source, experience: [{ ...source.experience[0], bullets: [
      { id: "x0-b0", text: "Cut queue times by 50% at society events" }, { id: "x0-b1", text: "Ran 12 workshops for members" }] }] };
    const t = toTailored(cv);
    t.experience[0].bullets[0] = { id: "x0-b0", text: "Cut queue times by half at society events", sourceRefs: ["x0-b0"] };
    t.experience[0].bullets[1] = { id: "x0-b1", text: "Ran a dozen workshops for members", sourceRefs: ["x0-b1"] };
    const r = verifyTailoring({ ...base(t), source: cv, sourceText: "" });
    expect(has(r.issues, "inventedMetrics")).toBe(false);
  });
});

describe("fix 2: employers in any case or position", () => {
  it.each([
    "Used Python (pandas) to clean survey data for deloitte",
    "Used Python (pandas) to clean survey data for goldman sachs",
    "Used Python (pandas) to clean survey data for JP Morgan",
  ])("blocks %s", (text) => {
    expect(blocksWith(fx((t) => setBullet(t, 1, text)), "unsupportedFacts")).toBe(true);
  });
  it.each(["former google intern", "Ex-Deloitte student", "Deloitte intern with a passion for data", "Zorblax analyst and student"])("blocks summary %s", (s) => {
    expect(blocksWith(fx((t) => { t.summary = s; }), "unsupportedFacts")).toBe(true);
  });
  it("interests go through the same checks", () => {
    expect(blocksWith(fx((t) => { t.interests = "Shadowed traders at citadel"; }), "unsupportedFacts")).toBe(true);
  });
  it("revertBlocked strips 'Ex-Deloitte' from the summary and re-verify doesn't block", () => {
    const t = toTailored(src2); t.summary = "Ex-Deloitte student";
    const input = { source: src2, sourceText: src2Text, confirmedFacts: [], tailored: t, jdKeywords: [], coverageBefore: 0.4, coverageAfter: 0.6 };
    const out = revertBlocked(t, src2, verifyTailoring(input).issues);
    expect(out.tailored.summary).toBe(src2.summary); // reverted to the CV's own profile
    expect(verifyTailoring({ ...input, tailored: out.tailored }).verdict).not.toBe("block");
  });
  it("ordinary sentence-initial words don't block", () => {
    const r = fx((t) => { t.summary = "Motivated computer science student. Interested in data."; });
    expect(has(r.issues, "unsupportedFacts")).toBe(false);
  });
  it("seed companies are all in the known-employers list", async () => {
    const { readFileSync } = await import("node:fs");
    const { KNOWN_EMPLOYERS } = await import("@/lib/verify/tailoring");
    const names = [...readFileSync("seed/companies.yml", "utf8").matchAll(/name: ("[^"]+"|[^,}]+)/g)].map((m) => m[1].replace(/"/g, "").trim());
    names.push(...[...readFileSync("seed/programmes.yml", "utf8").matchAll(/^ {2}name: (.+)$/gm)].map((m) => m[1].trim()));
    const known = new Set(KNOWN_EMPLOYERS.map((k) => k.name.toLowerCase()));
    expect(names.filter((n) => !known.has(n.toLowerCase()))).toEqual([]);
  });
});

describe("fix 3: tailoring never creates entries", () => {
  it("blocks an entry id that isn't in the source, even with real org/title, and revert removes it", () => {
    const t = toTailored(src2);
    t.experience.push({ ...t.experience[0], id: "x9", bullets: [] });
    const input = { source: src2, sourceText: src2Text, confirmedFacts: [], tailored: t, jdKeywords: [], coverageBefore: 0.4, coverageAfter: 0.6 };
    const r = verifyTailoring(input);
    expect(blocksWith(r, "unsupportedFacts")).toBe(true);
    const out = revertBlocked(t, src2, r.issues);
    expect(out.tailored.experience.map((e) => e.id)).toEqual(["x1"]);
    expect(verifyTailoring({ ...input, tailored: out.tailored }).verdict).not.toBe("block");
  });
});

describe("fix 4: non-verb ownership escalation", () => {
  it.each([
    [1, "Took ownership of cleaning survey data in Python (pandas)"],
    [1, "Responsible for survey data cleaning end to end using Python (pandas)"],
    [5, "Sole organiser of a charity bake sale, raising £500"],
    [5, "Raised £500 as event lead for a charity bake sale"],
    [5, "Single-handedly raised £500 for a charity bake sale"],
  ])("blocks bullet %i → %s", (i, text) => {
    expect(blocksWith(fx((t) => setBullet(t, i as number, text as string)), "authorshipEscalation")).toBe(true);
  });
  it("blocks 'as sole developer' on a project", () => {
    const r = fx((t) => { t.projects[0].bullets[0] = { ...t.projects[0].bullets[0], text: "Wrote a budgeting app in React as sole developer", changeType: "rephrased" }; });
    expect(blocksWith(r, "authorshipEscalation")).toBe(true);
  });
});

describe("fix 5: summary numbers are scoped", () => {
  it("blocks a summary number borrowed from an unrelated bullet", () => {
    expect(blocksWith(fx((t) => { t.summary = "Computer science student who mentored 500 students"; }), "inventedMetrics")).toBe(true);
  });
  it("allows a summary number that co-occurs with its context", () => {
    expect(has(fx((t) => { t.summary = "Student who mentored 12 first-year students"; }).issues, "inventedMetrics")).toBe(false);
  });
});

describe("fix 6: years are not counts", () => {
  it("blocks a number that only appears in date fields", () => {
    expect(blocksWith(fx((t) => setBullet(t, 6, "Mentored 2026 first-year students in Python")), "inventedMetrics")).toBe(true);
  });
});

describe("fix 7: no false blocks", () => {
  it("'CS' for Computer Science", () => {
    expect(has(fx((t) => { t.summary = "CS student at UCL"; }).issues, "unsupportedFacts")).toBe(false);
  });
  it.each(["Raised 500 GBP for a charity bake sale", "Raised 500 pounds for a charity bake sale"])("currency spelling: %s", (text) => {
    expect(fx((t) => setBullet(t, 5, text)).verdict).not.toBe("block");
  });
  it("'Sep 2023' ↔ 'September 2023'", () => {
    expect(fx((t) => { t.experience[0] = { ...t.experience[0], dates: "September 2023 – June 2024" }; }).verdict).toBe("pass");
  });
  it("'Survey Monkey' ↔ 'SurveyMonkey'", () => {
    const facts = { confirmedFacts: ["Ran the society survey on SurveyMonkey"] };
    expect(has(fx((t) => setBullet(t, 1, "Used Python (pandas) to clean Survey Monkey data"), facts).issues, "unsupportedFacts")).toBe(false);
    const facts2 = { confirmedFacts: ["Ran the society survey on Survey Monkey"] };
    expect(has(fx((t) => setBullet(t, 1, "Used Python (pandas) to clean SurveyMonkey data"), facts2).issues, "unsupportedFacts")).toBe(false);
  });
});

// audit 05 #20: a currency swap and "N → N+" change a fact, so they block now (they were warnings)
describe("fix 8 → 05 #20: currency swaps and inflation qualifiers block", () => {
  it.each([
    [5, "Raised $500 for a charity bake sale", "currencySwap"],
    [6, "Mentored over 12 first-year students in Python", "inflationQualifier"],
    [6, "Mentored 12+ first-year students in Python", "inflationQualifier"],
    [6, "Mentored more than 12 first-year students in Python", "inflationQualifier"],
  ])("blocks bullet %i → %s", (i, text, check) => {
    const r = fx((t) => setBullet(t, i as number, text as string));
    expect(r.verdict).toBe("block");
    expect(r.issues.some((x) => x.check === check && x.severity === "block")).toBe(true);
  });
});

describe("fix 8: warn-level drift", () => {
  it.each([
    [4, "Award-winning email campaign increased sign-ups by 20%"],
    [5, "Raised £500 for a charity bake sale, winning first place"],
  ])("warns on bullet %i → %s", (i, text) => {
    const r = fx((t) => setBullet(t, i as number, text as string));
    expect(r.verdict).toBe("warn");
    expect(has(r.issues, "perBulletDrift", "warn")).toBe(true);
  });
});

// ---------- Fix round 2 (false blocks from round 1) ----------

describe("fix round 2 N1: ordinary sentence openers are not names", () => {
  const openers = ["Dealt", "Taught", "Made", "Kept", "Met", "Grew", "Cut", "Held", "Set", "Took", "Sold", "Brought", "Found", "Gave", "Became",
    "Spoke", "Drew", "Began", "Chose", "Did", "Got", "Lent", "Left", "Paid", "Put", "Read", "Sent", "Spent", "Stood", "Told", "Thought",
    "Understood", "Went", "Undertook", "Hands-on", "Detail-focused", "Fast-paced", "Self-motivated", "High-pressure", "Multi-tasking", "Tech-savvy",
    "Results-focused", "Adept", "Calm", "Versatile", "Thorough", "Quick", "Diligent", "Organised", "Proactive", "Analytical", "Curious", "Reliable",
    "Motivated", "Passionate", "Enthusiastic"];
  it.each(openers)("'%s' at the start of a bullet or summary is not an unsupported fact", (o) => {
    expect(has(fx((t) => setBullet(t, 1, `${o} survey data work in Python (pandas)`)).issues, "unsupportedFacts")).toBe(false);
    expect(has(fx((t) => { t.summary = `${o} computer science student`; }).issues, "unsupportedFacts")).toBe(false);
  });
  it("sentence-start 'Won' is an achievement warn, like mid-sentence 'won'", () => {
    const r = fx((t) => setBullet(t, 1, "Won a prize for survey data work in Python (pandas)"));
    expect(has(r.issues, "unsupportedFacts")).toBe(false);
    expect(r.issues.some((i) => i.check === "newAchievement" && i.severity === "warn")).toBe(true);
    expect(r.verdict).toBe("warn");
  });
  it.each(["Deloitte-trained analyst cleaning survey data in Python (pandas)", "Ex-Deloitte analyst cleaning survey data in Python (pandas)"])("still blocks %s", (text) => {
    expect(blocksWith(fx((t) => setBullet(t, 1, text)), "unsupportedFacts")).toBe(true);
  });
});

describe("fix round 2 N2: the CV's own years used as years", () => {
  it.each([
    "Computer science student graduating in 2026",
    "Class of 2026 computer science student",
    "Computer science student at UCL (2023–2026)",
    "Computer science student at UCL since 2023",
    "Joined the Tech Society committee in 2023",
    "Tech Society committee member (2023)",
    "Tech Society committee member from September 2023",
    "Computer science student, expected 2026",
  ])("summary '%s' passes", (s) => {
    const r = fx((t) => { t.summary = s; });
    expect(has(r.issues, "inventedMetrics")).toBe(false);
    expect(r.verdict).not.toBe("block");
  });
  it("a bullet may say when it happened", () => {
    expect(fx((t) => setBullet(t, 0, "Helped organise 3 society events in 2023")).verdict).toBe("pass");
    expect(fx((t) => setBullet(t, 0, "Helped organise 3 society events (2023–2024)")).verdict).not.toBe("block");
  });
  it.each(["Helped organise 3 society events for 2024 users", "Mentored 2026 first-year students in Python"])("still blocks a year used as a count: %s", (text) => {
    const i = text.startsWith("Mentored") ? 6 : 0;
    expect(blocksWith(fx((t) => setBullet(t, i, text)), "inventedMetrics")).toBe(true);
  });
  it("a year that isn't in any date field still blocks", () => {
    expect(blocksWith(fx((t) => { t.summary = "Computer science student graduating in 2029"; }), "inventedMetrics")).toBe(true);
  });
});

describe("fix round 2: multi-word numbers report once", () => {
  it("'twenty five' is one issue", () => {
    const r = fx((t) => setBullet(t, 6, "Mentored twenty five first-year students in Python"));
    expect(r.issues.filter((i) => i.type === "inventedMetrics")).toHaveLength(1);
  });
});

// ---------- Fix round 3 (Economics fixture) ----------

const econ: ParsedCV = {
  name: "C", email: null, phone: null, location: "London", links: [], summary: "Economics student at UCL",
  education: [{ id: "e0", institution: "UCL", degree: "BSc Economics", dates: "2024–2027", grade: "Predicted 2:1", details: [] }],
  experience: [
    { id: "x2", org: "Economics Society", title: "Events Officer", dates: "Sep 2025 – Jun 2026", location: "London", bullets: [
      { id: "x2-b0", text: "Organised weekly society events for 60 members" },
      { id: "x2-b1", text: "Secured £1,200 in sponsorship from 3 local firms" },
    ] },
    { id: "x3", org: "Corner Café", title: "Barista", dates: "Jun 2024 – Aug 2025", location: "London", bullets: [
      { id: "x3-b0", text: "Served customers during busy weekend shifts" },
      { id: "x3-b1", text: "Trained 2 new starters on the till" },
    ] },
  ],
  projects: [], leadership: [], skills: [{ group: "Skills", items: ["Excel", "Stata"] }], interests: null, sectionOrder: [], yearGuess: null, archetypes: [],
};
const econText = "UCL BSc Economics 2024–2027 Predicted 2:1\nEconomics Society Events Officer Sep 2025 – Jun 2026\nOrganised weekly society events for 60 members\n" +
  "Secured £1,200 in sponsorship from 3 local firms\nCorner Café Barista Jun 2024 – Aug 2025\nServed customers during busy weekend shifts\nTrained 2 new starters on the till\nExcel, Stata";
const ex = (edit: (t: TailoredCV) => void) => {
  const t = toTailored(econ);
  edit(t);
  return verifyTailoring({ source: econ, sourceText: econText, confirmedFacts: [], tailored: t, jdKeywords: ["Excel", "stakeholder"], coverageBefore: 0.3, coverageAfter: 0.5 });
};
const econBullet = (text: string) => (t: TailoredCV) => { t.experience[0].bullets[0] = { ...t.experience[0].bullets[0], text, changeType: "rephrased" }; };

describe("fix round 3 #1: the CV's own years, Economics fixture", () => {
  it.each([
    "Class of 2027 Economics student at UCL",
    "2024–2027 Economics student at UCL",
    "Class of 2027 student at UCL",
    "In 2025 Economics Society events: organised weekly society events for 60 members",
    "Economics student at UCL, Class of 2027, with event experience",
    "Events Officer at the Economics Society from 2025 to 2026",
    "Economics student since 2024 with members of the Economics Society",
  ])("summary '%s' doesn't block", (s) => {
    const r = ex((t) => { t.summary = s; });
    expect(r.issues.filter((i) => i.severity === "block")).toEqual([]);
  });
  it.each([
    "Organised weekly society events for 2026 first-year students",
    "Organised weekly society events for 2024 users",
    "Led 2025 volunteers at weekly society events",
    "Organised weekly society events in 2027 venues",
    "Organised weekly society events (2024–2025 attendees)",
    "Organised weekly society events for (2024) users",
    "Organised weekly society events, growing membership to 2025",
    "Organised weekly society events attended by 2024 in total",
    "Organised weekly society events, growing from 60 to 2025 members",
  ])("bullet '%s' blocks as a count", (text) => {
    expect(blocksWith(ex(econBullet(text)), "inventedMetrics")).toBe(true);
  });
});

describe("fix round 3 #2: hyphen compounds exempt only ordinary heads", () => {
  it.each([
    ["summary", "Zorblax-trained Economics student at UCL"],
    ["summary", "Economics student at UCL, Zorblax-sponsored, with event experience"],
    ["bullet", "Organised weekly Ocado-sponsored society events for 60 members"],
  ])("%s '%s' blocks", (where, text) => {
    const r = ex(where === "summary" ? (t) => { t.summary = text; } : econBullet(text));
    expect(blocksWith(r, "unsupportedFacts")).toBe(true);
  });
  it.each([
    "Hands-on Economics student at UCL", "Detail-focused Economics student", "Self-motivated Economics student",
    "Part-time barista and Economics student", "Full-time Economics student", "Client-facing barista at Corner Café",
    "Economics student with Part-time barista experience", "Economics student with Hands-on event experience",
  ])("'%s' is not an unsupported fact", (s) => {
    expect(has(ex((t) => { t.summary = s; }).issues, "unsupportedFacts")).toBe(false);
  });
});

// ---------- Fix round 4 (Economics fixture: events, retail, pandas project, charity volunteering) ----------

const econ4: ParsedCV = {
  name: "D", email: null, phone: null, location: "London", links: [], summary: "Economics student at UCL",
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
const econ4Text = "UCL BSc Economics 2024–2027 Predicted 2:1\nEconomics Society Events Officer Sep 2025 – Jun 2026\nOrganised weekly society events for 60 members\n" +
  "Northside Market Retail Assistant Jun 2024 – Aug 2025\nServed customers on the till during weekend shifts\nFootfall Analysis 2025\n" +
  "Analysed shop footfall data with pandas to suggest staffing changes\nFood Bank Volunteer 2025\nTracked weekly donations in Excel\nExcel, Python, pandas";
const ex4 = (edit: (t: TailoredCV) => void) => {
  const t = toTailored(econ4);
  edit(t);
  return verifyTailoring({ source: econ4, sourceText: econ4Text, confirmedFacts: [], tailored: t, jdKeywords: ["Excel", "stakeholder"], coverageBefore: 0.3, coverageAfter: 0.5 });
};
const ex4Bullet = (text: string, section: "experience" | "projects" | "leadership" = "experience", e = 0) => (t: TailoredCV) => {
  t[section][e].bullets[0] = { ...t[section][e].bullets[0], text, changeType: "rephrased" };
};
const blocks4 = (r: ReturnType<typeof verifyTailoring>) => r.issues.filter((i) => i.severity === "block");

describe("fix round 4 A: capitalised compounds are ordinary unless an unknown head takes an affiliation tail", () => {
  const compounds = ["Policy-focused", "Policy-minded", "Impact-driven", "Purpose-driven", "Growth-minded", "Insight-driven", "Outcome-focused",
    "Strategy-focused", "Profit-driven", "Values-driven", "Process-driven", "Service-oriented", "Sales-focused", "Accuracy-focused", "Brand-aware",
    "Trade-focused", "Tax-savvy", "Stats-savvy", "Code-literate", "Spreadsheet-savvy", "Money-savvy", "Safety-conscious", "Health-conscious",
    "Till-trained", "Hands-on", "Detail-focused", "Self-motivated", "Part-time", "Full-time"];
  it.each(compounds)("summary opener '%s' is not an unsupported fact", (c) => {
    const r = ex4((t) => { t.summary = `${c} Economics student at UCL`; });
    expect(has(r.issues, "unsupportedFacts")).toBe(false);
  });
  it.each(compounds)("mid-sentence '%s' is not an unsupported fact", (c) => {
    const r = ex4((t) => { t.summary = `Economics student at UCL, ${c} and numerate`; });
    expect(has(r.issues, "unsupportedFacts")).toBe(false);
  });
  it.each([
    ["summary", "Zorblax-trained Economics student at UCL"],
    ["summary", "Economics student at UCL, Zorblax-sponsored, with event experience"],
    ["bullet", "Organised weekly Ocado-sponsored society events for 60 members"],
    ["bullet", "Organised weekly Barclays-sponsored society events for 60 members"],
    ["bullet", "Organised weekly Deloitte-sponsored society events for 60 members"],
    ["summary", "Ex-Deloitte Economics student at UCL"],
    ["summary", "Economics student at UCL, goldman-trained in Excel"],
    ["summary", "Zorblax-funded Economics student at UCL"],
    ["summary", "Zorblax-certified Economics student at UCL"],
    ["bullet", "Organised weekly Acmecorp-backed society events for 60 members"],
  ])("%s '%s' blocks as an unsupported fact", (where, text) => {
    const r = ex4(where === "summary" ? (t) => { t.summary = text; } : ex4Bullet(text));
    expect(blocksWith(r, "unsupportedFacts")).toBe(true);
  });
});

describe("fix round 4 B: the CV's own years are years by default", () => {
  it.each([
    "2027 Economics student at UCL",
    "2027 Economics graduate from UCL",
    "Economics student at UCL, 2027 graduate",
    "Economics student | UCL | 2027",
    "UCL Economics, 2027",
    "Economics student at UCL, Events Officer 2025",
    "Retail Assistant at Northside Market, starting 2024",
    "Class of '27 Economics student at UCL",
    "Economics student at UCL; 2025 pandas footfall project and 2025 Excel volunteering",
  ])("summary '%s' doesn't block", (s) => {
    expect(blocks4(ex4((t) => { t.summary = s; }))).toEqual([]);
  });
  it.each([
    ["Organised weekly society events for 60 members as Events Officer 2025", "experience", 0],
    ["Served customers on the till during weekend shifts, starting 2024", "experience", 1],
    ["2025 project: analysed shop footfall data with pandas to suggest staffing changes", "projects", 0],
    ["Tracked weekly donations in Excel, 2025", "leadership", 0],
  ] as const)("bullet '%s' doesn't block", (text, section, e) => {
    expect(blocks4(ex4(ex4Bullet(text, section, e)))).toEqual([]);
  });
  it.each([
    "Organised weekly society events for 2026 first-year students",
    "Organised weekly society events for 2024 users",
    "Led 2025 volunteers at weekly society events",
    "Organised weekly society events in 2027 venues",
    "Organised weekly society events (2024–2025 attendees)",
    "Organised weekly society events for (2024) users",
    "Organised weekly society events, growing membership to 2025",
    "Organised weekly society events attended by 2024 in total",
    "Organised weekly society events, growing from 40 to 2025 members",
    "Served 2025 customers on the till",
    "Welcomed 2024 guests to weekly society events",
    "Organised weekly society events, reaching 2026 students",
    "Organised weekly society events, 2025 per weekend",
    "Organised weekly society events and doubled attendance to 2025",
    "Mentored 2026 first-year students at society events",
    "Mentored 2026 at weekly society events",
    "Organised for 2025 at weekly society events",
    "Organised weekly society events for up to 2025",
    "Organised weekly society events with attendance of 2025",
    "Organised weekly society events for over 2025",
    "Raised £2025 at weekly society events",
    "Organised weekly society events for 2,025 members",
    "Raised 2025 for the food bank at weekly society events",
    "Organised weekly society events, raising 2025 in donations",
    "Organised weekly society events, 2025 total",
  ])("bullet '%s' blocks as a count", (text) => {
    expect(blocksWith(ex4(ex4Bullet(text)), "inventedMetrics")).toBe(true);
  });
});

// ---------- Fix round 5: compounds exempt only for an ordinary head or an attitude-only tail ----------

describe("fix round 5: competence/affiliation tails need an ordinary head, at any position", () => {
  it.each([
    ["summary", "Economics student at UCL, Xero-literate"],
    ["summary", "Economics student at UCL, Xero-proficient"],
    ["summary", "Economics student at UCL, Xero-experienced"],
    ["summary", "Economics student at UCL, Xero-skilled"],
    ["summary", "Economics student at UCL, Xero-fluent"],
    ["summary", "Economics student at UCL, Xero-ready"],
    ["summary", "Economics student at UCL, Alteryx-literate"],
    ["summary", "Economics student at UCL, EViews-literate"],
    ["retail", "Served customers on the till using Xero-based stock records"],
    ["bullet", "Organised weekly Zorblax-led society events for 60 members"],
    ["bullet", "Organised weekly Unilever-led society events for 60 members"],
    ["summary", "Zorblax-mentored Economics student at UCL"],
    ["project", "Analysed shop footfall data with pandas for a Zorblax-commissioned study"],
    ["summary", "Unilever-sponsored Economics student at UCL"],
    ["summary", "Mercer-trained Economics student at UCL"],
    ["summary", "Experian-backed Economics student at UCL"],
    ["bullet", "Unilever-sponsored weekly society events for 60 members"],
  ])("%s '%s' blocks as an unsupported fact", (where, text) => {
    const edit = where === "summary" ? (t: TailoredCV) => { t.summary = text; }
      : where === "retail" ? ex4Bullet(text, "experience", 1) : where === "project" ? ex4Bullet(text, "projects") : ex4Bullet(text);
    expect(blocksWith(ex4(edit), "unsupportedFacts")).toBe(true);
  });
  it.each(["Tax-savvy", "Stats-savvy", "Code-literate", "Spreadsheet-savvy", "Money-savvy", "Till-trained", "Excel-trained", "Self-funded",
    "Society-trained", "Customer-facing", "Policy-focused", "Brand-aware", "Hands-on", "Detail-focused", "Self-motivated", "Part-time", "Full-time"])(
    "'%s' passes at the start and mid-sentence", (c) => {
      expect(has(ex4((t) => { t.summary = `${c} Economics student at UCL`; }).issues, "unsupportedFacts")).toBe(false);
      expect(has(ex4((t) => { t.summary = `Economics student at UCL, ${c} and numerate`; }).issues, "unsupportedFacts")).toBe(false);
    });
});

describe("fix round 5: a vague quantity needs a big enough number for the same thing", () => {
  it("'dozens of weekly society events' blocks when only the member count is big", () => {
    expect(blocksWith(ex4(ex4Bullet("Organised dozens of weekly society events for 60 members")), "inventedMetrics")).toBe(true);
  });
  it("passes when the source counts the same thing", () => {
    const cv = structuredClone(econ4);
    cv.experience[0].bullets[0].text = "Organised 30 weekly society events for 60 members";
    const t = toTailored(cv);
    t.experience[0].bullets[0] = { ...t.experience[0].bullets[0], text: "Organised dozens of weekly society events for 60 members", changeType: "rephrased" };
    const r = verifyTailoring({ source: cv, sourceText: econ4Text, confirmedFacts: [], tailored: t, jdKeywords: [], coverageBefore: 0.3, coverageAfter: 0.5 });
    expect(has(r.issues, "inventedMetrics")).toBe(false);
  });
});

// ---------- Task 22b: ordinary heads by shape / CV stem / domain noun; typographic variants; number words; vendor prefixes ----------

const FALSE_BLOCKS_22B = ["Evidence-based", "Commercially-savvy", "Financially-literate", "Technically-proficient", "Digitally-literate", "Analytics-ready",
  "Commercially-astute", "Numerically-skilled", "Economically-literate", "Internationally-experienced", "Quantitatively-trained", "Evidence-led",
  "Evidence-informed", "Insight-led", "Insight-based", "Policy-literate", "Analytics-literate", "Career-ready", "Interview-ready", "Workplace-ready",
  "Audit-ready", "Media-savvy", "Digital-savvy", "Commerce-savvy", "Model-literate", "Theory-grounded", "Survey-based", "Revenue-led",
  "Office-proficient", "Event-experienced"];

describe("task 22b finding 1: plain English heads are ordinary", () => {
  it.each(FALSE_BLOCKS_22B)("'%s' passes as a summary opener and mid-sentence", (c) => {
    expect(blocks4(ex4((t) => { t.summary = `${c} Economics student at UCL`; }))).toEqual([]);
    expect(blocks4(ex4((t) => { t.summary = `Economics student at UCL, ${c} and numerate`; }))).toEqual([]);
  });
  it.each([
    "Xero-literate Economics student at UCL", "Economics student at UCL, Xero-literate", "Economics student at UCL, Xero-based",
    "Zorblax-trained Economics student at UCL", "Zorblax-sponsored Economics student at UCL", "Ocado-sponsored Economics student at UCL",
    "PwC-trained Economics student at UCL", "McKinsey-mentored Economics student at UCL", "Unilever-led Economics student at UCL",
  ])("'%s' still blocks", (s) => {
    expect(blocksWith(ex4((t) => { t.summary = s; }), "unsupportedFacts")).toBe(true);
  });
  it("a JD-only proper noun is never an ordinary head: JD mentions Xero, CV doesn't", () => {
    const t = toTailored(econ4);
    t.summary = "Economics student at UCL, Xero-literate";
    const r = verifyTailoring({ source: econ4, sourceText: econ4Text, confirmedFacts: [], tailored: t, jdKeywords: ["Xero", "Excel"], coverageBefore: 0.3, coverageAfter: 0.5 });
    expect(r.verdict).toBe("block");
    const t2 = toTailored(econ4);
    t2.summary = "Xero-literate Economics student at UCL";
    expect(verifyTailoring({ source: econ4, sourceText: econ4Text, confirmedFacts: [], tailored: t2, jdKeywords: ["Xero"], coverageBefore: 0.3, coverageAfter: 0.5 }).verdict).toBe("block");
  });
  it("a lowercase JD word is an ordinary head ('stakeholder-ready')", () => {
    expect(blocks4(ex4((t) => { t.summary = "Stakeholder-ready Economics student at UCL"; }))).toEqual([]);
  });
});

describe("task 22b finding 2: typographic variants of affiliation compounds", () => {
  it.each([
    "Unilever‑sponsored Economics student at UCL",
    "Unilever–sponsored Economics student at UCL",
    "Unilever‐sponsored Economics student at UCL",
    "Unilever−sponsored Economics student at UCL",
    "Unilever sponsored Economics student at UCL",
    "Mercer trained Economics student at UCL",
    "Experian backed Economics student at UCL",
    "Zorblax funded Economics student at UCL",
  ])("summary '%s' blocks", (s) => {
    expect(blocksWith(ex4((t) => { t.summary = s; }), "unsupportedFacts")).toBe(true);
  });
  it.each(["Unilever sponsored weekly society events for 60 members", "Mercer‑trained volunteers at weekly society events for 60 members"])(
    "bullet '%s' blocks", (s) => { expect(blocksWith(ex4(ex4Bullet(s)), "unsupportedFacts")).toBe(true); });
  it.each([
    ["Trained volunteers in organising weekly society events for 60 members", "experience", 0],
    ["Led weekly sessions: organised society events for 60 members", "experience", 0],
    ["Self funded Economics student at UCL", "summary", 0],
    ["Society trained Economics student at UCL", "summary", 0],
    ["Policy‑focused Economics student at UCL", "summary", 0],
  ] as const)("'%s' behaves as before (no unsupported fact)", (s, where, e) => {
    const r = ex4(where === "summary" ? (t) => { t.summary = s; } : ex4Bullet(s, where, e));
    expect(has(r.issues, "unsupportedFacts")).toBe(false);
  });
});

describe("task 22b cheap items", () => {
  it("number words in the source back a vague quantity of the same thing", () => {
    const cv = structuredClone(econ4);
    cv.experience[0].bullets[0].text = "Organised thirty weekly society events";
    const t = toTailored(cv);
    t.experience[0].bullets[0] = { ...t.experience[0].bullets[0], text: "Organised dozens of weekly society events", changeType: "rephrased" };
    const r = verifyTailoring({ source: cv, sourceText: econ4Text, confirmedFacts: [], tailored: t, jdKeywords: [], coverageBefore: 0.3, coverageAfter: 0.5 });
    expect(has(r.issues, "inventedMetrics")).toBe(false);
  });
  it("a small number word still doesn't back 'dozens'", () => {
    const cv = structuredClone(econ4);
    cv.experience[0].bullets[0].text = "Organised twenty weekly society events";
    const t = toTailored(cv);
    t.experience[0].bullets[0] = { ...t.experience[0].bullets[0], text: "Organised dozens of weekly society events", changeType: "rephrased" };
    const r = verifyTailoring({ source: cv, sourceText: econ4Text, confirmedFacts: [], tailored: t, jdKeywords: [], coverageBefore: 0.3, coverageAfter: 0.5 });
    expect(blocksWith(r, "inventedMetrics")).toBe(true);
  });
  it.each(["Tracked weekly donations in Microsoft Excel", "Tracked weekly donations in Microsoft Excel"])("'%s' passes when Excel is on the CV", (s) => {
    expect(blocks4(ex4(ex4Bullet(s, "leadership")))).toEqual([]);
  });
  it.each(["Analysed shop footfall data with pandas and Apache Spark", "Tracked weekly donations in Microsoft Access", "Tracked weekly donations for Microsoft"])(
    "'%s' still blocks (vendor prefix only before a CV tool)", (s) => {
      expect(ex4(ex4Bullet(s, s.startsWith("Analysed") ? "projects" : "leadership")).verdict).toBe("block");
    });
});
