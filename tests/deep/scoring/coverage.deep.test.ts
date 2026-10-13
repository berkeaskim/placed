import { describe, it, expect } from "vitest";
import {
  jdRequirementSkills, computeCoverage, coverageLabel, cvSkillSource, profileSkillSource,
  type CvSkillSource, type CoverageResult,
} from "@/lib/scoring/coverage";
import { SKILLS } from "@/lib/skills/extract";
import type { Requirement } from "@/lib/types";

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function shuffle<T>(xs: T[], r: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
// Skills that extract reliably from prose (excludes context-sensitive single letters and Go).
const POOL = SKILLS.map((s) => s.canonical).filter((c) => !["C", "R", "Go"].includes(c));
const pick = (r: () => number) => POOL[Math.floor(r() * POOL.length)];
const EMPTY: CvSkillSource = { skillsList: [], bulletText: "", otherText: "" };
type Req = { skill: string; section: "must" | "nice" };
const pct = (label: string) => Number(/\((\d+)%\)/.exec(label)?.[1]);
const req = (skill: string | null, section: "must" | "nice" = "must"): Requirement =>
  ({ text: skill ?? "", skill, importance: "high", section, evidenceTier: "stated" });

function randomCase(r: () => number) {
  const n = 1 + Math.floor(r() * 12);
  const reqs: Req[] = [];
  const seen = new Set<string>();
  for (let i = 0; i < n; i++) {
    const s = pick(r);
    if (seen.has(s)) continue;
    seen.add(s);
    reqs.push({ skill: s, section: r() < 0.6 ? "must" : "nice" });
  }
  const cv: CvSkillSource = { skillsList: [], bulletText: "", otherText: "" };
  for (const q of reqs) {
    const x = r();
    if (x < 0.3) cv.skillsList.push(q.skill);
    else if (x < 0.45) cv.bulletText += `Used ${q.skill} daily.\n`;
    else if (x < 0.6) cv.otherText += `Studied ${q.skill} in class.\n`;
  }
  return { reqs, cv };
}

describe("spec §5.1 conformance — weights and credits", () => {
  it("existing = 1.0 credit (skills list)", () => {
    expect(computeCoverage([{ skill: "Python", section: "must" }], { ...EMPTY, skillsList: ["Python"] }).weighted).toBe(1);
  });
  it("existing = 1.0 credit (bullet)", () => {
    const r = computeCoverage([{ skill: "Python", section: "must" }], { ...EMPTY, bulletText: "Automated reports in Python" });
    expect(r.items[0].status).toBe("existing");
    expect(r.weighted).toBe(1);
  });
  it("supportedByResume = 0.75 credit (prose only)", () => {
    const r = computeCoverage([{ skill: "Python", section: "must" }], { ...EMPTY, otherText: "Interested in Python" });
    expect(r.items[0].status).toBe("supportedByResume");
    expect(r.weighted).toBe(0.75);
  });
  it("gap = 0", () => {
    expect(computeCoverage([{ skill: "Python", section: "must" }], EMPTY).weighted).toBe(0);
  });
  it("skills list / bullet beats prose (best evidence wins)", () => {
    const r = computeCoverage([{ skill: "SQL", section: "must" }], { skillsList: ["SQL"], bulletText: "", otherText: "SQL coursework" });
    expect(r.items[0].status).toBe("existing");
  });
  it("must weighs ×2, nice ×1", () => {
    const cv = { ...EMPTY, skillsList: ["Python"] };
    expect(computeCoverage([{ skill: "Python", section: "must" }, { skill: "SQL", section: "nice" }], cv).weighted).toBeCloseTo(2 / 3, 12);
    expect(computeCoverage([{ skill: "Python", section: "nice" }, { skill: "SQL", section: "must" }], cv).weighted).toBeCloseTo(1 / 3, 12);
    // supported must + gap nice: 2*0.75 / 3
    expect(computeCoverage([{ skill: "Excel", section: "must" }, { skill: "SQL", section: "nice" }], { ...EMPTY, otherText: "Excel" }).weighted).toBeCloseTo(0.5, 12);
  });
  it("label format matches the spec: 'You match 7/9 must-haves, 2/4 nice-to-haves (78%)'", () => {
    const must = ["Python", "SQL", "Excel", "Tableau", "Pandas", "NumPy", "Statistics", "Rust", "Haskell"];
    const nice = ["Docker", "AWS", "Kotlin", "Scala"];
    const reqs: Req[] = [...must.map((s) => ({ skill: s, section: "must" as const })), ...nice.map((s) => ({ skill: s, section: "nice" as const }))];
    const r = computeCoverage(reqs, { ...EMPTY, skillsList: [...must.slice(0, 7), ...nice.slice(0, 2)] });
    // (7*2 + 2) / (9*2 + 4) = 16/22 = 72.7%
    expect(coverageLabel(r)).toBe("You match 7/9 must-haves, 2/4 nice-to-haves (73%)");
  });
  it("supportedByResume counts as matched in the X/Y counts but only 75% in the percentage", () => {
    const r = computeCoverage([{ skill: "Python", section: "must" }], { ...EMPTY, otherText: "Python" });
    expect(coverageLabel(r)).toBe("You match 1/1 must-haves, 0/0 nice-to-haves (75%)");
  });
  it("all existing → exactly 100%", () => {
    const r = computeCoverage([{ skill: "Python", section: "must" }, { skill: "SQL", section: "nice" }], { ...EMPTY, skillsList: ["python", "SQL"] });
    expect(coverageLabel(r)).toContain("(100%)");
  });
  it("99% cap applies to a near-perfect score with only a supportedByResume item (not just gaps)", () => {
    const reqs: Req[] = Array.from({ length: 250 }, (_, i) => ({ skill: i === 0 ? "Excel" : "Python", section: "must" }));
    const r = computeCoverage(reqs, { skillsList: ["Python"], bulletText: "", otherText: "Excel" });
    expect(r.weighted!).toBeGreaterThan(0.995);
    expect(coverageLabel(r)).toContain("(99%)");
  });
  it("zero requirements → unreadable, null, never 100% (spec §5.1.6)", () => {
    const r = computeCoverage([], { ...EMPTY, skillsList: ["Python"] });
    expect(r).toMatchObject({ readable: false, weighted: null });
    expect(coverageLabel(r)).toBe("Couldn't read the requirements");
  });
  it("coverageLabel never throws or shows NaN for a hand-built null result", () => {
    const r: CoverageResult = { readable: true, weighted: null, must: { matched: 0, total: 0 }, nice: { matched: 0, total: 0 }, items: [] };
    expect(coverageLabel(r)).toBe("Couldn't read the requirements");
  });
});

describe("empty / degenerate inputs", () => {
  it("empty CV against real requirements → 0%, no NaN", () => {
    const r = computeCoverage([{ skill: "Python", section: "must" }, { skill: "SQL", section: "nice" }], EMPTY);
    expect(r.weighted).toBe(0);
    expect(coverageLabel(r)).toBe("You match 0/1 must-haves, 0/1 nice-to-haves (0%)");
  });
  it("cvSkillSource on a fully empty ParsedCV-shaped object", () => {
    const src = cvSkillSource({ skills: [], experience: [], projects: [] });
    expect(src.skillsList).toEqual([]);
    expect(computeCoverage([{ skill: "Python", section: "must" }], src).weighted).toBe(0);
  });
  it("cvSkillSource canonicalises skills-list aliases (JS → JavaScript, MS Excel → Excel)", () => {
    const src = cvSkillSource({ skills: [{ group: "x", items: ["JS", "MS Excel", "Some Unknown Tool"] }], experience: [], projects: [] });
    expect(src.skillsList).toEqual(["JavaScript", "Excel", "Some Unknown Tool"]);
  });
  it("cvSkillSource: experience/project/leadership titles and bullets are 'bullet' evidence; education details are prose", () => {
    const entry = (title: string, bullet: string) => ({ id: "e", org: "o", title, dates: "", location: "", bullets: [{ id: "b", text: bullet }] });
    const src = cvSkillSource({
      skills: [], experience: [entry("Python Developer", "x")], projects: [entry("p", "Built it in SQL")], leadership: [entry("l", "Ran Excel training")],
      education: [{ id: "ed", institution: "UCL", degree: "BSc", dates: "", grade: null, details: [{ id: "d", text: "Modules: Statistics" }] }],
      summary: "Keen on Tableau", interests: "Chess",
    });
    const r = computeCoverage(["Python", "SQL", "Excel", "Statistics", "Tableau", "Chess"].map((s) => ({ skill: s, section: "must" as const })), src);
    const status = Object.fromEntries(r.items.map((i) => [i.skill, i.status]));
    expect(status).toEqual({ Python: "existing", SQL: "existing", Excel: "existing", Statistics: "supportedByResume", Tableau: "supportedByResume", Chess: "supportedByResume" });
  });
  it("profileSkillSource matches case-insensitively", () => {
    expect(computeCoverage([{ skill: "Python", section: "must" }], profileSkillSource(["python"])).weighted).toBe(1);
  });

  // Fixed: skills-list items are also run through extractSkills ("Python (Pandas, NumPy)").
  it("a skills-list item with a parenthetical still counts as listing the skill", () => {
    const src = cvSkillSource({ skills: [{ group: "Tech", items: ["Python (Pandas, NumPy)", "MS Office (Excel, PowerPoint)"] }], experience: [], projects: [] });
    const r = computeCoverage([{ skill: "Python", section: "must" }, { skill: "Excel", section: "must" }, { skill: "Pandas", section: "nice" }], src);
    expect(r.items.map((i) => i.status)).toEqual(["existing", "existing", "existing"]);
  });
  it("a comma-joined skills-list item is split into its skills", () => {
    const src = cvSkillSource({ skills: [{ group: "Languages", items: ["Python, SQL, Excel"] }], experience: [], projects: [] });
    expect(computeCoverage([{ skill: "SQL", section: "must" }], src).weighted).toBe(1);
  });
});

describe("jdRequirementSkills", () => {
  it("must wins over nice regardless of source (line vs tagged) and order", () => {
    const a = jdRequirementSkills(["## Nice to have", "- Python"], [req("Python", "must")]);
    const b = jdRequirementSkills(["## Requirements", "- Python"], [req("Python", "nice")]);
    expect(a).toEqual([{ skill: "Python", section: "must" }]);
    expect(b).toEqual([{ skill: "Python", section: "must" }]);
  });
  it("ignores headers and 'other' sections (About us, Benefits)", () => {
    const r = jdRequirementSkills(["## About us", "We use Python and SQL", "## Benefits", "- Free Excel training", "## Requirements: Tableau"], []);
    expect(r).toEqual([]);
  });
  it("tagged requirements with null skill are ignored; aliases are canonicalised", () => {
    const r = jdRequirementSkills([], [req(null), req("js"), req("MS Excel", "nice")]);
    expect(r).toEqual([{ skill: "JavaScript", section: "must" }, { skill: "Excel", section: "nice" }]);
  });
  it("unknown tagged skills are kept verbatim so they still show as requirements", () => {
    expect(jdRequirementSkills([], [req("Kdb Insights")])).toEqual([{ skill: "Kdb Insights", section: "must" }]);
  });
  it("no duplicates in output (property)", () => {
    const r = rng(3);
    for (let i = 0; i < 300; i++) {
      const skills = Array.from({ length: 8 }, () => pick(r));
      const lines = ["## Requirements", ...skills.map((s) => `- ${s}`), "## Nice to have", ...skills.map((s) => `- ${s}`)];
      const out = jdRequirementSkills(lines, skills.map((s) => req(s, r() < 0.5 ? "must" : "nice")));
      expect(new Set(out.map((o) => o.skill)).size).toBe(out.length);
    }
  });
  it("order-independent: permuting tagged requirements yields the same skill→section map (property)", () => {
    const r = rng(11);
    for (let i = 0; i < 300; i++) {
      const tagged = Array.from({ length: 10 }, () => req(pick(r), r() < 0.5 ? "must" : "nice"));
      const norm = (x: { skill: string; section: string }[]) => Object.fromEntries(x.map((e) => [e.skill, e.section]));
      expect(norm(jdRequirementSkills([], shuffle(tagged, r)))).toEqual(norm(jdRequirementSkills([], tagged)));
    }
  });
  it("idempotent: feeding the output back as tagged requirements is a fixed point", () => {
    const lines = ["## Requirements", "- Python, SQL and Excel", "## Preferred", "- Tableau or Power BI", "- Docker (preferred)"];
    const once = jdRequirementSkills(lines, []);
    const twice = jdRequirementSkills([], once.map((o) => req(o.skill, o.section)));
    expect(twice).toEqual(once);
  });

  // GAP: lib/scoring/coverage.ts:25 — unknown tagged skills are not normalised (trim/case), so the same
  // LLM-tagged skill with different casing becomes two requirements, and padded whitespace never matches the CV.
  it.fails("unknown tagged skills are de-duplicated case/whitespace-insensitively", () => {
    const r = jdRequirementSkills([], [req("  Kdb Insights "), req("kdb insights", "nice")]);
    expect(r).toEqual([{ skill: "Kdb Insights", section: "must" }]);
  });
});

describe("computeCoverage invariants (seeded property loops)", () => {
  it("weighted ∈ [0,1], finite; matched ≤ total; totals add up", () => {
    const r = rng(1);
    for (let i = 0; i < 1500; i++) {
      const { reqs, cv } = randomCase(r);
      const res = computeCoverage(reqs, cv);
      expect(res.readable).toBe(true);
      expect(Number.isFinite(res.weighted!)).toBe(true);
      expect(res.weighted!).toBeGreaterThanOrEqual(0);
      expect(res.weighted!).toBeLessThanOrEqual(1);
      expect(res.must.matched).toBeLessThanOrEqual(res.must.total);
      expect(res.nice.matched).toBeLessThanOrEqual(res.nice.total);
      expect(res.must.total + res.nice.total).toBe(reqs.length);
      expect(res.items.map((x) => x.skill)).toEqual(reqs.map((x) => x.skill)); // items preserve input order
    }
  });
  it("label never shows 100% unless every item is existing, and 0..100 always", () => {
    const r = rng(2);
    for (let i = 0; i < 1500; i++) {
      const { reqs, cv } = randomCase(r);
      const res = computeCoverage(reqs, cv);
      const p = pct(coverageLabel(res));
      expect(p).toBeGreaterThanOrEqual(0);
      expect(p).toBeLessThanOrEqual(100);
      if (res.items.some((x) => x.status !== "existing")) expect(p).toBeLessThan(100);
      else expect(p).toBe(100);
    }
  });
  it("order-independent: shuffling requirements does not change weighted or counts", () => {
    const r = rng(5);
    for (let i = 0; i < 800; i++) {
      const { reqs, cv } = randomCase(r);
      const a = computeCoverage(reqs, cv), b = computeCoverage(shuffle(reqs, r), cv);
      expect(b.weighted!).toBeCloseTo(a.weighted!, 12);
      expect(b.must).toEqual(a.must);
      expect(b.nice).toEqual(a.nice);
    }
  });
  it("monotonic: adding a required skill to the skills list never lowers coverage", () => {
    const r = rng(8);
    for (let i = 0; i < 800; i++) {
      const { reqs, cv } = randomCase(r);
      const before = computeCoverage(reqs, cv).weighted!;
      const add = reqs[Math.floor(r() * reqs.length)].skill;
      const after = computeCoverage(reqs, { ...cv, skillsList: [...cv.skillsList, add] }).weighted!;
      expect(after).toBeGreaterThanOrEqual(before - 1e-12);
    }
  });
  it("monotonic: adding prose mentions never lowers coverage", () => {
    const r = rng(9);
    for (let i = 0; i < 800; i++) {
      const { reqs, cv } = randomCase(r);
      const before = computeCoverage(reqs, cv).weighted!;
      const after = computeCoverage(reqs, { ...cv, otherText: cv.otherText + `\nAlso ${pick(r)} and ${pick(r)}.` }).weighted!;
      expect(after).toBeGreaterThanOrEqual(before - 1e-12);
    }
  });
  it("monotonic: upgrading a must-have from gap to existing raises coverage by exactly 2/Σw", () => {
    const reqs: Req[] = [{ skill: "Python", section: "must" }, { skill: "SQL", section: "must" }, { skill: "Tableau", section: "nice" }];
    const a = computeCoverage(reqs, EMPTY).weighted!;
    const b = computeCoverage(reqs, { ...EMPTY, skillsList: ["SQL"] }).weighted!;
    expect(b - a).toBeCloseTo(2 / 5, 12);
  });
  it("deterministic and pure (input not mutated)", () => {
    const r = rng(10);
    for (let i = 0; i < 200; i++) {
      const { reqs, cv } = randomCase(r);
      const snap = JSON.stringify({ reqs, cv });
      expect(computeCoverage(reqs, cv)).toEqual(computeCoverage(reqs, cv));
      expect(JSON.stringify({ reqs, cv })).toBe(snap);
    }
  });
  it("skills-list matching is case-insensitive", () => {
    expect(computeCoverage([{ skill: "PowerPoint", section: "must" }], { ...EMPTY, skillsList: ["POWERPOINT"] }).weighted).toBe(1);
  });
});
