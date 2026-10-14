import { describe, expect, it } from "vitest";
import { diffStats, lineDiff, type DiffPart } from "@/lib/tailor/diff";

const side = (parts: DiffPart[], keep: "del" | "add") => parts.filter((p) => p.op === "same" || p.op === keep).map((p) => p.text).join(" ");
const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).join(" ");

describe("lineDiff (word-level before → after for the tailoring screen)", () => {
  it("returns one unchanged part for identical lines", () => {
    expect(lineDiff("Led a team of 4", "Led a team of 4")).toEqual([{ op: "same", text: "Led a team of 4" }]);
  });

  it("marks appended words as added", () => {
    expect(lineDiff("Built dashboards in Excel", "Built dashboards in Excel and SQL")).toEqual([
      { op: "same", text: "Built dashboards in Excel" },
      { op: "add", text: "and SQL" },
    ]);
  });

  it("marks removed words as deleted", () => {
    expect(lineDiff("Organised weekly society events for members", "Organised weekly society events")).toEqual([
      { op: "same", text: "Organised weekly society events" },
      { op: "del", text: "for members" },
    ]);
  });

  it("shows a replaced word as deleted then added, keeping the shared words", () => {
    expect(lineDiff("Made dashboards in Excel", "Built dashboards in Excel")).toEqual([
      { op: "del", text: "Made" },
      { op: "add", text: "Built" },
      { op: "same", text: "dashboards in Excel" },
    ]);
  });

  it("treats punctuation attached to a word as part of it", () => {
    const d = lineDiff("Python, SQL", "Python, SQL, Tableau");
    expect(side(d, "del")).toBe("Python, SQL");
    expect(side(d, "add")).toBe("Python, SQL, Tableau");
    expect(d).toEqual([{ op: "same", text: "Python," }, { op: "del", text: "SQL" }, { op: "add", text: "SQL, Tableau" }]);
  });

  it("an empty before is all added; an empty after (left out) is all deleted", () => {
    expect(lineDiff("", "New line here")).toEqual([{ op: "add", text: "New line here" }]);
    expect(lineDiff("Old line here", "")).toEqual([{ op: "del", text: "Old line here" }]);
    expect(lineDiff("  ", "")).toEqual([]);
  });

  it("ignores whitespace-only differences", () => {
    expect(lineDiff("Led  a\nteam", "Led a team")).toEqual([{ op: "same", text: "Led a team" }]);
  });

  it("always reconstructs both sides exactly (word-normalised)", () => {
    const pairs: [string, string][] = [
      ["Analysed survey data from 120 respondents using Excel", "Analysed 120 survey responses in Excel to find churn drivers"],
      ["Helped run the society's social media", "Ran the society's Instagram and TikTok, posting weekly"],
      ["a b c d e f", "f e d c b a"],
      ["x NEEDS_NUMBER y", "x y"],
    ];
    for (const [b, a] of pairs) {
      const d = lineDiff(b, a);
      expect(side(d, "del")).toBe(words(b));
      expect(side(d, "add")).toBe(words(a));
      for (let i = 1; i < d.length; i++) expect(d[i].op).not.toBe(d[i - 1].op); // runs are merged
    }
  });

  it("falls back to whole-line delete + add for very long lines (bounded work)", () => {
    const b = Array.from({ length: 400 }, (_, i) => `w${i}`).join(" ");
    const a = Array.from({ length: 400 }, (_, i) => `v${i}`).join(" ");
    expect(lineDiff(b, a)).toEqual([{ op: "del", text: b }, { op: "add", text: a }]);
  });
});

describe("diffStats", () => {
  it("counts removed and added words", () => {
    expect(diffStats(lineDiff("Made dashboards in Excel", "Built Tableau dashboards in Excel"))).toEqual({ removed: 1, added: 2 });
    expect(diffStats(lineDiff("same", "same"))).toEqual({ removed: 0, added: 0 });
  });
});
