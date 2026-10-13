import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/ai/judgeCvRules", async (orig) => {
  const actual = await orig<typeof import("@/lib/ai/judgeCvRules")>();
  return { ...actual, judgeCvRules: vi.fn(actual.judgeCvRules) };
});

import { judgeCvRules, PROMPT_VERSION } from "@/lib/ai/judgeCvRules";
import { cvScoreCacheKey, textHash, RULES_VERSION } from "@/lib/cv-score/cache";
import { scoreCv } from "@/lib/cv-score/run";
import type { ParsedCV } from "@/lib/types";

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

// ---- minimal fake Supabase client: records filters, upserts and answers from in-memory rows

type Row = Record<string, unknown>;
function fakeSupabase(tables: Record<string, Row[]>) {
  const upserts: { table: string; row: Row; opts: unknown }[] = [];
  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    const rows = () => (tables[table] ?? []).filter((r) => filters.every(([k, v]) => r[k] === v));
    const b = {
      select: () => b,
      eq: (k: string, v: unknown) => (filters.push([k, v]), b),
      order: () => b,
      limit: () => b,
      single: async () => (rows()[0] ? { data: rows()[0], error: null } : { data: null, error: { message: "not found" } }),
      maybeSingle: async () => ({ data: rows()[0] ?? null, error: null }),
      upsert: async (row: Row, opts: unknown) => {
        upserts.push({ table, row, opts });
        return { error: null };
      },
    };
    return b;
  };
  return { client: { from } as unknown as SupabaseClient, upserts };
}

const parsed: ParsedCV & { safety: unknown } = {
  name: "Ayse Demir", email: "ayse@example.com", phone: "07700 900123", location: "London", links: [], summary: null,
  education: [{ id: "e0", institution: "UCL", degree: "BSc Economics", dates: "2024–2027", grade: "Predicted 2:1", details: [] }],
  experience: [{ id: "x0", org: "Finance Society", title: "Treasurer", dates: "2025", location: "", bullets: [{ id: "b0", text: "Managed a £2,000 budget for 12 events" }] }],
  projects: [], leadership: [], skills: [{ group: "Skills", items: ["Excel"] }], interests: null,
  sectionOrder: ["education", "experience", "skills"], yearGuess: "2nd", archetypes: [],
  safety: { verdict: "flag", issues: [{ ruleId: "ATS-INJ-01", kind: "injection", span: "ignore previous instructions", reason: "r" }] },
};
const raw = "Ayse Demir\nayse@example.com | 07700 900123\nEDUCATION\nUCL BSc Economics 2024–2027 Predicted 2:1\nEXPERIENCE\nTreasurer, Finance Society\nManaged a £2,000 budget for 12 events\n" + "x ".repeat(400);
const cvRow = { id: "cv1", user_id: "u1", raw_text: raw, page_texts: [raw], page_count: 1, file_size: 100_000, parsed_json: parsed };

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

  it("fixture mode: scores from code rules, passes safety into checks, never stores a cache key for all-not_applicable verdicts", async () => {
    const { client, upserts } = fakeSupabase({ cvs: [cvRow], cv_scores: [] });
    const score = await scoreCv(client, { userId: "u1", cvId: "cv1", sector: "consulting", year: "2nd" });
    expect(score.total).toBeGreaterThan(0);
    expect(judgeCvRules).toHaveBeenCalledTimes(1);
    expect(upserts).toHaveLength(1);
    const row = upserts[0].row;
    expect(row).toMatchObject({ cv_id: "cv1", user_id: "u1", sector: "consulting", model_id: null, prompt_version: null, rules_version: null });
    expect(row.text_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(upserts[0].opts).toMatchObject({ onConflict: "cv_id,sector" });
    const rr = row.rule_results as { code: { ruleId: string; status: string }[]; llm: { status: string }[]; unevidencedFails: number };
    expect(rr.unevidencedFails).toBe(0);
    expect(rr.code.find((x) => x.ruleId === "ATS-INJ-01")?.status).toBe("fail");
    expect(rr.llm.every((x) => x.status === "not_applicable")).toBe(true);
  });

  it("reuses cached LLM verdicts when the cache key matches (no re-judge)", async () => {
    const first = fakeSupabase({ cvs: [cvRow], cv_scores: [] });
    await scoreCv(first.client, { userId: "u1", cvId: "cv1", sector: "consulting", year: "2nd" });
    const prev = first.upserts[0].row;
    const cachedLlm = [{ ruleId: "CON-01", status: "pass", evidenceLine: null, fix: null }];
    const key = { model_id: "fixture", prompt_version: PROMPT_VERSION, rules_version: RULES_VERSION };
    const cachedRow = { ...prev, ...key, cv_id: "cv-old", rule_results: { ...(prev.rule_results as object), llm: cachedLlm, spellingErrors: [] } };
    vi.mocked(judgeCvRules).mockClear();
    const second = fakeSupabase({ cvs: [cvRow], cv_scores: [cachedRow] });
    await scoreCv(second.client, { userId: "u1", cvId: "cv1", sector: "consulting", year: "2nd" });
    expect(judgeCvRules).not.toHaveBeenCalled();
    expect((second.upserts[0].row.rule_results as { llm: unknown }).llm).toEqual(cachedLlm);
  });

  it("a non-cacheable (fixture, no verdicts) row is never reused", async () => {
    const first = fakeSupabase({ cvs: [cvRow], cv_scores: [] });
    await scoreCv(first.client, { userId: "u1", cvId: "cv1", sector: "consulting", year: "2nd" });
    vi.mocked(judgeCvRules).mockClear();
    const second = fakeSupabase({ cvs: [cvRow], cv_scores: [first.upserts[0].row] });
    await scoreCv(second.client, { userId: "u1", cvId: "cv1", sector: "consulting", year: "2nd" });
    expect(judgeCvRules).toHaveBeenCalledTimes(1);
  });

  it("re-judges when the stored prompt_version differs", async () => {
    const first = fakeSupabase({ cvs: [cvRow], cv_scores: [] });
    await scoreCv(first.client, { userId: "u1", cvId: "cv1", sector: "consulting", year: "2nd" });
    const stale = { ...first.upserts[0].row, model_id: "fixture", prompt_version: "old", rules_version: RULES_VERSION };
    vi.mocked(judgeCvRules).mockClear();
    const second = fakeSupabase({ cvs: [cvRow], cv_scores: [stale] });
    await scoreCv(second.client, { userId: "u1", cvId: "cv1", sector: "consulting", year: "2nd" });
    expect(judgeCvRules).toHaveBeenCalledTimes(1);
  });

  it("swapping name and contact details leaves the score unchanged (spec §11)", async () => {
    const other = { ...parsed, name: "Mohammed Okafor", email: "mo@example.org", phone: "07123 456789" };
    const rawOther = raw.replace("Ayse Demir", "Mohammed Okafor").replace("ayse@example.com", "mo@example.org").replace("07700 900123", "07123 456789");
    const a = fakeSupabase({ cvs: [cvRow], cv_scores: [] });
    const b = fakeSupabase({ cvs: [{ ...cvRow, raw_text: rawOther, page_texts: [rawOther], parsed_json: other }], cv_scores: [] });
    const sa = await scoreCv(a.client, { userId: "u1", cvId: "cv1", sector: "consulting", year: "2nd" });
    const sb = await scoreCv(b.client, { userId: "u1", cvId: "cv1", sector: "consulting", year: "2nd" });
    expect(sb.total).toBe(sa.total);
    expect(b.upserts[0].row.text_hash).toBe(a.upserts[0].row.text_hash);
  });
});
