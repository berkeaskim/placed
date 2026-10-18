import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/ai/judgeCvRules", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/judgeCvRules")>();
  return { ...actual, judgeCvRules: vi.fn(actual.judgeCvRules) };
});

import { judgeCvRules, PROMPT_VERSION } from "@/lib/ai/judgeCvRules";
import { cvScoreCacheKey, textHash, RULES_VERSION } from "@/lib/cv-score/cache";
import { scoreCv } from "@/lib/cv-score/run";
import type { ParsedCV } from "@/lib/types";
import { db } from "@/lib/db/client";
import { cvScores, cvs } from "@/lib/db/schema";
import { LOCAL_USER_ID } from "@/lib/auth/local-user";
import { seedCv, withTempDb } from "../cv/temp-db";
import { rulesFor } from "@/lib/cv-rules";
import { prepareJudgeInput } from "@/lib/cv-score/pii";
import { putFile } from "@/lib/files";

describe("cache key (R2)", () => {
  const k = { textHash: textHash("abc"), sector: "consulting" as const, rulesVersion: RULES_VERSION, modelId: "anthropic:claude-sonnet-5-5", promptVersion: PROMPT_VERSION };
  it("is stable and whitespace-insensitive in the text hash", () => {
    expect(textHash("a  b\n c")).toBe(textHash("a b c"));
    expect(cvScoreCacheKey(k)).toBe(cvScoreCacheKey({ ...k }));
  });
  it("changes when prompt_version, model, sector, rules or text change", () => {
    const base = cvScoreCacheKey(k);
    expect(cvScoreCacheKey({ ...k, promptVersion: k.promptVersion + "-next" })).not.toBe(base);
    expect(cvScoreCacheKey({ ...k, modelId: "gemini:x" })).not.toBe(base);
    expect(cvScoreCacheKey({ ...k, sector: "software_eng" })).not.toBe(base);
    expect(cvScoreCacheKey({ ...k, rulesVersion: "r-other" })).not.toBe(base);
    expect(cvScoreCacheKey({ ...k, textHash: textHash("abd") })).not.toBe(base);
  });
});

// ---- real temp SQLite: the scored CV, plus whatever cv_scores rows a test seeds

withTempDb();
const U = LOCAL_USER_ID;
type ScoreRow = typeof cvScores.$inferSelect;
const rows = () => db.select().from(cvScores).all();
const only = (): ScoreRow => { const r = rows(); expect(r).toHaveLength(1); return r[0]; };
function seed(cv: Partial<typeof cvs.$inferInsert> = {}, scoreRows: Partial<typeof cvScores.$inferInsert>[] = []): string {
  db.delete(cvScores).run();
  db.delete(cvs).run();
  const id = seedCv({ raw_text: raw, page_texts: [raw], page_count: 1, file_size: 100_000, parsed_json: parsed as never, ...cv }).id;
  for (const r of scoreRows) {
    const old = seedCv({ raw_text: raw, parsed_json: parsed as never, is_active: false }).id;
    db.insert(cvScores).values({ user_id: U, sector: "consulting", total: 1, dimensions: {}, rule_results: {}, ...r, cv_id: old } as typeof cvScores.$inferInsert).run();
  }
  return id;
}
const run = (cvId: string, userId = U) => scoreCv({ userId, cvId, sector: "consulting", year: "2nd" });

const parsed: ParsedCV & { safety: unknown } = {
  name: "Ayse Demir", email: "ayse@example.com", phone: "07700 900123", location: "London", links: [], summary: null,
  education: [{ id: "e0", institution: "UCL", degree: "BSc Economics", dates: "2024–2027", grade: "Predicted 2:1", details: [] }],
  experience: [{ id: "x0", org: "Finance Society", title: "Treasurer", dates: "2025", location: "", bullets: [{ id: "b0", text: "Managed a £2,000 budget for 12 events" }] }],
  projects: [], leadership: [], skills: [{ group: "Skills", items: ["Excel"] }], interests: null,
  sectionOrder: ["education", "experience", "skills"], yearGuess: "2nd", archetypes: [],
  safety: { verdict: "flag", issues: [{ ruleId: "ATS-INJ-01", kind: "injection", span: "ignore previous instructions", reason: "r" }] },
};
const raw = "Ayse Demir\nayse@example.com | 07700 900123\nEDUCATION\nUCL BSc Economics 2024–2027 Predicted 2:1\nEXPERIENCE\nTreasurer, Finance Society\nManaged a £2,000 budget for 12 events\n" + "x ".repeat(400);

describe("scoreCv", () => {
  const saved = process.env.AI_MODE;
  beforeEach(() => {
    process.env.AI_MODE = "fixture";
    vi.mocked(judgeCvRules).mockClear();
  });
  afterEach(() => {
    if (saved === undefined) delete process.env.AI_MODE;
    else process.env.AI_MODE = saved;
  });

  it("keeps one row per track: scoring on the spring track never overwrites the standard score", async () => {
    const id = seed();
    const standard = await run(id);
    const spring = await scoreCv({ userId: U, cvId: id, sector: "consulting", year: "1st", track: "spring" });
    const all = rows();
    expect(all.map((r) => r.track).sort()).toEqual(["spring", "standard"]);
    expect(all.find((r) => r.track === "standard")?.total).toBe(standard.total);
    expect(all.find((r) => r.track === "spring")?.total).toBe(spring.total);
    // The spring judge call gets the spring rule set (SPR rules in, FIN-04/G-33 out).
    const springRules = vi.mocked(judgeCvRules).mock.calls.at(-1)![0].rules.map((r) => r.id);
    expect(springRules).toContain("SPR-04");
    expect(springRules).not.toContain("G-33");
  });

  it("fixture mode: scores from code rules, passes safety into checks, never stores a cache key when no verdicts were obtained", async () => {
    const id = seed();
    const score = await run(id);
    expect(score.total).toBeGreaterThan(0);
    expect(judgeCvRules).toHaveBeenCalledTimes(1);
    const row = only();
    expect(row).toMatchObject({ cv_id: id, user_id: U, sector: "consulting", model_id: null, prompt_version: null, rules_version: null, total: score.total });
    expect(row.text_hash).toMatch(/^[0-9a-f]{64}$/);
    const rr = row.rule_results as { code: { ruleId: string; status: string }[]; llm: { status: string }[]; unevidencedFails: number };
    expect(rr.unevidencedFails).toBe(0);
    expect(rr.code.find((x) => x.ruleId === "ATS-INJ-01")?.status).toBe("fail");
    // No verdicts: judged rules are could_not_assess (audit 04#1), except rules that need a job advert.
    expect(rr.llm.every((x) => x.status === "could_not_assess" || (x.status === "not_applicable" && (x as { detail?: string }).detail?.startsWith("needs:")))).toBe(true);
    expect(score.provisional).toBe(true);
  });

  it("upserts one row per cv × sector and keeps created_at on a rescore", async () => {
    const id = seed();
    await run(id);
    const first = only();
    await run(id);
    expect(only()).toMatchObject({ id: first.id, created_at: first.created_at });
  });

  it("reuses cached LLM verdicts when the cache key matches (no re-judge)", async () => {
    let id = seed();
    await run(id);
    const prev = only();
    const cachedLlm = [{ ruleId: "CON-01", status: "pass", evidenceLine: null, fix: null }];
    const key = { model_id: "fixture", prompt_version: PROMPT_VERSION, rules_version: RULES_VERSION };
    vi.mocked(judgeCvRules).mockClear();
    id = seed({}, [{ text_hash: prev.text_hash, ...key, rule_results: { ...(prev.rule_results as object), llm: cachedLlm, spellingErrors: [] } }]);
    await run(id);
    expect(judgeCvRules).not.toHaveBeenCalled();
    const fresh = rows().find((r) => r.cv_id === id)!;
    expect((fresh.rule_results as { llm: unknown }).llm).toEqual(cachedLlm);
  });

  it("a non-cacheable (fixture, no verdicts) row is never reused", async () => {
    let id = seed();
    await run(id);
    const prev = only();
    vi.mocked(judgeCvRules).mockClear();
    id = seed({}, [{ ...prev, id: undefined, cv_id: undefined }]);
    await run(id);
    expect(judgeCvRules).toHaveBeenCalledTimes(1);
  });

  it("judge unavailable: stores the code-only score without a cache key and flags aiUnavailable", async () => {
    vi.mocked(judgeCvRules).mockResolvedValueOnce({ results: [], spellingErrors: null, modelId: "anthropic:claude-sonnet-5-5", cacheable: false, aiUnavailable: true });
    const score = await run(seed());
    expect(score.aiUnavailable).toBe(true);
    const row = only();
    expect(row).toMatchObject({ model_id: null, prompt_version: null, rules_version: null });
    expect((row.rule_results as { aiUnavailable?: boolean }).aiUnavailable).toBe(true);
  });

  it("re-judges when the stored prompt_version differs", async () => {
    let id = seed();
    await run(id);
    const prev = only();
    vi.mocked(judgeCvRules).mockClear();
    id = seed({}, [{ ...prev, id: undefined, cv_id: undefined, model_id: "fixture", prompt_version: "old", rules_version: RULES_VERSION }]);
    await run(id);
    expect(judgeCvRules).toHaveBeenCalledTimes(1);
  });

  it("swapping name and contact details leaves the score unchanged (spec §11)", async () => {
    const other = { ...parsed, name: "Mohammed Okafor", email: "mo@example.org", phone: "07123 456789" };
    const rawOther = raw.replace("Ayse Demir", "Mohammed Okafor").replace("ayse@example.com", "mo@example.org").replace("07700 900123", "07123 456789");
    const sa = await run(seed());
    const ha = only().text_hash;
    const sb = await run(seed({ raw_text: rawOther, page_texts: [rawOther], parsed_json: other as never }));
    expect(sb.total).toBe(sa.total);
    expect(only().text_hash).toBe(ha);
  });

  it("never writes when the CV isn't the caller's", async () => {
    const id = seed({ user_id: "someone-else" });
    await expect(run(id)).rejects.toThrow(/CV not found/);
    expect(rows()).toEqual([]);
  });
});

// Audit 04#9 / #30: a one-character typo fix must not re-roll unrelated verdicts.
describe("scoreCv delta re-judging", () => {
  const saved = process.env.AI_MODE;
  beforeEach(() => { process.env.AI_MODE = "fixture"; vi.mocked(judgeCvRules).mockClear(); });
  afterEach(() => { if (saved === undefined) delete process.env.AI_MODE; else process.env.AI_MODE = saved; });

  const TYPO = "Manged a £2,000 budget for 12 events";
  const withBullet = (b: string) => ({
    parsed: { ...parsed, experience: [{ ...parsed.experience[0], bullets: [{ id: "b0", text: b }] }] },
    raw: raw.replace("Managed a £2,000 budget for 12 events", b),
  });
  const consultingLlm = () => rulesFor("consulting").filter((r) => r.check === "llm").map((r) => r.id);

  /** An earlier CV (with the typo) scored by the "fixture" model: every judged rule passed, quoting an untouched line. */
  function seedEarlier(over: { model_id?: string; judgeYear?: string } = {}) {
    db.delete(cvScores).run();
    db.delete(cvs).run();
    const e = withBullet(TYPO);
    const old = seedCv({ raw_text: e.raw, page_texts: [e.raw], page_count: 1, file_size: 100_000, parsed_json: e.parsed as never, is_active: false }).id;
    const hash = textHash(prepareJudgeInput(e.parsed as ParsedCV, e.raw).redactedText);
    const llm = consultingLlm().map((ruleId) => ({ ruleId, status: "pass", evidenceLine: ruleId === "CON-03" ? TYPO : "Treasurer, Finance Society", fix: null }));
    db.insert(cvScores).values({
      user_id: U, cv_id: old, sector: "consulting", total: 80, dimensions: {},
      rule_results: { code: [], llm, spellingErrors: ["Manged"], judgeYear: over.judgeYear ?? "2nd", scoredBy: "fixture" },
      text_hash: hash, model_id: over.model_id ?? "fixture", prompt_version: PROMPT_VERSION, rules_version: RULES_VERSION,
    } as typeof cvScores.$inferInsert).run();
    const now = withBullet("Managed a £2,000 budget for 12 events");
    return seedCv({ raw_text: now.raw, page_texts: [now.raw], page_count: 1, file_size: 100_000, parsed_json: now.parsed as never }).id;
  }

  it("re-judges only the rules the fix could affect and keeps every other verdict", async () => {
    const id = seedEarlier();
    await run(id);
    expect(judgeCvRules).toHaveBeenCalledTimes(1);
    const call = vi.mocked(judgeCvRules).mock.calls[0][0];
    const reused = new Set((call.reuse ?? []).map((r) => r.ruleId));
    // Kept: passes whose quoted line is untouched, on rules that aren't about wording.
    expect(reused.has("G-21")).toBe(true);
    expect(reused.has("G-12")).toBe(true);
    expect(reused.has("CON-11")).toBe(true);
    // Re-judged: the rule that quoted the fixed line, and rules about wording.
    expect(reused.has("CON-03")).toBe(false);
    expect(reused.has("G-20")).toBe(false);
    expect(reused.has("G-26")).toBe(false);
    expect(reused.size).toBeGreaterThan(consultingLlm().length / 2);
    const row = rows().find((r) => r.cv_id === id)!;
    const rr = row.rule_results as { delta?: { reused: number; rejudged: number; cosmetic: boolean }; llm: { ruleId: string; status: string }[] };
    // Offered verdicts for rules preset by context (a job advert is needed) don't count: the preset wins.
    expect(rr.delta).toMatchObject({ cosmetic: true });
    expect(rr.delta!.reused).toBeGreaterThan(consultingLlm().length / 2);
    expect(rr.delta!.reused).toBeLessThanOrEqual(reused.size);
    expect(rr.delta!.rejudged).toBeGreaterThan(0);
    expect(rr.llm.find((r) => r.ruleId === "G-21")?.status).toBe("pass");
  });

  it("a different model or year of study re-judges everything (cache invalidation still wins)", async () => {
    await run(seedEarlier({ model_id: "anthropic:claude-sonnet-5-5" }));
    expect(vi.mocked(judgeCvRules).mock.calls[0][0].reuse).toBeUndefined();
    vi.mocked(judgeCvRules).mockClear();
    await run(seedEarlier({ judgeYear: "final" }));
    expect(vi.mocked(judgeCvRules).mock.calls[0][0].reuse).toBeUndefined();
  });

  it("never reuses another user's verdicts", async () => {
    const id = seedEarlier();
    db.update(cvScores).set({ user_id: "someone-else" }).run();
    await run(id);
    expect(vi.mocked(judgeCvRules).mock.calls[0][0].reuse).toBeUndefined();
  });
});

// Audit 04#28: a CV rendered by Placed's tailor is flagged when it's scored.
describe("scoreCv provenance", () => {
  const saved = process.env.AI_MODE;
  beforeEach(() => { process.env.AI_MODE = "fixture"; });
  afterEach(() => { if (saved === undefined) delete process.env.AI_MODE; else process.env.AI_MODE = saved; });

  it("records madeByPlaced when the stored PDF carries Placed's tailor stamp, and not otherwise", async () => {
    await putFile("cvs", `${U}/placed.pdf`, new TextEncoder().encode("%PDF-1.4\n<< /Creator (Placed) /Producer (Placed) >>\n"), "application/pdf");
    await putFile("cvs", `${U}/word.pdf`, new TextEncoder().encode("%PDF-1.7\n<< /Creator (Microsoft Word) /Producer (macOS) >>\n"), "application/pdf");
    const tailored = await run(seed({ storage_path: `${U}/placed.pdf` }));
    expect(tailored.madeByPlaced).toBe(true);
    expect((only().rule_results as { madeByPlaced?: boolean }).madeByPlaced).toBe(true);
    const own = await run(seed({ storage_path: `${U}/word.pdf` }));
    expect(own.madeByPlaced).toBe(false);
    expect((only().rule_results as { madeByPlaced?: boolean }).madeByPlaced).toBeUndefined();
    // A missing file is just "not known to be tailored".
    expect((await run(seed({ storage_path: `${U}/missing.pdf` }))).madeByPlaced).toBe(false);
  });
});
