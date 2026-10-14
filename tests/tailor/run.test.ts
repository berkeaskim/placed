import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runTailoring, reverifyEdits, NEEDS_NUMBER, renderView } from "@/lib/tailor/run";
import { toTailored, verifyTailoring } from "@/lib/verify/tailoring";
import { heuristicTailor } from "@/lib/ai/heuristics";
import type { ParsedCV, TailoredCV } from "@/lib/types";
import type { JobListItem } from "@/lib/db/queries";

const cv: ParsedCV = {
  name: "A", email: "a@b.co", phone: null, location: null, links: [], summary: null,
  education: [{ id: "e0", institution: "UCL", degree: "BSc Economics", dates: "", grade: "2:1", details: [{ id: "e0-d0", text: "Modules: Econometrics (Stata)" }] }],
  experience: [{ id: "x0", org: "Society", title: "Officer", dates: "", location: "", bullets: [{ id: "x0-b0", text: "Used Excel to track 200 tickets" }] }],
  projects: [], leadership: [], skills: [{ group: "Skills", items: ["Excel"] }], interests: null, sectionOrder: [], yearGuess: null, archetypes: [],
};
const rawText = "Used Excel to track 200 tickets\nModules: Econometrics (Stata)\nExcel";
const job = {
  id: "j", extId: "j", company: "Acme", url: "https://x", summary: "", title: "Analyst Intern", location: "London", remote: false,
  archetype: "data_analytics", yearEligibility: [], sponsorsVisa: "unknown", employmentType: "internship", firstYearFriendly: false,
  requirements: [], textLines: ["## Requirements", "- Excel", "- Stata", "- Tableau"], deadline: null, postedAt: null,
} as unknown as JobListItem;

function dishonestModel() {
  return vi.fn(async () => {
    const t = toTailored(cv);
    t.experience[0].bullets[0] = { id: "x0-b0", text: "Built Tableau dashboards tracking 200 tickets", sourceRefs: ["x0-b0"], changeType: "rephrased" };
    t.skills = [{ group: "Skills", items: ["Excel", "Stata", "Tableau"] }];
    return t;
  });
}

describe("runTailoring (brief Step 1: dishonest fake model)", () => {
  it("never ships a blocked CV: retries once, then reverts fabrications", async () => {
    const dishonest = dishonestModel();
    const out = await runTailoring({ cv, rawText, job, confirmedFacts: [], tailor: dishonest as never });
    expect(dishonest).toHaveBeenCalledTimes(2);
    expect(out.report.verdict).not.toBe("block");
    expect(out.tailored.skills[0].items).toEqual(["Excel", "Stata"]);
    expect(out.tailored.experience[0].bullets[0].text).toBe("Used Excel to track 200 tickets");
    expect(out.reverted.length).toBeGreaterThan(0);
    // Stata moved from prose (supported) to the skills list → surfaced; Tableau stays a gap → missing
    expect(out.tailoredFor.find((t) => t.skill === "Stata")!.state).toBe("surfaced");
    expect(out.tailoredFor.find((t) => t.skill === "Tableau")!.state).toBe("missing");
    expect(out.coverageAfter!).toBeGreaterThan(out.coverageBefore!);
  });

  it("re-prompts with the offending claims, and never sends a gap skill as allowed", async () => {
    const dishonest = dishonestModel();
    await runTailoring({ cv, rawText, job, confirmedFacts: [], tailor: dishonest as never });
    const calls = dishonest.mock.calls as unknown as [{ allowed: string[]; supported: string[]; feedback: string[] | null }][];
    const first = calls[0][0], second = calls[1][0];
    expect(first.allowed).toEqual(expect.arrayContaining(["Excel", "Stata"]));
    expect(first.allowed).not.toContain("Tableau");
    expect(first.supported).toEqual(["Stata"]);
    expect(first.feedback).toBeNull();
    expect(second.feedback!.join(" ")).toMatch(/Tableau/);
  });

  it("the reverted list shows what was attempted and what now stands", async () => {
    const out = await runTailoring({ cv, rawText, job, confirmedFacts: [], tailor: dishonestModel() as never });
    const r = out.reverted.find((x) => x.bulletId === "x0-b0")!;
    expect(r.attempted).toBe("Built Tableau dashboards tracking 200 tickets");
    expect(r.restored).toBe("Used Excel to track 200 tickets");
    expect(r.reason.length).toBeGreaterThan(0);
  });

  it("an honest first answer is not retried", async () => {
    const honest = vi.fn(async () => heuristicTailor({ cv, allowed: ["Excel", "Stata"], supported: ["Stata"] }));
    const out = await runTailoring({ cv, rawText, job, confirmedFacts: [], tailor: honest as never });
    expect(honest).toHaveBeenCalledTimes(1);
    expect(out.report.verdict).not.toBe("block");
    expect(out.reverted).toEqual([]);
  });

  it("falls back to the original CV when even the revert still blocks", async () => {
    const wild = vi.fn(async () => {
      const t = toTailored(cv);
      t.summary = "Former Goldman Sachs analyst with 5 years of Tableau experience";
      t.experience[0] = { ...t.experience[0], org: "Goldman Sachs", title: "Vice President" };
      return t;
    });
    const out = await runTailoring({ cv, rawText, job, confirmedFacts: [], tailor: wild as never });
    expect(out.report.verdict).not.toBe("block");
    expect(out.tailored.summary).toBeNull();
    expect(out.tailored.experience[0].org).toBe("Society");
  });
});

describe("C8: keywordCoverage and gapsStillOpen are always filled", () => {
  it("fills keywordCoverage {before, after, missing} and gapsStillOpen", async () => {
    const out = await runTailoring({ cv, rawText, job, confirmedFacts: [], tailor: dishonestModel() as never });
    expect(out.report.keywordCoverage).toBeDefined();
    expect(out.report.keywordCoverage!.before).toBe(out.coverageBefore);
    expect(out.report.keywordCoverage!.after).toBe(out.coverageAfter);
    expect(out.report.keywordCoverage!.missing).toContain("Tableau");
    expect(out.report.gapsStillOpen).toContain("Tableau");
  });
  it("still fills them when the posting lists no readable skills", async () => {
    const blank = { ...job, textLines: ["We are hiring."] } as JobListItem;
    const out = await runTailoring({ cv, rawText, job: blank, confirmedFacts: [], tailor: (async () => toTailored(cv)) as never });
    expect(out.report.keywordCoverage).toEqual({ before: 0, after: 0, missing: [] });
    expect(out.report.gapsStillOpen).toEqual([]);
  });
});

describe("C17: per-change transparency data", () => {
  it("each change carries requirement, before/after, reason, resolved source text and must/nice before → after", async () => {
    const honest = vi.fn(async (): Promise<TailoredCV> => {
      const t = toTailored(cv);
      t.experience[0].bullets[0] = { id: "x0-b0", text: "Tracked 200 tickets in Excel", sourceRefs: ["x0-b0"], changeType: "rephrased", qualifiersKept: [] };
      t.skills = [{ group: "Skills", items: ["Excel", "Stata"] }];
      t.changes = [{ bulletId: "x0-b0", before: "Used Excel to track 200 tickets", after: "Tracked 200 tickets in Excel", reason: "Leads with Excel, which the role asks for", jdRequirement: "Excel", keywordsAdded: [] }];
      return t;
    });
    const out = await runTailoring({ cv, rawText, job, confirmedFacts: [], tailor: honest as never });
    const c = out.changes.find((x) => x.bulletId === "x0-b0")!;
    expect(c).toMatchObject({
      changeType: "rephrased", jdRequirement: "Excel", before: "Used Excel to track 200 tickets", after: "Tracked 200 tickets in Excel",
      reason: "Leads with Excel, which the role asks for", sources: [{ id: "x0-b0", text: "Used Excel to track 200 tickets" }],
    });
    const s = out.changes.find((x) => x.bulletId === "skills")!;
    expect(s.after).toMatch(/Stata/);
    expect(s.sources.map((x) => x.text)).toContain("Modules: Econometrics (Stata)");
    expect(s.mustHaves.before.matched).toBeLessThanOrEqual(s.mustHaves.after.matched);
    expect(s.niceToHaves).toBeDefined();
    expect(out.mustHaves).toEqual({ before: { matched: 2, total: 3 }, after: { matched: 2, total: 3 } });
    expect(out.niceToHaves.before.total).toBe(0);
    expect(c.reason).not.toMatch(/beat the ATS|% more interviews/i);
  });
});

describe("NEEDS_NUMBER placeholder", () => {
  const withPlaceholder = async (): Promise<TailoredCV> => {
    const t = toTailored(cv);
    t.experience[0].bullets[0] = { id: "x0-b0", text: `Tracked ${NEEDS_NUMBER} tickets weekly in Excel`, sourceRefs: ["x0-b0"], changeType: "rephrased" };
    return t;
  };
  it("is listed for confirmation, gated without the placeholder, and never rendered", async () => {
    const out = await runTailoring({ cv, rawText, job, confirmedFacts: [], tailor: withPlaceholder as never });
    expect(out.report.verdict).not.toBe("block");
    expect(out.needsNumber).toEqual([{ bulletId: "x0-b0", text: `Tracked ${NEEDS_NUMBER} tickets weekly in Excel`, original: "Used Excel to track 200 tickets" }]);
    const view = renderView(out.tailored, cv);
    expect(JSON.stringify(view)).not.toContain(NEEDS_NUMBER);
    expect(view.experience[0].bullets[0].text).toBe("Used Excel to track 200 tickets");
  });
});

describe("reverifyEdits (amendment item 6)", () => {
  it("re-runs the gate on the student's final edits", async () => {
    const out = await runTailoring({ cv, rawText, job, confirmedFacts: [], tailor: (async () => toTailored(cv)) as never });
    const edited = structuredClone(out.tailored);
    edited.experience[0].bullets[0] = { id: "x0-b0", text: "Used Excel to track 200 tickets, cutting costs by 35%", sourceRefs: ["x0-b0"], changeType: "rephrased" };
    const r = reverifyEdits({ cv, rawText, job, confirmedFacts: [], tailored: edited });
    expect(r.report.verdict).toBe("block");
    expect(r.renderable).toBe(false);
    const ok = reverifyEdits({ cv, rawText, job, confirmedFacts: ["Cut costs by 35%"], tailored: edited });
    expect(ok.report.verdict).not.toBe("block");
    expect(ok.renderable).toBe(true);
    expect(ok.report.keywordCoverage).toBeDefined();
  });
  it("forces education/interests back to the source (they are never edited)", () => {
    const edited = toTailored(cv);
    edited.education = [{ ...edited.education[0], institution: "Oxford" }];
    const r = reverifyEdits({ cv, rawText, job, confirmedFacts: [], tailored: edited });
    expect(r.tailored.education[0].institution).toBe("UCL");
  });
});

describe("heuristicTailor stays honest", () => {
  it("passes the gate and surfaces supported skills", () => {
    const t = heuristicTailor({ cv, allowed: ["Excel", "Stata"], supported: ["Stata"] });
    expect(t.skills[0].items).toContain("Stata");
    const r = verifyTailoring({ source: cv, sourceText: rawText, confirmedFacts: [], tailored: t, jdKeywords: ["Excel", "Stata", "Tableau"], coverageBefore: 0.5, coverageAfter: 0.6 });
    expect(r.verdict).not.toBe("block");
  });
});

describe("never render while block (Review Focus 3)", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => vi.doUnmock("@/lib/pdf/cv-document"));
  it("renderVerifiedPdf refuses a blocked CV and renders the reverted one", async () => {
    const renderCvPdf = vi.fn(async () => Buffer.from("%PDF"));
    vi.doMock("@/lib/pdf/cv-document", () => ({ renderCvPdf }));
    const { renderVerifiedPdf, BlockedCvError } = await import("@/lib/tailor/render");
    const bad = toTailored(cv);
    bad.experience[0].bullets[0] = { id: "x0-b0", text: "Built Tableau dashboards tracking 200 tickets", sourceRefs: ["x0-b0"] };
    await expect(renderVerifiedPdf({ cv, rawText, job, confirmedFacts: [], tailored: bad })).rejects.toBeInstanceOf(BlockedCvError);
    expect(renderCvPdf).not.toHaveBeenCalled();

    const out = await runTailoring({ cv, rawText, job, confirmedFacts: [], tailor: dishonestModel() as never });
    const r = await renderVerifiedPdf({ cv, rawText, job, confirmedFacts: [], tailored: out.tailored });
    expect(r.report.verdict).not.toBe("block");
    expect(renderCvPdf).toHaveBeenCalledTimes(1);
    const rendered = (renderCvPdf.mock.calls[0] as unknown as [TailoredCV])[0];
    expect(JSON.stringify(rendered)).not.toMatch(/Tableau/);
  });
});

describe("fix round 1: fallback is surfaced, never silent", () => {
  it("usedFallback/fallbackReason come through from the tailor and are stripped from the stored CV", async () => {
    const t = vi.fn(async () => ({ ...toTailored(cv), usedFallback: true, fallbackReason: "AI unavailable" }));
    const out = await runTailoring({ cv, rawText, job, confirmedFacts: [], tailor: t as never });
    expect(out.usedFallback).toBe(true);
    expect(out.fallbackReason).toBe("AI unavailable");
    expect(out.tailored).not.toHaveProperty("usedFallback");
    expect(out.tailored).not.toHaveProperty("fallbackReason");
  });
  it("a model answer reports usedFallback false", async () => {
    const out = await runTailoring({ cv, rawText, job, confirmedFacts: [], tailor: (async () => toTailored(cv)) as never });
    expect(out.usedFallback).toBe(false);
    expect(out.fallbackReason).toBeUndefined();
  });
});
