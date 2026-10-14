import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ARCHETYPES, type ParsedCV } from "@/lib/types";
import { LI_DIMENSION_WEIGHTS, LI_RULES, LI_SOURCES, checkableFromPdf, liRulesFor } from "@/lib/linkedin-rules";
import { parseLinkedInExport, type ParsedLinkedIn } from "@/lib/linkedin/parse-export";
import { LI_CHECKERS, runLiCodeChecks } from "@/lib/linkedin-score/checkers";
import { crossCheckDates, sameOrg } from "@/lib/linkedin-score/cross-check";
import { aggregateLiScore, CRITICAL_CAP_LABEL, EMPTY_PROFILE_CAP_LABEL, liLabel } from "@/lib/linkedin-score/aggregate";
import { isNearlyEmpty, scoreLinkedIn } from "@/lib/linkedin-score/score";
import type { LiContext } from "@/lib/linkedin-score/context";
import type { LiJudgeInput, LiJudgeResult } from "@/lib/ai/judgeLinkedIn";
import { isJudged } from "@/lib/ai/judgeLinkedIn";

const TEXT = readFileSync(path.join(__dirname, "fixtures", "ayse-synthetic-export.txt"), "utf8");
const AYSE_CV = JSON.parse(readFileSync(path.join(process.cwd(), "seed", "demo", "ayse.json"), "utf8")) as ParsedCV;
const TODAY = new Date("2026-10-14T12:00:00Z");
const li = parseLinkedInExport(TEXT, { knownName: "Ayşe Demir" });
const ctx = (over: Partial<ParsedLinkedIn> = {}, c: Partial<LiContext> = {}): LiContext => ({
  li: { ...li, ...over }, text: TEXT, cv: AYSE_CV, sector: "data_analytics", year: "2nd", today: TODAY, ...c,
});
const check = (id: string, c: LiContext) => LI_CHECKERS[id](c, liRulesFor(c.sector).find((r) => r.id === id) ?? LI_RULES.find((r) => r.id === id)! as never);
/** Judge stub: every judged rule passes or is n/a; no AI in tests. */
const naJudge = async (i: LiJudgeInput): Promise<LiJudgeResult> => ({
  results: i.rules.map((r) => ({ ruleId: r.id, status: "not_applicable", evidenceLine: null, fix: null })), spellingErrors: [], modelId: "stub", cacheable: false,
});

describe("rules.json", () => {
  it("every sector weight row sums to 100 with presence at 0", () => {
    for (const a of ARCHETYPES) {
      const w = LI_DIMENSION_WEIGHTS[a];
      expect(Object.values(w).reduce((n, x) => n + x, 0), a).toBe(100);
      expect(w.presence).toBe(0);
    }
  });
  it("every sourceId resolves", () => {
    const ids = new Set(LI_SOURCES.map((s) => s.id));
    for (const r of LI_RULES) for (const s of r.sourceIds) expect(ids.has(s), `${r.id} → ${s}`).toBe(true);
  });
  it("every PDF-checkable code rule has a checker (contested skill-count rules excepted)", () => {
    const missing = LI_RULES.filter((r) => r.check === "code" && !r.advisory && checkableFromPdf(r) && !r.pdfContested && !LI_CHECKERS[r.id]).map((r) => r.id);
    expect(missing).toEqual([]);
  });
  it("replacedBy drops the generic rule for that sector only", () => {
    expect(liRulesFor("software_eng").some((r) => r.id === "LI-GEN-05")).toBe(false);
    expect(liRulesFor("software_eng").some((r) => r.id === "LI-SOFTWARE_ENG-02")).toBe(true);
    expect(liRulesFor("consulting").some((r) => r.id === "LI-GEN-18")).toBe(false);
    expect(liRulesFor("finance_banking").find((r) => r.id === "LI-GEN-18")?.params?.threshold).toBe(450);
  });
  it("every judged rule has a question", () => {
    for (const a of ARCHETYPES) for (const r of liRulesFor(a).filter(isJudged)) expect(r.llmGuidance ?? r.statement, r.id).toBeTruthy();
  });
});

describe("code checkers on the synthetic export", () => {
  it("flags the default URL suffix, the thin About and the office-tool top skill", () => {
    expect(check("LI-GEN-11", ctx()).status).toBe("fail");
    expect(check("LI-GEN-18", ctx()).status).toBe("fail");
    expect(check("LI-GEN-10", ctx()).status).toBe("pass");
    expect(check("LI-DATA_ANALYTICS-03", ctx()).status).toBe("fail");
    expect(check("LI-DATA_ANALYTICS-07", ctx()).status).toBe("fail");
    expect(check("LI-SOFTWARE_ENG-06", ctx({}, { sector: "software_eng" })).status).toBe("fail");
  });
  it("passes a custom URL and a portfolio link", () => {
    expect(check("LI-GEN-11", ctx({ profileUrl: "www.linkedin.com/in/ayse-demir" })).status).toBe("pass");
    expect(check("LI-DATA_ANALYTICS-07", ctx({ links: ["github.com/aysedemir"] })).status).toBe("pass");
  });
  it("CFA wording follows CFA Institute rules", () => {
    expect(check("LI-FINANCE_BANKING-04", ctx({ headline: "Economics @ UCL | CFA Level I candidate" }, { sector: "finance_banking" })).status).toBe("fail");
    expect(check("LI-FINANCE_BANKING-04", ctx({ headline: "Economics @ UCL | Passed Level I of the CFA Program" }, { sector: "finance_banking" })).status).toBe("pass");
  });
  it("keyword stuffing and emoji names fail", () => {
    expect(check("LI-GEN-08", ctx({ headline: "Python | SQL | Excel | Tableau | Power BI | Data" })).status).toBe("fail");
    expect(check("LI-GEN-12", ctx({ name: "Ayşe Demir 🚀 Open to work" })).status).toBe("fail");
    expect(check("LI-GEN-12", ctx({ name: "Ayşe Demir" })).status).toBe("pass");
  });
  it("quant competition without a rank fails, with a rank passes, absent is n/a", () => {
    const q = { sector: "quant_trading" as const };
    expect(check("LI-QUANT_TRADING-03", ctx({ honors: ["UKMT Senior Mathematical Challenge"] }, q)).status).toBe("fail");
    expect(check("LI-QUANT_TRADING-03", ctx({ honors: ["UKMT Senior Mathematical Challenge: Gold, top 1%"] }, q)).status).toBe("pass");
    expect(check("LI-QUANT_TRADING-03", ctx({ honors: [], about: "", experience: [] }, q)).status).toBe("not_applicable");
  });
  it("advisory rules are never run as code checks", () => {
    const ids = runLiCodeChecks(liRulesFor("data_analytics"), ctx()).map((r) => r.ruleId);
    expect(ids).not.toContain("LI-GEN-24");
  });
});

describe("CV cross-check", () => {
  it("matches organisations loosely", () => {
    expect(sameOrg("J.P. Morgan", "J.P. Morgan Chase & Co.")).toBe(true);
    expect(sameOrg("Marlowe Café", "Marlowe Cafe Ltd")).toBe(true);
    expect(sameOrg("Barclays", "HSBC UK")).toBe(false);
    expect(sameOrg("UCL Finance Society", "UCL Economics Society")).toBe(false);
    expect(sameOrg("Google", "Google Developer Student Club")).toBe(false);
  });
  it("catches the society start-date contradiction (CV 2025, LinkedIn Sep 2024)", () => {
    const m = crossCheckDates(AYSE_CV, li.experience);
    expect(m).toHaveLength(1);
    expect(m[0]).toMatchObject({ company: "UCL Finance Society", linkedin: "September 2024 - Present (2 years 2 months)" });
  });
  it("does not flag a role that matches one of several CV roles at the same organisation", () => {
    const cv = { ...AYSE_CV, leadership: [...AYSE_CV.leadership, { ...AYSE_CV.leadership[0], id: "l1", title: "Member", dates: "Sep 2024 – present" }] };
    expect(crossCheckDates(cv, li.experience)).toEqual([]);
  });
});

describe("aggregate", () => {
  const rules = liRulesFor("data_analytics");
  it("labels by band", () => {
    expect([liLabel(85), liLabel(70), liLabel(59), liLabel(20)]).toEqual(["Ready", "Nearly there", "Needs work", "Starter"]);
  });
  it("a critical fail caps at 59 and leads the fix list as a risk", () => {
    const results = rules.filter((r) => r.dimension !== "presence").map((r) => ({ ruleId: r.id, status: r.id === "LI-GEN-01" ? "fail" as const : "pass" as const, evidenceLine: null, fix: null }));
    const s = aggregateLiScore({ rules, results, sector: "data_analytics", year: "penultimate", facts: { nearlyEmpty: false } });
    expect(s.total).toBe(59);
    expect(s.capsApplied).toEqual([CRITICAL_CAP_LABEL]);
    expect(s.fixes[0]).toMatchObject({ ruleId: "LI-GEN-01", risk: true });
  });
  it("the empty-profile cap applies from penultimate year only", () => {
    const results = rules.slice(0, 3).map((r) => ({ ruleId: r.id, status: "pass" as const, evidenceLine: null, fix: null }));
    expect(aggregateLiScore({ rules, results, sector: "data_analytics", year: "final", facts: { nearlyEmpty: true } }).capsApplied).toContain(EMPTY_PROFILE_CAP_LABEL);
    expect(aggregateLiScore({ rules, results, sector: "data_analytics", year: "2nd", facts: { nearlyEmpty: true } }).capsApplied).toEqual([]);
  });
  it("presence never moves the score", () => {
    const presence = rules.filter((r) => r.dimension === "presence").map((r) => ({ ruleId: r.id, status: "fail" as const, evidenceLine: null, fix: null }));
    const pass = rules.filter((r) => r.dimension === "proof").slice(0, 1).map((r) => ({ ruleId: r.id, status: "pass" as const, evidenceLine: null, fix: null }));
    expect(aggregateLiScore({ rules, results: [...pass, ...presence], sector: "data_analytics", year: "2nd", facts: { nearlyEmpty: false } }).total).toBe(100);
  });
});

describe("scoreLinkedIn end to end (stub judge)", () => {
  it("scores the demo persona: date contradiction caps at 59, tips separate, uncovered rules counted", async () => {
    const s = await scoreLinkedIn({ li, rawText: TEXT, cv: AYSE_CV, sector: "data_analytics", year: "2nd", today: TODAY, judge: naJudge });
    expect(s.total).toBeLessThanOrEqual(59);
    expect(s.capsApplied).toContain(CRITICAL_CAP_LABEL);
    expect(s.fixes[0].ruleId).toBe("LI-GEN-01");
    expect(s.fixes[0].fix).toContain("Which is right?");
    expect(s.tips.length).toBeGreaterThan(0);
    expect(s.notCovered).toBeGreaterThan(0);
    expect(s.importance.level).toBe("medium");
  });
  it("without a CV the cross-check rules are not applicable", async () => {
    const s = await scoreLinkedIn({ li, rawText: TEXT, cv: null, sector: "data_analytics", year: "2nd", today: TODAY, judge: naJudge });
    expect(s.results.find((r) => r.ruleId === "LI-GEN-01")?.status).toBe("not_applicable");
    expect(s.capsApplied).not.toContain(CRITICAL_CAP_LABEL);
  });
  it("the judge never sees the email or the profile slug", async () => {
    let seen: LiJudgeInput | null = null;
    await scoreLinkedIn({ li, rawText: TEXT, cv: AYSE_CV, sector: "data_analytics", year: "2nd", today: TODAY, judge: async (i) => { seen = i; return naJudge(i); } });
    const all = `${seen!.redactedText}\n${seen!.structuredText}\n${seen!.cvText}`;
    expect(all).not.toContain("ayse.demir.demo@example.com");
    expect(all).not.toContain("ayse-demir-4b7a91c2");
    expect(all).not.toContain("Ayşe Demir");
  });
  it("a 1st-year near-empty profile is not capped as empty", () => {
    expect(isNearlyEmpty(li)).toBe(false);
    expect(isNearlyEmpty({ ...li, about: null, experience: [] })).toBe(true);
  });
});
