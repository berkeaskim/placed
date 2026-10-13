import { afterEach, describe, it, expect } from "vitest";
import { QUESTIONS, scoreQuiz } from "@/lib/quiz/questions";
import { mergeQuizWhy, quizMayWriteArchetypes, roleCards, mythLinks, ROLE_TITLES } from "@/lib/quiz/view";
import { ARCHETYPES } from "@/lib/types";

const pickFor = (key: (typeof ARCHETYPES)[number]) =>
  Object.fromEntries(QUESTIONS.map((q) => [q.id, q.options.find((o) => (o.weights[key] ?? 0) >= 2)?.id ?? q.options[0].id]));

describe("quiz", () => {
  it("has 6 questions, each with ≥4 options and unique ids", () => {
    expect(QUESTIONS).toHaveLength(6);
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(6);
    for (const q of QUESTIONS) {
      expect(q.options.length).toBeGreaterThanOrEqual(4);
      expect(new Set(q.options.map((o) => o.id)).size).toBe(q.options.length);
    }
  });

  it("scores the dominant archetype first and returns 3", () => {
    const top = scoreQuiz(pickFor("data_analytics"));
    expect(top).toHaveLength(3);
    expect(top[0].key).toBe("data_analytics");
    expect(top[0].score).toBe(100);
    expect(top[0].why.length).toBeGreaterThan(0);
  });

  it("every archetype can win the quiz", () => {
    for (const a of ARCHETYPES) expect(scoreQuiz(pickFor(a))[0].key).toBe(a);
  });

  it("never returns a 0-score archetype, gives every result a why, and caps why at 2", () => {
    for (const a of ARCHETYPES) {
      for (const r of scoreQuiz(pickFor(a))) {
        expect(r.score).toBeGreaterThan(0);
        expect(r.why.length).toBeGreaterThan(0);
        expect(r.why.length).toBeLessThanOrEqual(2);
      }
    }
  });

  it("is deterministic and ignores unknown answers", () => {
    const a = pickFor("research");
    expect(scoreQuiz(a)).toEqual(scoreQuiz({ ...a }));
    expect(scoreQuiz({})).toEqual([]);
    expect(scoreQuiz({ fun: "nope" })).toEqual([]);
  });
});

describe("mergeQuizWhy", () => {
  const ranking = scoreQuiz(pickFor("consulting"));
  it("keeps the deterministic ranking and scores, taking only AI why lines", () => {
    const ai = [
      { key: ranking[2].key, score: 99, why: ["AI line A", "AI line B", "AI line C"] },
      { key: "software_eng" as const, score: 100, why: ["not in ranking"] },
    ];
    const out = mergeQuizWhy(ranking, ai);
    expect(out.map((r) => [r.key, r.score])).toEqual(ranking.map((r) => [r.key, r.score]));
    expect(out[2].why).toEqual(["AI line A", "AI line B"]);
    expect(out[0].why).toEqual(ranking[0].why);
  });
  it("ignores blank AI lines", () => {
    const out = mergeQuizWhy(ranking, [{ key: ranking[0].key, score: 1, why: ["  ", ""] }]);
    expect(out[0].why).toEqual(ranking[0].why);
  });
});

describe("quizMayWriteArchetypes", () => {
  const text = ["x".repeat(400)];
  it("writes when there is no active CV", () => expect(quizMayWriteArchetypes(null)).toBe(true));
  it("does not overwrite CV-derived archetypes", () =>
    expect(quizMayWriteArchetypes({ page_texts: text, parsed_json: { archetypes: [{ key: "consulting", score: 70, why: [] }] } })).toBe(false));
  it("writes when the active CV is image-only or found no roles", () => {
    expect(quizMayWriteArchetypes({ page_texts: [""], parsed_json: { archetypes: [{ key: "consulting", score: 70, why: [] }] } })).toBe(true);
    expect(quizMayWriteArchetypes({ page_texts: text, parsed_json: { archetypes: [{ key: "consulting", score: 0, why: [] }] } })).toBe(true);
    expect(quizMayWriteArchetypes({ page_texts: text, parsed_json: null })).toBe(true);
  });
});

describe("roleCards", () => {
  it("sorts, drops 0-score archetypes, keeps top 3 and at most 2 why lines", () => {
    const cards = roleCards([
      { key: "research", score: 0, why: ["x"] },
      { key: "consulting", score: 40, why: ["a", "b", "c"] },
      { key: "data_analytics", score: 92, why: ["d"] },
      { key: "product", score: 60, why: [] },
      { key: "software_eng", score: 30, why: ["e"] },
    ]);
    expect(cards.map((c) => c.key)).toEqual(["data_analytics", "product", "consulting"]);
    expect(cards[0].title).toBe("Data Analyst Intern");
    expect(cards[2].why).toEqual(["a", "b"]);
    expect(cards[0].score).toBe(92);
  });
  it("clamps and rounds scores, tolerates null", () => {
    expect(roleCards(null)).toEqual([]);
    expect(roleCards([{ key: "product", score: 140.4, why: [] }])[0].score).toBe(100);
    expect(roleCards([{ key: "product", score: 0.4, why: [] }])).toEqual([]);
  });
  it("has a role title for every archetype", () => {
    for (const a of ARCHETYPES) expect(ROLE_TITLES[a]).toMatch(/Intern$/);
  });
});

describe("mythLinks", () => {
  it("extracts only http(s) URLs, labelled by host, without trailing punctuation", () => {
    const links = mythLinks("Blog (2022), https://blog.example.com/a-b; Report, http://www.x.org/r.pdf, javascript:alert(1) ftp://f.example.com");
    expect(links).toEqual([
      { href: "https://blog.example.com/a-b", label: "blog.example.com" },
      { href: "http://www.x.org/r.pdf", label: "x.org" },
    ]);
  });
  it("dedupes and returns [] when there are no links", () => {
    expect(mythLinks("Prospects (2025); LSE Careers")).toEqual([]);
    expect(mythLinks("https://a.com/x https://a.com/x")).toHaveLength(1);
  });
});

describe("quizToArchetypes (fixture mode)", () => {
  const prev = process.env.AI_MODE;
  afterEach(() => { if (prev === undefined) delete process.env.AI_MODE; else process.env.AI_MODE = prev; });
  it("falls back to the deterministic ranking plus starter skills for the top archetype", async () => {
    process.env.AI_MODE = "fixture";
    const { quizToArchetypes } = await import("@/lib/ai/quizToArchetypes");
    const answers = pickFor("software_eng");
    const r = await quizToArchetypes(answers);
    expect(r.archetypes).toEqual(scoreQuiz(answers));
    expect(r.skills.length).toBeGreaterThan(0);
    expect(r.skills.length).toBeLessThanOrEqual(5);
  });
});
