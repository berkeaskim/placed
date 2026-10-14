// tests/autopilot/drafts.test.ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { draftAnswer, gateDraft, cvBulletIndex, type DraftInput, type DraftSentence } from "@/lib/autopilot/drafts";
import type { ParsedCV } from "@/lib/types";

const cv = {
  name: "Ayşe Demir", email: null, phone: null, location: null, links: [], summary: null, skills: [], interests: null, sectionOrder: [], yearGuess: null, archetypes: [],
  education: [{ id: "ed1", institution: "UCL", degree: "BSc Economics", dates: "2025 – 2028", grade: null, details: [] }],
  experience: [{ id: "x1", org: "UCL Economics Society", title: "Events Officer", dates: "2025 – present", location: "London",
    bullets: [{ id: "x1b1", text: "Organised weekly society events using Excel to analyse attendance" }, { id: "x1b2", text: "Helped run a 3-day fundraising campaign" }] }],
  projects: [], leadership: [],
} as unknown as ParsedCV;
const base: DraftInput = { question: "Why Monzo? (100 word limit)", wordLimit: 100, company: "Monzo", jobExtId: "8232726", fieldKey: "question_69481992",
  jdLines: ["Monzo has over 13 million customers", "You'll work with our Data team on pricing"], cv, facts: [{ id: "f1", claim: "Organised weekly society events for 40 members" }] };

afterEach(() => vi.unstubAllEnvs());

describe("gateDraft", () => {
  it("keeps sourced sentences and counts words", () => {
    const r = gateDraft([
      { text: "Monzo has over 13 million customers, and I want to help them through data.", about: "them", refs: ["jd:0"] },
      { text: "As Events Officer I used Excel to analyse attendance at weekly events for 40 members.", about: "me", refs: ["x1b1", "fact:f1"] },
    ], base);
    expect(r.caught).toEqual([]);
    expect(r.sentences).toHaveLength(2);
    expect(r.words).toBe(r.text.split(/\s+/).length);
  });
  it("removes unsourced, fabricated-number, sibling-tool and invented-fact sentences", () => {
    const r = gateDraft([
      { text: "I am passionate about fintech.", about: "me", refs: [] },
      { text: "I analysed attendance for 400 members.", about: "me", refs: ["x1b1"] },
      { text: "I used Google Sheets to analyse attendance at weekly events.", about: "me", refs: ["x1b1"] },
      { text: "Monzo has 20 million customers in Europe.", about: "them", refs: ["jd:0"] },
      { text: "I led a 3-day fundraising campaign.", about: "me", refs: ["x1b2"] },
    ], base);
    expect(r.sentences).toHaveLength(0);
    expect(r.caught.map((c) => c.reason)).toEqual(["no source", "unsupported number", "tool not on your CV", "not in the job post", "overstates your role"]);
  });
  it("drops trailing sentences over the word limit and flags thin drafts", () => {
    const long = Array.from({ length: 12 }, () => ({ text: "I organised weekly society events using Excel to analyse attendance.", about: "me" as const, refs: ["x1b1"] }));
    const r = gateDraft(long, { ...base, wordLimit: 30 });
    expect(r.words).toBeLessThanOrEqual(30);
    const thin = gateDraft([long[0]], { ...base, wordLimit: 250 });
    expect(thin.thin).toBe(true);
  });
  it("indexes every CV bullet id", () => {
    expect([...cvBulletIndex(cv).keys()].sort()).toEqual(["x1b1", "x1b2"]);
  });
});

describe("demo fixture: Monzo 'Why Monzo?' for Ayşe", () => {
  it("catches exactly the swapped-tool sentence and keeps three", async () => {
    const { readFileSync } = await import("node:fs");
    const ayse = JSON.parse(readFileSync("seed/demo/ayse.json", "utf8")) as ParsedCV;
    const jobs = JSON.parse(readFileSync("seed/jobs.json", "utf8")) as { ext_id: string | number; text_lines: string[] }[];
    const monzo = jobs.find((j) => String(j.ext_id) === "8232726")!;
    const fx = JSON.parse(readFileSync("fixtures/ai/autopilotDraft/8232726-question_69481992.json", "utf8")) as { sentences: DraftSentence[] };
    const r = gateDraft(fx.sentences, { ...base, cv: ayse, jdLines: monzo.text_lines, facts: [], wordLimit: 250 });
    expect(r.caught).toHaveLength(1);
    expect(r.caught[0].reason).toBe("tool not on your CV");
    expect(r.sentences).toHaveLength(3);
    expect(r.words).toBeLessThan(250);
  });
  it("draftAnswer in fixture mode returns the gated fixture", async () => {
    const { readFileSync } = await import("node:fs");
    const ayse = JSON.parse(readFileSync("seed/demo/ayse.json", "utf8")) as ParsedCV;
    const jobs = JSON.parse(readFileSync("seed/jobs.json", "utf8")) as { ext_id: string | number; text_lines: string[] }[];
    const monzo = jobs.find((j) => String(j.ext_id) === "8232726")!;
    vi.stubEnv("AI_MODE", "fixture");
    const r = await draftAnswer({ ...base, cv: ayse, jdLines: monzo.text_lines, facts: [], wordLimit: 250 });
    expect(r.source).toBe("fixture");
    expect(r.caught).toHaveLength(1);
    expect(r.sentences).toHaveLength(3);
  });
});

describe("gateDraft: invented facts in first-person sentences", () => {
  const me = (text: string, refs = ["x1b1"]): DraftSentence => ({ text, about: "me", refs });
  const why = (s: DraftSentence, i: DraftInput = base) => { const r = gateDraft([s], i); return r.caught.map((c) => c.reason); };
  it.each([
    ["employer", "During my internship at Goldman Sachs I organised weekly events using Excel to track attendance."],
    ["employer 2", "I organised weekly society events using Excel to track attendance for the Bank of England."],
    ["title", "As President of the society I organised weekly events using Excel to track attendance."],
    ["institution", "I hold a first-class degree from Oxford."],
    ["tool Python", "I organised weekly society events using Python to track attendance."],
    ["tool SQL", "I organised weekly society events using SQL to track attendance."],
    ["intensifier", "I single-handedly organised weekly society events using Excel to track attendance."],
  ])("catches an invented %s", (_n, text) => {
    expect(why(me(text))).toHaveLength(1);
  });
  it("catches Revolut on Ayşe's real CV and keeps the honest version", async () => {
    const { readFileSync } = await import("node:fs");
    const ayse = JSON.parse(readFileSync("seed/demo/ayse.json", "utf8")) as ParsedCV;
    const ab = { ...base, cv: ayse, facts: [] };
    expect(why(me("At Revolut I used Python and SQL to clean 1,200 rental listings.", ["p0-b0"]), ab)).toHaveLength(1);
    expect(why(me("I used Python and SQL to collect and clean 1,200 rental listings.", ["p0-b0"]), ab)).toEqual([]);
  });
  it("catches a sentence with an unresolvable ref instead of dropping the ref", () => {
    expect(why(me("I organised weekly society events using Excel to track attendance.", ["x1b1", "bogus"]))).toEqual(["bad source"]);
  });
});

describe("gateDraft: sentences about the employer", () => {
  const them = (text: string, refs = ["jd:0"]): DraftSentence => ({ text, about: "them", refs });
  const why = (s: DraftSentence) => gateDraft([s], base).caught.map((c) => c.reason);
  it("matches whole tokens and number units", () => {
    expect(why(them("Monzo has 1 million customers."))).toEqual(["not in the job post"]);
    expect(why(them("Monzo has 10 million customers."))).toEqual(["not in the job post"]);
    expect(why(them("Monzo has over 13 million customers and operates in the US."))).toEqual(["not in the job post"]);
    expect(why(them("Monzo has over 13 million customers."))).toEqual([]);
  });
  it("checks the first word too", () => {
    expect(why(them("Revolut acquired Monzo."))).toEqual(["not in the job post"]);
    expect(why(them("The company has over 13 million customers."))).toEqual([]);
  });
  it("catches lowercase superlatives and claims not in the cited line", () => {
    expect(why(them("Monzo is the largest bank in the UK."))).toEqual(["not in the job post"]);
    expect(why(them("Monzo is profitable."))).toEqual(["not in the job post"]);
  });
  it("judges claims about the student inside an employer sentence", () => {
    expect(why(them("Monzo has over 13 million customers, and I have three years of banking experience."))).toHaveLength(1);
  });
});
