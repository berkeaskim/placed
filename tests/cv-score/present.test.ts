import { describe, it, expect } from "vitest";
import {
  scoreBand, splitFixes, isConvention, sourceChip, sparklinePoints, rulesPassedLabel, couldntAssessLabel,
  disclaimer, capBanners, historyTotals, IMAGE_ONLY_CAP_COPY, sparklineLabel,
} from "@/lib/cv-score/present";
import { SECTOR_CAVEATS } from "@/lib/cv-rules/profiles";
import { ARCHETYPES } from "@/lib/types";
import { IMAGE_ONLY_CAP, type Fix } from "@/lib/cv-score/aggregate";

const fix = (ruleId: string, lostPoints: number, over: Partial<Fix> = {}): Fix => ({
  ruleId, statement: `why ${ruleId}`, dimension: "impact", lostPoints, gain: lostPoints, evidenceLine: null, fix: null,
  citation: { title: "t", publisher: "Prospects", year: "2025", url: "https://prospects.ac.uk/x" }, evidence: "A", convention: false, ...over,
});

describe("scoreBand", () => {
  it.each([
    [0, "Needs work"], [49, "Needs work"], [50, "Developing"], [69, "Developing"],
    [70, "Strong"], [84, "Strong"], [85, "Polished"], [100, "Polished"],
  ])("%i → %s", (total, label) => expect(scoreBand(total).label).toBe(label));
});

describe("splitFixes", () => {
  it("picks the highest lostPoints fix as next best, rest keep order and are capped", () => {
    const fixes = [fix("A", 3), fix("B", 9), fix("C", 5), fix("D", 1), fix("E", 2), fix("F", 4)];
    const { next, rest } = splitFixes(fixes, 4);
    expect(next?.ruleId).toBe("B");
    expect(rest.map((f) => f.ruleId)).toEqual(["C", "F", "A", "E"]);
  });
  it("breaks ties by ruleId (deterministic)", () => {
    expect(splitFixes([fix("Z", 5), fix("M", 5)]).next?.ruleId).toBe("M");
  });
  it("empty → null next", () => {
    expect(splitFixes([])).toEqual({ next: null, rest: [] });
  });
  it("does not mutate the input", () => {
    const fixes = [fix("A", 1), fix("B", 2)];
    splitFixes(fixes);
    expect(fixes.map((f) => f.ruleId)).toEqual(["A", "B"]);
  });
});

describe("isConvention", () => {
  it("C and D are conventions, A and B are not (from evidence, not the stored flag)", () => {
    expect(isConvention(fix("x", 1, { evidence: "C" }))).toBe(true);
    expect(isConvention(fix("x", 1, { evidence: "D" }))).toBe(true);
    expect(isConvention(fix("x", 1, { evidence: "A", convention: true }))).toBe(false);
    expect(isConvention(fix("x", 1, { evidence: "B" }))).toBe(false);
  });
});

describe("sourceChip", () => {
  it("cited → publisher + grade + url", () => {
    expect(sourceChip(fix("x", 1, { evidence: "B" }))).toEqual({ label: "Source: Prospects · Evidence B", href: "https://prospects.ac.uk/x" });
  });
  it("no citation → common practice, no link", () => {
    expect(sourceChip(fix("x", 1, { citation: null, evidence: "D" }))).toEqual({ label: "Common practice · Evidence D", href: null });
  });
  it("non-http citation url is not linked", () => {
    const f = fix("x", 1, { citation: { title: "t", publisher: "P", year: "2025", url: "javascript:alert(1)" } });
    expect(sourceChip(f).href).toBeNull();
  });
});

describe("sparklinePoints", () => {
  it("hides with fewer than 2 points", () => {
    expect(sparklinePoints([], 80, 24)).toBeNull();
    expect(sparklinePoints([60], 80, 24)).toBeNull();
  });
  it("maps 0–100 onto the box, first x=0 last x=width, higher score higher up", () => {
    expect(sparklinePoints([0, 100], 80, 24)).toBe("0,24 80,0");
    expect(sparklinePoints([50, 25, 75], 80, 20)).toBe("0,10 40,15 80,5");
  });
  it("clamps out-of-range totals", () => {
    expect(sparklinePoints([-10, 120], 10, 10)).toBe("0,10 10,0");
  });
});

describe("sparklineLabel", () => {
  it("summarises first, latest and count", () => expect(sparklineLabel([55, 61, 68])).toBe("Score history: first 55, latest 68, 3 points"));
});

describe("historyTotals", () => {
  it("orders by CV upload time then score time, oldest first", () => {
    const rows = [
      { total: 70, created_at: "2026-10-12T10:00:00Z", cvs: { uploaded_at: "2026-10-12T09:00:00Z" } },
      { total: 50, created_at: "2026-10-13T10:00:00Z", cvs: { uploaded_at: "2026-10-01T09:00:00Z" } },
      { total: 60, created_at: "2026-10-05T10:00:00Z", cvs: null },
    ];
    expect(historyTotals(rows)).toEqual([50, 60, 70]);
  });
});

describe("labels", () => {
  it("rules passed", () => expect(rulesPassedLabel(23, 31)).toBe("Rules passed 23/31"));
  it("couldn't assess note only when > 0", () => {
    expect(couldntAssessLabel(0)).toBeNull();
    expect(couldntAssessLabel(2)).toBe("2 couldn't assess");
  });
  it("disclaimer copy is exact", () => {
    expect(disclaimer("consulting")).toBe(
      "Measures how well your CV follows evidence-based conventions for Consulting. It does not predict whether you'll get an interview.",
    );
  });
});

describe("capBanners", () => {
  it("keeps every cap; image-only cap links to the quiz", () => {
    const b = capBanners([IMAGE_ONLY_CAP, "No phone or email: capped at 40"]);
    expect(b).toHaveLength(2);
    expect(b[0]).toEqual({ text: "Image-only PDF: capped at 50", imageOnly: true });
    expect(b[1].imageOnly).toBe(false);
    expect(capBanners(["image-only something else"])[0].imageOnly).toBe(false);
    expect(IMAGE_ONLY_CAP_COPY).toBe("We couldn't read this CV — try another file or take the quiz");
  });
});

describe("SECTOR_CAVEATS", () => {
  it("only known sectors, non-empty single-line copy", () => {
    for (const [k, v] of Object.entries(SECTOR_CAVEATS)) {
      expect(ARCHETYPES).toContain(k);
      expect(typeof v).toBe("string");
      expect(v!.trim().length).toBeGreaterThan(20);
      expect(v).not.toMatch(/\n/);
    }
  });
  it("exact copy (research-backed; changing it must be deliberate) and only form-led sectors", () => {
    expect(SECTOR_CAVEATS).toEqual({
      consulting:
        "Big 4 firms screen mainly via application forms and online tests — your CV matters less at that stage. MBB firms still screen on the CV.",
      finance_banking:
        "Big 4 and many insight or spring-week schemes screen mainly via application forms and online tests — your CV matters less at that stage. Banks still screen on the CV.",
      engineering:
        "Some engineering employers don't read a CV at first: Mott MacDonald's UK placements use an application form and a strengths test instead. Defence and nuclear roles also need security vetting, which is an eligibility check, not part of this score.",
    });
  });
});
