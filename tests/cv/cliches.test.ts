import { describe, it, expect } from "vitest";
import {
  CLICHES,
  CLICHE_ALLOWLIST,
  CLICHE_MINOR_THRESHOLD,
  CLICHE_MAJOR_THRESHOLD,
  CLICHE_MIN_WORDS,
  clicheDensity,
} from "@/lib/cv/cliches";

/** n filler words that contain no lexicon terms. */
const filler = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");
const terms = (text: string, opts?: Parameters<typeof clicheDensity>[1]) => clicheDensity(text, opts).hits.map((h) => h.term);

describe("CLICHES lexicon", () => {
  it("gives every entry a category and a pattern", () => {
    expect(CLICHES.length).toBeGreaterThanOrEqual(28);
    for (const c of CLICHES) {
      expect(["buzzword", "cliche", "llm_tell"]).toContain(c.category);
      expect(c.pattern).toBeInstanceOf(RegExp);
    }
  });
  it("exports thresholds in increasing order", () => {
    expect(CLICHE_MINOR_THRESHOLD).toBe(1.0);
    expect(CLICHE_MAJOR_THRESHOLD).toBe(2.5);
    expect(CLICHE_MIN_WORDS).toBeGreaterThan(0);
  });
});

describe("clicheDensity matching", () => {
  it("matches simple inflections of leverage", () => {
    expect(terms("I leverage it, leveraged them, and keep leveraging; leverages too.")).toEqual([
      "leveraged", "leveraged", "leveraged", "leveraged",
    ]);
  });
  it("matches multi-word and hyphenated phrases case-insensitively", () => {
    const t = terms("Results-Driven team player, passionate about cutting edge work in a fast-paced environment with a proven track record.");
    expect(t).toEqual(expect.arrayContaining([
      "results-driven", "team player", "passionate about", "cutting-edge", "fast-paced environment", "proven track record",
    ]));
  });
  it("matches LLM tells including the 'in today's ... landscape' template", () => {
    const t = terms("In today's rapidly evolving digital landscape I delved into a rich tapestry, a testament to my deep work.");
    expect(t).toEqual(expect.arrayContaining(["in today's ... landscape", "delve", "tapestry", "testament to"]));
  });
  it("respects word boundaries", () => {
    expect(terms("Studied dynamics and thermodynamics; robustness checks; leveret; seasonal sales; pivotally")).toEqual([]);
  });
  it("records the character index and matched text of each hit", () => {
    const text = "Built tools. Spearheaded a launch.";
    const [hit] = clicheDensity(text).hits;
    expect(hit).toMatchObject({ term: "spearheaded", category: "buzzword", index: 13, match: "Spearheaded" });
    expect(text.slice(hit.index, hit.index + hit.match.length)).toBe("Spearheaded");
  });
  it("returns hits in text order", () => {
    const idx = clicheDensity("Synergy then robust then seamless").hits.map((h) => h.index);
    expect(idx).toEqual([...idx].sort((a, b) => a - b));
  });
});

describe("structural tells", () => {
  it("counts em-dashes used as prose asides", () => {
    const r = clicheDensity("I built a tool — a fast one — for the society.");
    expect(r.structural.emDashes).toBe(2);
    expect(r.hits.filter((h) => h.category === "structural")).toHaveLength(2);
  });
  it("ignores em-dashes used as date ranges", () => {
    expect(clicheDensity("Sept 2024 — June 2025, Oct 2025 — Present").structural.emDashes).toBe(0);
  });
  it("counts 'not only ... but also'", () => {
    const r = clicheDensity("I not only cleaned the data but also built the dashboard.");
    expect(r.structural.notOnlyButAlso).toBe(1);
  });
});

describe("allowlist", () => {
  it("does not flag 'foster care'", () => {
    expect(terms("Volunteered with a foster care charity")).toEqual([]);
    expect(terms("Helped foster a culture of feedback")).toEqual(["foster"]);
  });
  it("does not flag the module name 'Robust Statistics'", () => {
    expect(terms("Modules: Robust Statistics, Econometrics")).toEqual([]);
    expect(terms("Delivered a robust solution")).toEqual(["robust"]);
  });
  it("does not flag 'dynamic programming'", () => {
    expect(terms("Solved it with dynamic programming")).toEqual([]);
  });
  it("accepts caller-supplied allowlist phrases", () => {
    expect(terms("Member of Pivotal Society", { allow: ["Pivotal Society"] })).toEqual([]);
    expect(terms("A pivotal moment")).toEqual(["pivotal"]);
  });
  it("ships a default allowlist", () => {
    expect(CLICHE_ALLOWLIST.length).toBeGreaterThan(0);
  });
});

describe("density and severity", () => {
  it("is ok for empty text", () => {
    expect(clicheDensity("")).toMatchObject({ per100Words: 0, hits: [], severity: "ok", words: 0 });
  });
  it("is ok for clean text", () => {
    expect(clicheDensity(filler(200)).severity).toBe("ok");
  });
  it("computes hits per 100 words", () => {
    // 2 hits in 200 words = 1.0 per 100 -> minor
    const r = clicheDensity(`synergy robust ${filler(198)}`);
    expect(r.words).toBe(200);
    expect(r.per100Words).toBeCloseTo(1.0);
    expect(r.severity).toBe("minor");
  });
  it("is ok just below 1.0", () => {
    expect(clicheDensity(`synergy ${filler(199)}`).severity).toBe("ok"); // 0.5
  });
  it("is major at 2.5 and above", () => {
    const r = clicheDensity(`synergy robust seamless innovative visionary ${filler(195)}`); // 5 / 200 = 2.5
    expect(r.per100Words).toBeCloseTo(2.5);
    expect(r.severity).toBe("major");
  });
  it("damps very short texts with a minimum word basis", () => {
    // one hit in a 3-word bullet is 1 / max(3, MIN) * 100, not 33 per 100
    const r = clicheDensity("Leveraged Python skills");
    expect(r.per100Words).toBeCloseTo(100 / CLICHE_MIN_WORDS);
    expect(clicheDensity("Leveraged Python skills", { minWords: 1 }).per100Words).toBeCloseTo(100 / 3);
  });
});

describe("regressions: human formatting and finance terms", () => {
  const HUMAN_CV = [
    "Ayse Demir — BSc Economics, UCL",
    "Summer Analyst Intern — Google",
    "Sept 2025 — Present",
    "Built a Python model to forecast weekly sales for 40 stores and cut forecast error by 12%.",
    "Leveraged Finance Insight Day — Example Bank",
    "Shadowed the leveraged finance desk and summarised two leveraged loan term sheets for the team.",
    "Treasurer — UCL Finance Society",
    "Managed a £3,000 budget and reported the leverage ratio of a case-study company at a society pitch.",
    "Skills",
    "Python — advanced",
    "Excel — advanced",
    "SQL — intermediate",
    "Languages — Turkish (native), English (fluent)",
  ].join("\n");

  it("scores a realistic human CV as ok or minor", () => {
    const r = clicheDensity(HUMAN_CV);
    expect(r.words).toBeGreaterThan(80);
    expect(["ok", "minor"]).toContain(r.severity);
    expect(r.structural.emDashes).toBe(0);
  });
  it("does not count em-dashes used as header separators", () => {
    expect(clicheDensity("Intern — Google").structural.emDashes).toBe(0);
    expect(clicheDensity("Python — advanced").structural.emDashes).toBe(0);
    expect(clicheDensity("Treasurer — UCL Finance Society").structural.emDashes).toBe(0);
  });
  it("still counts em-dashes inside a prose sentence", () => {
    expect(clicheDensity("I built a tool — a fast one — for the society.").structural.emDashes).toBe(2);
  });
  it("allowlists finance uses of leverage", () => {
    for (const t of ["leveraged finance", "Leveraged Buyout", "a leveraged loan", "the leverage ratio", "operating leverage", "Financial Leverage"]) {
      expect(terms(t)).toEqual([]);
    }
    expect(terms("Leveraged my network")).toEqual(["leveraged"]);
  });
});

