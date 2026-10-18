import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";

// The live judge must never run in tests: any call fails the test.
vi.mock("@/lib/ai/judgeCvRules", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/judgeCvRules")>();
  return { ...actual, judgeCvRules: vi.fn(async () => { throw new Error("live AI called in a test"); }) };
});

import { judgeCvRules } from "@/lib/ai/judgeCvRules";
import { consensus, loadGold, parseGold, GOLD_FORMAT } from "@/lib/cv-score/gold";
import { codeVerdicts, compareWithHumans, interRater, KAPPA_GATE, renderValidationReport, validateGold } from "@/lib/cv-score/validate";

const SYNTHETIC = "docs/validation/gold/synthetic-example.json";
const gold = loadGold(SYNTHETIC);
const raw = () => JSON.parse(readFileSync(SYNTHETIC, "utf8"));

const cvText = "[NAME]\nalex@example.com | 07700 900456\n\nEDUCATION\nUniversity of Westbridge — BSc Economics, 2024 – 2027\nYear 1 average: 68% (2:1)\n";
const mini = (labels: Record<string, Record<string, string>>, raters = Object.keys(labels)) => ({
  format: GOLD_FORMAT, name: "t", synthetic: true, description: "test", created: "2026-10-18",
  raters: raters.map((id) => ({ id, role: "test", synthetic: true })),
  cvs: [{ id: "c1", sector: "finance_banking", year: "2nd", text: cvText, labels }],
});

describe("synthetic example gold file", () => {
  it("is valid placed-gold/1, clearly synthetic, with ≥ 8 CVs and ≥ 2 raters on every CV", () => {
    expect(gold.format).toBe("placed-gold/1");
    expect(gold.synthetic).toBe(true);
    expect(gold.description).toMatch(/SYNTHETIC/);
    expect(gold.raters.every((r) => r.synthetic === true)).toBe(true);
    expect(gold.cvs.length).toBeGreaterThanOrEqual(8);
    for (const cv of gold.cvs) expect(Object.keys(cv.labels).length).toBeGreaterThanOrEqual(2);
  });
  it("uses only fictitious contact details (example.com email, Ofcom drama-range 07700 900xxx numbers)", () => {
    for (const cv of gold.cvs) {
      for (const m of cv.text.match(/[\w.+-]+@[\w.-]+/g) ?? []) expect(m).toMatch(/@example\.com$/);
      for (const m of cv.text.match(/\b07\d{3}\s?\d{6}\b/g) ?? []) expect(m.replace(/\s/g, "")).toMatch(/^07700900\d{3}$/);
    }
  });
});

describe("parseGold validation", () => {
  it("rejects a CV labelled by only one rater", () => {
    expect(() => parseGold(mini({ R1: { "G-16": "pass" } }, ["R1", "R2"]))).toThrow(/at least 2 raters/);
  });
  it("rejects unknown rules, rules not scored for the sector, unknown raters and partial on a rule without it", () => {
    expect(() => parseGold(mini({ R1: { "NOPE-1": "pass" }, R2: { "NOPE-1": "pass" } }))).toThrow(/unknown rule NOPE-1/);
    expect(() => parseGold(mini({ R1: { "SWE-03": "pass" }, R2: { "SWE-03": "pass" } }))).toThrow(/isn't scored for finance_banking/);
    expect(() => parseGold(mini({ R1: { "G-16": "pass" }, R9: { "G-16": "pass" } }, ["R1", "R2"]))).toThrow(/rater R9 isn't in "raters"/);
    expect(() => parseGold(mini({ R1: { "G-16": "partial" }, R2: { "G-16": "pass" } }))).toThrow(/doesn't allow partial/);
  });
  it("rejects rater ids that look like names, and a synthetic file listing real raters", () => {
    expect(() => parseGold(mini({ "Jane Doe": { "G-16": "pass" }, R2: { "G-16": "pass" } }))).toThrow(/rater ids are short codes/);
    const f = mini({ R1: { "G-16": "pass" }, R2: { "G-16": "pass" } });
    f.raters[0] = { ...f.raters[0], synthetic: false };
    expect(() => parseGold(f)).toThrow(/synthetic file can't list real raters/);
  });
  it("rejects another format version", () => {
    expect(() => parseGold({ ...raw(), format: "placed-gold/2" })).toThrow(/placed-gold\/1/);
  });
});

describe("consensus", () => {
  it("is the strict majority of binary labels; partial counts as fail; a tie is null", () => {
    const g = parseGold(mini({ A: { "G-20": "partial", "G-16": "pass" }, B: { "G-20": "fail", "G-16": "fail" } }));
    const c = consensus(g.cvs[0]);
    expect(c.get("G-20")).toBe("fail");
    expect(c.get("G-16")).toBeNull();
  });
});

describe("inter-rater agreement", () => {
  it("uses Fleiss' κ for the 3-rater synthetic set", () => {
    const rows = interRater(gold);
    expect(rows.every((r) => r.method === "fleiss" && r.raters === 3)).toBe(true);
    // G-17: all three raters agree on every CV, with both pass and fail present.
    expect(rows.find((r) => r.ruleId === "G-17")!.kappa).toBeCloseTo(1, 10);
    // G-12: one rater missed the out-of-order CV, so agreement is high but not perfect.
    const g12 = rows.find((r) => r.ruleId === "G-12")!;
    expect(g12.agreement).toBeCloseTo(0.9);
    expect(g12.kappa!).toBeLessThan(1);
  });
  it("uses Cohen's κ (with AC1) when the same two raters labelled every item", () => {
    const f = raw();
    f.raters = f.raters.slice(0, 2);
    for (const cv of f.cvs) delete cv.labels["SYN-C"];
    const rows = interRater(parseGold(f));
    expect(rows.every((r) => r.method === "cohen" && r.raters === 2)).toBe(true);
    expect(rows.find((r) => r.ruleId === "G-17")!.kappa).toBeCloseTo(1, 10);
    expect(rows.find((r) => r.ruleId === "G-17")!.ac1).toBeCloseTo(1, 10);
  });
});

describe("code checkers vs the human majority (offline)", () => {
  const rows = compareWithHumans(gold, codeVerdicts, "code");
  const row = (id: string) => rows.find((r) => r.ruleId === id)!;
  it("scores every labelled code rule and never calls the AI", () => {
    expect(rows.map((r) => r.ruleId)).toEqual(expect.arrayContaining(["G-16", "G-17", "G-22", "G-32", "G-05"]));
    expect(rows.every((r) => r.check === "code")).toBe(true);
    expect(judgeCvRules).not.toHaveBeenCalled();
  });
  it("G-17 (labelled DOB / marital status) matches the raters exactly", () => {
    expect(row("G-17")).toMatchObject({ kappa: 1, flagged: false });
    expect(row("G-17").detection).toMatchObject({ tp: 2, fp: 0, fn: 0 });
  });
  it("flags SWE-07 below the gate: the checker fails a first-year with no GitHub link, the raters say not applicable", () => {
    expect(row("SWE-07").naMismatch).toBe(1);
    expect(row("SWE-07").flagged).toBe(true);
    expect(row("SWE-07").kappa!).toBeLessThan(KAPPA_GATE);
  });
});

describe("AI judge vs the human majority (judge verdicts supplied, no AI)", () => {
  // A stand-in judge: agrees with the raters except where noted.
  const fake = (cv: { id: string }) => new Map(Object.entries({
    // Misses the referee email on syn-09 and wrongly fails the clean syn-01.
    "G-18": cv.id === "syn-02" || cv.id === "syn-01" ? "fail" : "pass",
    "G-20": "could_not_assess",
    "G-12": cv.id === "syn-08" ? "fail" : "pass",
  }));
  const rows = compareWithHumans(gold, fake, "llm");
  const row = (id: string) => rows.find((r) => r.ruleId === id)!;
  it("reports κ per rule and flags rules below 0.6 for rewrite", () => {
    expect(row("G-12")).toMatchObject({ kappa: 1, flagged: false });
    expect(row("G-18").detection).toMatchObject({ tp: 1, fn: 1, fp: 1 });
    expect(row("G-18").kappa!).toBeLessThan(KAPPA_GATE);
    expect(row("G-18").flagged).toBe(true);
  });
  it("counts could_not_assess separately and flags a rule the judge never assessed", () => {
    expect(row("G-20")).toMatchObject({ unassessed: 10, kappa: null, flagged: true });
  });
  it("renders a report that says the data is synthetic and lists the flagged rules", () => {
    const md = renderValidationReport(gold, { ...validateGold(gold), llm: rows }, ["Judge: test"]);
    expect(md).toContain("Synthetic data.");
    expect(md).toContain("## 1. Inter-rater agreement");
    expect(md).toContain("Rules below κ 0.6 (rewrite, move to code or demote): G-18, G-20");
  });
  it("without judge verdicts, the report says the AI section was not run", () => {
    expect(renderValidationReport(gold, validateGold(gold))).toContain("Not run. Use `npm run validate:cv -- --live`");
  });
});
