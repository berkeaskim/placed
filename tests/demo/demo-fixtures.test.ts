/**
 * Task 25 demo fixtures for the FICTIONAL persona (seed/demo/ayse.json). Every fixture must:
 * - load through the same schema and post-processing the app uses (C6),
 * - be keyed exactly as the app looks it up (parseCV content hash, judge text hash + sector, job extId),
 * - stay honest: judge evidence lines are exact lines of the redacted CV (A1), the blocked tailoring run is caught
 *   and reverted by the gate, and the requirement the persona lacks stays "missing".
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ParsedCvOutput, JudgeOutput, TailoredCvFixture, ExplainOutput } from "@/lib/ai/schemas";
import { parseCV } from "@/lib/ai/parseCV";
import { judgeCvRules, mapVerdicts } from "@/lib/ai/judgeCvRules";
import { tailorCV } from "@/lib/ai/tailorCV";
import { explainMatchWithSource } from "@/lib/ai/explainMatch";
import { defendQuestions } from "@/lib/ai/defendQuestions";
import { rulesFor } from "@/lib/cv-rules";
import { textHash } from "@/lib/cv-score/cache";
import { prepareJudgeInput } from "@/lib/cv-score/pii";
import { scoreCv } from "@/lib/cv-score/run";
import { sourceChip } from "@/lib/cv-score/present";
import { runTailoring } from "@/lib/tailor/run";
import { caughtNumbers } from "@/lib/tailor/view";
import { computeCoverage, cvSkillSource, jdRequirementSkills } from "@/lib/scoring/coverage";
import { assignIds } from "@/lib/cv/ids";
import type { JobListItem } from "@/lib/db/queries";
import type { ParsedCV } from "@/lib/types";
import {
  DEMO_CV_PATH, DEMO_JOB_EXT_ID, DEMO_PASS_JOB_EXT_ID, DEMO_PERSONA_PATH, DEMO_SECTORS,
  demoTextHash, judgeFixtureKey, parseFixtureKey, uploadedRawText,
} from "@/lib/demo/fixture-keys";

const persona = JSON.parse(readFileSync(DEMO_PERSONA_PATH, "utf8")) as ParsedCV;
const pdf = new Uint8Array(readFileSync(DEMO_CV_PATH));
const fixture = (fn: string, key: string) => path.join("fixtures", "ai", fn, `${key}.json`);
const readJson = (p: string) => JSON.parse(readFileSync(p, "utf8"));

type SeedJob = Record<string, unknown> & { ext_id: string };
function seedJob(extId: string): JobListItem {
  const j = (JSON.parse(readFileSync("seed/jobs.json", "utf8")) as SeedJob[]).find((x) => x.ext_id === extId);
  if (!j) throw new Error(`job ${extId} is not in seed/jobs.json`);
  return {
    id: "00000000-0000-4000-8000-000000000001", extId: j.ext_id, title: j.title as string, url: j.url as string,
    location: j.location as string, remote: j.remote as boolean, deadline: j.deadline as string | null, postedAt: j.posted_at as string | null,
    archetype: j.archetype as JobListItem["archetype"], yearEligibility: j.year_eligibility as JobListItem["yearEligibility"],
    sponsorsVisa: j.sponsors_visa as JobListItem["sponsorsVisa"], employmentType: j.employment_type as JobListItem["employmentType"],
    firstYearFriendly: j.first_year_friendly as boolean, cohortClash: false, requirements: j.requirements as JobListItem["requirements"],
    textLines: j.text_lines as string[], summary: j.summary as string, company: "Lendable",
  };
}

let rawText = "";
const savedMode = process.env.AI_MODE;
beforeAll(async () => {
  process.env.AI_MODE = "fixture";
  const r = await uploadedRawText(pdf);
  expect(r.flagged).toBe(false);
  rawText = r.text;
});
afterAll(() => {
  if (savedMode === undefined) delete process.env.AI_MODE;
  else process.env.AI_MODE = savedMode;
});

describe("persona (fictional, spec §12)", () => {
  it("is a valid parseCV output with fictional-only contact details", () => {
    const cv = ParsedCvOutput.parse(persona);
    expect(cv.name).toBe("Ayşe Demir");
    expect(cv.email).toMatch(/@example\.com$/); // RFC 2606 reserved domain
    expect(cv.phone).toMatch(/^\+44 7700 900\d{3}$/); // Ofcom drama range
    expect(cv.yearGuess).toBe("2nd");
    expect(cv.archetypes.map((a) => a.key)).toEqual([...DEMO_SECTORS]);
  });
  it("ids are exactly what parseCV's assignIds produces (fixtures reference them)", () => {
    expect(assignIds(persona)).toEqual(persona);
  });
  it("keeps the deliberate weak spot: an unquantified events bullet", () => {
    expect(persona.leadership[0].bullets[0].text).toBe("Organised weekly society events");
  });
});

describe("demo CV PDF + parseCV fixture", () => {
  it("the PDF's text layer keeps the Unicode name", () => {
    expect(rawText).toContain("Ayşe Demir");
    expect(rawText).toContain("Organised weekly society events");
  });
  it("parseCV in fixture mode returns the persona for the committed PDF (upload's fixture key)", async () => {
    const key = parseFixtureKey(pdf);
    expect(existsSync(fixture("parseCV", key))).toBe(true);
    const got = await parseCV({ base64: Buffer.from(pdf).toString("base64"), text: rawText, fixtureKey: key });
    expect(got).toEqual(persona);
  });
});

describe("judgeCvRules demo fixtures (A1, hand-labelled)", () => {
  it("demoTextHash is lib/cv-score/cache.ts textHash", () => {
    const red = prepareJudgeInput(persona, rawText).redactedText;
    expect(demoTextHash(red)).toBe(textHash(red));
  });

  describe.each(DEMO_SECTORS)("%s", (sector) => {
    const key = () => judgeFixtureKey(persona, rawText, sector);
    it("exists under the key scoreCv looks up, and parses", () => {
      expect(existsSync(fixture("judgeCvRules", key()))).toBe(true);
      JudgeOutput.parse(readJson(fixture("judgeCvRules", key())));
    });
    it("every verdict is for an llm rule of this sector and every evidence line is a substring of the redacted CV", () => {
      const raw = JudgeOutput.parse(readJson(fixture("judgeCvRules", key())));
      const llm = rulesFor(sector).filter((r) => r.check === "llm");
      const ids = new Set(llm.map((r) => r.id));
      for (const v of raw.verdicts) expect(ids.has(v.rule_id), v.rule_id).toBe(true);
      const red = prepareJudgeInput(persona, rawText).redactedText;
      const mapped = mapVerdicts(raw, llm, red);
      expect(mapped.filter((r) => r.status === "could_not_assess")).toEqual([]);
      const byId = new Map(mapped.map((r) => [r.ruleId, r.status]));
      for (const v of raw.verdicts) expect(byId.get(v.rule_id), v.rule_id).toBe(v.status);
    });
    it("has the cited quick win: GEN-03 fails on the unquantified events bullet with a real-number placeholder", () => {
      const raw = JudgeOutput.parse(readJson(fixture("judgeCvRules", key())));
      const v = raw.verdicts.find((x) => x.rule_id === "GEN-03");
      expect(v).toMatchObject({ status: "fail", evidence_line: "Organised weekly society events" });
      expect(v?.fix).toMatch(/\[add your real number\]/);
    });
    it("judgeCvRules (fixture mode) replays it and marks it cacheable", async () => {
      const j = prepareJudgeInput(persona, rawText);
      const r = await judgeCvRules({ redactedText: j.redactedText, structuredText: j.structuredText, rules: rulesFor(sector), fixtureKey: key() });
      expect(r.cacheable).toBe(true);
      expect(r.results.find((x) => x.ruleId === "GEN-03")).toMatchObject({ status: "fail", evidenceLine: "Organised weekly society events" });
    });
  });

  it("scoreCv end to end (fixture mode): the GEN-03 fix carries its evidence line and a citation chip", async () => {
    const row = { id: "cv1", user_id: "u1", raw_text: rawText, page_texts: [rawText], page_count: 1, file_size: pdf.byteLength, parsed_json: { ...persona, safety: { verdict: "clean", issues: [] } } };
    const upserts: Record<string, unknown>[] = [];
    const from = (table: string) => {
      const b = {
        select: () => b, eq: () => b, limit: () => b, order: () => b,
        single: async () => (table === "cvs" ? { data: row, error: null } : { data: null, error: { message: "nf" } }),
        maybeSingle: async () => ({ data: null, error: null }),
        upsert: async (r: Record<string, unknown>) => (upserts.push(r), { error: null }),
      };
      return b;
    };
    const score = await scoreCv({ from } as unknown as SupabaseClient, { userId: "u1", cvId: "cv1", sector: "data_analytics", year: "2nd" }, { from } as unknown as SupabaseClient);
    const fix = score.fixes.find((f) => f.ruleId === "GEN-03");
    expect(fix?.evidenceLine).toBe("Organised weekly society events");
    expect(sourceChip(fix!).label).toMatch(/^Source: /);
    expect(upserts[0].model_id).not.toBeNull(); // a real verdict set: cached
  });
});

describe("tailorCV demo fixtures (real Lendable postings from seed/jobs.json)", () => {
  it("both fixtures load through the lenient fixture schema", () => {
    for (const k of [DEMO_JOB_EXT_ID, DEMO_PASS_JOB_EXT_ID]) TailoredCvFixture.parse(readJson(fixture("tailorCV", k)));
  });

  it("the demo job's requirements include one the persona genuinely lacks", () => {
    const job = seedJob(DEMO_JOB_EXT_ID);
    const cov = computeCoverage(jdRequirementSkills(job.textLines, job.requirements), cvSkillSource(persona));
    expect(cov.items.filter((i) => i.status === "gap").map((i) => i.skill)).toEqual(["Case Interviews"]);
  });

  it("BLOCKED run: the invented 20% and the AWS→Azure swap are caught, retried once, then reverted to the original lines", async () => {
    const o = await runTailoring({ cv: persona, rawText, job: seedJob(DEMO_JOB_EXT_ID), confirmedFacts: [], tailor: tailorCV });
    expect(o.usedFallback).toBe(false);
    expect(o.attempts).toBe(2);
    expect(o.report.verdict).not.toBe("block");
    expect(o.fellBackToOriginal).toBe(false);
    const byId = new Map(o.reverted.map((r) => [r.bulletId, r]));
    expect(byId.get("p0-b0")).toMatchObject({ attempted: expect.stringContaining("Reduced regressions by 20%"), restored: "Used Python and SQL to collect and clean 1,200 rental listings" });
    expect(byId.get("p0-b2")).toMatchObject({ attempted: "Ran the collection script weekly on Azure", restored: "Ran the collection script weekly on AWS" });
    expect(o.unconfirmedNumbers).toContain("20%");
    expect(caughtNumbers(o).map((c) => c.claim)).toEqual(["20%"]);
    const text = JSON.stringify(o.tailored);
    expect(text).not.toContain("Azure");
    expect(text).not.toContain("20%");
    // honest gap stays open, and the confirm-this-number placeholder survives for the XP moment
    expect(o.tailoredFor.find((t) => t.skill === "Case Interviews")?.state).toBe("missing");
    expect(o.report.gapsStillOpen).toContain("Case Interviews");
    expect(o.needsNumber.map((n) => n.bulletId)).toEqual(["l0-b0"]);
  });

  it("the blocked fixture really is blocked by the gate on its own (verdict block before the revert)", async () => {
    const { verifyTailoring } = await import("@/lib/verify/tailoring");
    const { normalizeTailored } = await import("@/lib/ai/tailorCV");
    const t = normalizeTailored(TailoredCvFixture.parse(readJson(fixture("tailorCV", DEMO_JOB_EXT_ID))), persona);
    const r = verifyTailoring({ source: persona, sourceText: rawText, confirmedFacts: [], tailored: t, jdKeywords: ["Python", "SQL", "Case Interviews"], coverageBefore: 0.67, coverageAfter: 0.67 });
    expect(r.verdict).toBe("block");
    const blocked = r.issues.filter((i) => i.severity === "block");
    expect(blocked.some((i) => i.bulletId === "p0-b0" && /20%/.test(i.claim))).toBe(true);
    expect(blocked.some((i) => i.bulletId === "p0-b2" && /Azure/.test(i.claim))).toBe(true);
  });

  it("PASSED run: no gate block on the first attempt, nothing reverted, the gap still shown", async () => {
    const o = await runTailoring({ cv: persona, rawText, job: seedJob(DEMO_PASS_JOB_EXT_ID), confirmedFacts: [], tailor: tailorCV });
    expect(o.usedFallback).toBe(false);
    expect(o.attempts).toBe(1);
    expect(o.report.verdict).not.toBe("block");
    expect(o.reverted).toEqual([]);
    expect(o.changes.map((c) => c.bulletId)).toEqual(expect.arrayContaining(["p0-b0", "l0-b0", "skills"]));
    expect(o.tailoredFor.find((t) => t.skill === "Case Interviews")?.state).toBe("missing");
  });
});

describe("explainMatch + defendQuestions demo fixtures", () => {
  it.each([DEMO_JOB_EXT_ID, DEMO_PASS_JOB_EXT_ID])("explainMatch %s: Python/SQL strong with a verified quote, case study missing with a gap", async (ext) => {
    ExplainOutput.parse(readJson(fixture("explainMatch", ext)));
    const job = seedJob(ext);
    const coverage = computeCoverage(jdRequirementSkills(job.textLines, job.requirements), cvSkillSource(persona));
    const student = { year: "2nd", field: "Economics", locationPref: ["London"], needsVisa: false, archetypes: persona.archetypes, skills: [] } as never;
    const { explanation, source } = await explainMatchWithSource({ cv: persona, cvText: rawText, student, job, coverage });
    expect(source).toBe("fixture");
    const strong = explanation.rows.filter((r) => r.match === "strong");
    // One requirement line naming Python and SQL: tagJob's two per-skill rows are shown as one (mergeSameText).
    expect(strong.length).toBe(1);
    expect(strong[0].skill?.split(", ").sort()).toEqual(["Python", "SQL"]);
    for (const r of strong) expect(r.cvEvidence).toBe("Used Python and SQL to collect and clean 1,200 rental listings");
    const missing = explanation.rows.find((r) => r.match === "missing");
    expect(missing?.skill).toBe("Case Interviews");
    expect(explanation.gaps.map((g) => g.requirement)).toContain(missing!.text);
  });

  it("defendQuestions uses the job's fixture, one question per accepted line", async () => {
    const bullets = [
      { id: "l0-b0", before: "Organised weekly society events", after: "Organised weekly society events for 40 members" },
      { id: "p0-b0", before: "Used Python and SQL to collect and clean 1,200 rental listings", after: "Collected and cleaned 1,200 rental listings using Python and SQL" },
    ];
    const r = await defendQuestions({ bullets, jobTitle: "Credit Analyst Intern (June 2027)", company: "Lendable", fixtureKey: DEMO_JOB_EXT_ID });
    expect(r.questions.map((q) => q.bulletId)).toEqual(["l0-b0", "p0-b0"]);
    expect(r.questions[0].question).toMatch(/weekly events/);
  });
});
