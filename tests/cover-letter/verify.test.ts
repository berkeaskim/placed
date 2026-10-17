import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { canMarkReady } from "@/lib/cover-letter/gate";
import { judgeSentences, repair, verifyOutput } from "@/lib/cover-letter/verify";
import type { Span } from "@/lib/cover-letter/types";
import { FIXTURE_ANSWERS, FIXTURE_FACTS, fixtureDraftInput, parseMarked } from "./fixtures";

const SAL = "Dear Northbridge Graduate Recruitment Team,\n\n";
const OPEN = "I am applying for the 2027 Summer Analyst Programme in Markets at Northbridge Capital.⟦them:jd⟧ ";
const CLOSE = "\n\nYours faithfully,\nAlex Morgan";
const letter = (body: string) => parseMarked(SAL + OPEN + body + CLOSE);
const verify = (body: string, over = {}) => {
  const m = letter(body);
  return { ...m, ...verifyOutput({ ...m, input: fixtureDraftInput(over), ownSpans: [] }) };
};
const flagged = (spans: Span[]) => spans.filter((s) => s.kind === "ai" && s.flag);
const at = (text: string, s: Span) => text.slice(s.start, s.end);

describe("verifyOutput", () => {
  it("accepts the first name alone after a short note's sign-off", () => {
    const m = parseMarked("Hello,\n\nI ran the trading desk of a £50k student investment fund.⟦me:x1-b0⟧\n\nBest wishes,\nAlex");
    const r = verifyOutput({ ...m, input: fixtureDraftInput({ mode: "short_note" }), ownSpans: [] });
    expect(flagged(r.spans).map((s) => s.flag)).not.toContain("check the sign-off");
  });

  it("flags a number that is not in any source", () => {
    const r = verify("I ran the trading desk of a £50k student investment fund with 12 traders.⟦me:x1-b0⟧");
    const f = flagged(r.spans);
    expect(f).toHaveLength(1);
    expect(at(r.text, f[0])).toContain("12 traders");
    expect(f[0].flag).toBe("unsupported number");
  });

  it("keeps a sourced number and accepts refs in any case", () => {
    const r = verify("I ran the trading desk of a £50k student investment fund.⟦ME:X1-B0⟧");
    expect(flagged(r.spans)).toEqual([]);
    expect(r.spans.some((s) => s.refs.includes("x1-b0"))).toBe(true);
  });

  it("blocks another employer's name with CL-21", () => {
    const r = verify("Rival Capital also runs a rates desk.⟦them:jd⟧");
    expect(r.lint.some((h) => h.ruleId === "CL-21" && h.severity === "block")).toBe(true);
  });

  it("lets a past employer from the CV be named even if it is a rival", () => {
    const r = verify("At Cafe Lune I trained 4 new staff on the till.⟦me:x2-b0⟧", {
      evidence: { ...fixtureDraftInput().evidence, rivals: ["Cafe Lune"] },
    });
    expect(r.lint.some((h) => h.ruleId === "CL-21")).toBe(false);
  });

  it("flags a ⟦you⟧ sentence that paraphrases the answer", () => {
    const r = verify("Northbridge drew me in because summer analysts own risk from week one.⟦you:a1⟧");
    const f = flagged(r.spans);
    expect(f).toHaveLength(1);
    expect(f[0].flag).toBe("changed your words");
    expect(r.spans.some((s) => s.kind === "theirs")).toBe(false);
  });

  it("marks a verbatim ⟦you⟧ answer as theirs, tolerating case and whitespace", () => {
    const a1 = FIXTURE_ANSWERS[0].text!;
    const r = verify(`${a1.toLowerCase().replace(/ /g, "  ")}⟦you:a1⟧`);
    const theirs = r.spans.filter((s) => s.kind === "theirs");
    expect(theirs).toHaveLength(1);
    expect(at(r.text, theirs[0]).replace(/\s+/g, " ").toLowerCase()).toBe(a1.toLowerCase());
    expect(flagged(r.spans)).toEqual([]);
  });

  it("checks the AI-written words around a quoted answer", () => {
    const a3 = FIXTURE_ANSWERS[2].text!;
    const ok = verify(`At the Warwick Trading Challenge ${a3[0].toLowerCase()}${a3.slice(1)}⟦you:a3⟧`);
    expect(ok.spans.filter((s) => s.kind === "theirs")).toHaveLength(1);
    expect(flagged(ok.spans)).toEqual([]);
    const bad = verify(`After winning 9 awards, ${a3[0].toLowerCase()}${a3.slice(1)}⟦you:a3⟧`);
    expect(bad.spans.filter((s) => s.kind === "theirs")).toHaveLength(1);
    expect(flagged(bad.spans)).toHaveLength(1);
    expect(at(bad.text, flagged(bad.spans)[0])).toContain("9 awards");
  });

  it("accepts one whole sentence of a longer answer, never a fragment", () => {
    const two = { id: "a1", question: "why_firm" as const, text: "I met your rates team at a UCL panel. They did not trade flow." };
    const over = { answers: [two] };
    const whole = verify("They did not trade flow.⟦you:a1⟧", over);
    expect(whole.spans.filter((s) => s.kind === "theirs").map((s) => at(whole.text, s))).toEqual(["They did not trade flow."]);
    const fragment = verify("Trade flow.⟦you:a1⟧", over);
    expect(flagged(fragment.spans).map((s) => s.flag)).toEqual(["changed your words"]);
  });

  it("a claim cannot hide in the salutation or the signature", () => {
    const m = parseMarked("Hi, I managed 12 traders\n\n" + OPEN + "\n\nYours faithfully,\nI led 9 desks");
    const r = verifyOutput({ ...m, input: fixtureDraftInput(), ownSpans: [] });
    expect(flagged(r.spans).map((s) => at(m.text, s))).toEqual(["Hi, I managed 12 traders", "Yours faithfully,\nI led 9 desks"]);
  });

  it("flags a courtesy sentence that slips in a firm claim", () => {
    const r = verify("Your bank is the largest in the country.⟦me:⟧");
    expect(flagged(r.spans)).toHaveLength(1);
    expect(flagged(verify("Thank you for considering my application.⟦me:⟧").spans)).toEqual([]);
  });

  it("flags a them-sentence citing a fact the student did not pick", () => {
    const r = verify(`Northbridge advised on the largest UK renewable-energy infrastructure refinancing of the year.⟦them:${FIXTURE_FACTS[1].id}⟧`);
    expect(flagged(r.spans)).toHaveLength(1);
  });

  it("supports a them-sentence from a picked fact and flags an invented one", () => {
    const ok = verify(`Your new structured-finance desk in Frankfurt is hiring 40 analysts.⟦them:${FIXTURE_FACTS[0].id}⟧`);
    expect(flagged(ok.spans)).toEqual([]);
    const bad = verify(`Your new desk in Paris is hiring 40 analysts.⟦them:${FIXTURE_FACTS[0].id}⟧`);
    expect(flagged(bad.spans)).toHaveLength(1);
  });

  it("flags a them-sentence that could be about any firm", () => {
    const r = verify("You value integrity, collaboration and excellence.⟦them:jd⟧");
    expect(flagged(r.spans).map((s) => s.flag)).toEqual(["would work for any firm"]);
  });

  it("flags an unmarked sentence but not the salutation or sign-off", () => {
    const r = verify("I have always admired your culture.");
    const f = flagged(r.spans);
    expect(f).toHaveLength(1);
    expect(at(r.text, f[0])).toBe("I have always admired your culture.");
  });

  it("does not re-check text the student already owns", () => {
    const m = letter("I once traded 999 contracts in a day.⟦me:x1-b0⟧");
    const start = m.text.indexOf("I once");
    const own: Span = { start, end: start + "I once traded 999 contracts in a day.".length, kind: "theirs", refs: [] };
    const r = verifyOutput({ ...m, input: fixtureDraftInput(), ownSpans: [own] });
    expect(flagged(r.spans)).toEqual([]);
    expect(r.spans).toContainEqual(own);
  });

  it("grounds the default fixture letter: one deliberate catch, answers kept verbatim", () => {
    const m = parseMarked(readFileSync("fixtures/ai/coverLetterDraft/default.txt", "utf8"));
    const r = verifyOutput({ ...m, input: fixtureDraftInput(), ownSpans: [] });
    const f = flagged(r.spans);
    expect(f.map((s) => [at(m.text, s), s.flag])).toEqual([["We placed 3rd of 62 teams.", "unsupported number"]]);
    const theirs = r.spans.filter((s) => s.kind === "theirs").map((s) => at(m.text, s));
    expect(theirs).toEqual([FIXTURE_ANSWERS[0].text, FIXTURE_ANSWERS[2].text, FIXTURE_ANSWERS[3].text]);
    expect(r.lint.filter((h) => h.severity === "block" || h.severity === "high")).toEqual([]);
  });
});

describe("repair", () => {
  it("stops after 2 rounds when the rewrite keeps inventing", async () => {
    const m = letter("I ran the trading desk of a £50k student investment fund with 12 traders.⟦me:x1-b0⟧");
    const i = { ...m, input: fixtureDraftInput(), ownSpans: [] };
    const rewrite = vi.fn(async () => "I ran the desk with 13 traders.");
    const r = await repair(i, verifyOutput(i), rewrite);
    expect(rewrite).toHaveBeenCalledTimes(2);
    expect(rewrite.mock.calls[0]).toEqual(["I ran the trading desk of a £50k student investment fund with 12 traders.", "unsupported number"]);
    expect(flagged(r.spans)).toHaveLength(1);
    expect(r.text).toContain("13 traders");
  });

  it("rewrites only the flagged sentence and keeps the student's words", async () => {
    const a1 = FIXTURE_ANSWERS[0].text!;
    const m = letter(`${a1}⟦you:a1⟧ I ran the trading desk of a £50k student investment fund with 12 traders.⟦me:x1-b0⟧`);
    const i = { ...m, input: fixtureDraftInput(), ownSpans: [] };
    const rewrite = vi.fn(async () => "I ran the trading desk of a £50k student investment fund.");
    const r = await repair(i, verifyOutput(i), rewrite);
    expect(rewrite).toHaveBeenCalledTimes(1);
    expect(flagged(r.spans)).toEqual([]);
    expect(r.text).toContain(a1);
    expect(r.text).not.toContain("12 traders");
    const theirs = r.spans.find((s) => s.kind === "theirs")!;
    expect(at(r.text, theirs)).toBe(a1);
  });

  it("shifts the student's own spans when an earlier sentence changes length", async () => {
    const m = letter("I ran the trading desk of a £50k student investment fund with 12 traders.⟦me:x1-b0⟧ I typed this myself.");
    const start = m.text.indexOf("I typed");
    const own: Span = { start, end: start + "I typed this myself.".length, kind: "theirs", refs: [] };
    const i = { ...m, input: fixtureDraftInput(), ownSpans: [own] };
    const r = await repair(i, verifyOutput(i), async () => "I ran the fund's trading desk.");
    const mine = r.spans.find((s) => s.kind === "theirs")!;
    expect(at(r.text, mine)).toBe("I typed this myself.");
    expect(flagged(r.spans)).toEqual([]);
  });
});

describe("fix round 1: furniture, firm claims, judge, half-owned text", () => {
  const full = (sal: string, body: string, close: string, over = {}) => {
    const m = parseMarked(sal + "\n\n" + OPEN + body + "\n\n" + close);
    return { ...m, ...verifyOutput({ ...m, input: fixtureDraftInput(over), ownSpans: [] }) };
  };
  const ready = (r: ReturnType<typeof full>) => canMarkReady({ text: r.text, spans: r.spans, lint: r.lint, limit: null }).ok;
  const BODY_OK = "I ran the trading desk of a £50k student investment fund.⟦me:x1-b0⟧";

  it("the greeting may name only the firm, the recipient or stock words", () => {
    expect(ready(full("Dear Northbridge Graduate Recruitment Team,", BODY_OK, "Yours faithfully,\nAlex Morgan"))).toBe(true);
    expect(ready(full("Dear Hiring Manager,", BODY_OK, "Yours faithfully,"))).toBe(true);
    expect(ready(full("Dear Ms Priya Patel,", BODY_OK, "Yours sincerely,", { recipient: "Ms Priya Patel" }))).toBe(true);
    for (const sal of ["Dear Goldman Sachs Graduate Recruitment Team,", "Dear Northbridge, home of the best analysts,", "Dear Ms Priya Patel,"]) {
      const r = full(sal, BODY_OK, "Yours faithfully,");
      expect(ready(r), sal).toBe(false);
      expect(flagged(r.spans).map((s) => s.flag)).toEqual(["check the greeting"]);
    }
  });

  it("only the student's own name may follow the sign-off", () => {
    const r = full("Dear Hiring Manager,", BODY_OK, "Kind regards,\nAlex Morgan\nGoldman Sachs");
    expect(ready(r)).toBe(false);
    expect(flagged(r.spans).map((s) => s.flag)).toEqual(["check the sign-off"]);
    expect(ready(full("Dear Hiring Manager,", BODY_OK, "Kind regards,\nJordan Lee"))).toBe(false);
  });

  it("invented firm facts in lowercase words cannot reach Ready", () => {
    const a1 = FIXTURE_ANSWERS[0].text!;
    for (const body of [
      "Your traders work a four-day week in London.⟦them:jd⟧",
      "Northbridge Capital has a four-day week.⟦them:jd⟧",
      "Northbridge pays its summer analysts more than any other bank in London.⟦them:jd⟧",
      "Thank you, and congratulations on your record trading year.⟦me:⟧",
      `${a1.slice(0, -1)}, and your analysts get double bonuses.⟦you:a1⟧`,
      "Northbridge pays analysts double.⟦me:a1⟧",
    ]) {
      const r = full("Dear Hiring Manager,", body, "Yours faithfully,");
      expect(ready(r), body).toBe(false);
    }
  });

  it("a quantity word is checked like a digit", () => {
    expect(flagged(verify("At Cafe Lune I trained four new staff on the till.⟦me:x2-b0⟧").spans)).toEqual([]);
    expect(flagged(verify("At Cafe Lune I trained five new staff on the till.⟦me:x2-b0⟧").spans)).toHaveLength(1);
  });

  it("a placeholder in brackets blocks Ready", () => {
    const r = full("Dear Hiring Manager,", "I ran the trading desk of a £50k student investment fund at [University].⟦me:x1-b0⟧", "Yours faithfully,");
    expect(r.lint.some((h) => h.label === "Placeholder" && h.severity === "block")).toBe(true);
    expect(ready(r)).toBe(false);
  });

  it("matches a quoted answer on word boundaries and needs it to be most of the sentence", () => {
    const short = { answers: [{ id: "a1", question: "why_firm" as const, text: "Risk." }] };
    const r = verify("Risk is something I have thought about at length while running a student investment fund.⟦you:a1⟧", short);
    expect(ready({ ...r } as ReturnType<typeof full>)).toBe(false);
    const ranked = { answers: [{ id: "a1", question: "why_firm" as const, text: "I ran" }] };
    const b = verify("I ranked first.⟦you:a1⟧", ranked);
    expect(b.spans.some((s) => s.kind === "theirs")).toBe(false);
    expect(flagged(b.spans).map((s) => s.flag)).toEqual(["changed your words"]);
  });

  it("checks only the AI part of a half-owned sentence and never rewrites the student's words", async () => {
    const sentence = "I ran the trading desk of a £50k student investment fund, and I personally made 300 trades.";
    const m = letter(`${sentence}⟦me:x1-b0⟧`);
    const mineText = "and I personally made 300 trades.";
    const start = m.text.indexOf(mineText);
    const own: Span = { start, end: start + mineText.length, kind: "theirs", refs: [] };
    const i = { ...m, input: fixtureDraftInput(), ownSpans: [own] };
    const v = verifyOutput(i);
    expect(flagged(v.spans)).toEqual([]);
    expect(v.spans.filter((s) => s.kind === "ai").every((s) => s.end <= own.start || s.start >= own.end)).toBe(true);
    expect(canMarkReady({ text: m.text, ...v, limit: null }).ok).toBe(true);

    // An invented AI part next to the student's words: only the AI part is sent for rewriting.
    const bad = letter(`I ran the trading desk of a £50k fund with 12 traders, ${mineText}⟦me:x1-b0⟧`);
    const s2 = bad.text.indexOf(mineText);
    const own2: Span = { start: s2, end: s2 + mineText.length, kind: "theirs", refs: [] };
    const i2 = { ...bad, input: fixtureDraftInput(), ownSpans: [own2] };
    const rewrite = vi.fn<(s: string, r: string) => Promise<string>>(async () => "I ran the trading desk of a £50k student investment fund,");
    const r = await repair(i2, verifyOutput(i2), rewrite);
    expect(rewrite).toHaveBeenCalledTimes(1);
    expect(rewrite.mock.calls[0][0]).toBe("I ran the trading desk of a £50k fund with 12 traders,");
    const mine = r.spans.find((s) => s.kind === "theirs")!;
    expect(r.text.slice(mine.start, mine.end)).toBe(mineText);
    expect(flagged(r.spans)).toEqual([]);
  });
});

describe("judge results", () => {
  const body = "Northbridge Capital runs flow and structured trading desks.⟦them:jd⟧ I sized positions across rates and FX on the trading desk of a £50k student investment fund.";
  const m = letter(body);
  const idx = (needle: string) => m.sentences.findIndex((s) => s.text.startsWith(needle));

  it("a generic or unsupported verdict adds a flag", () => {
    const n = idx("Northbridge Capital runs");
    const r = verifyOutput({ ...m, input: fixtureDraftInput(), ownSpans: [], judged: [{ index: n, about: "them", refs: ["jd"], verdict: "generic" }] });
    expect(flagged(r.spans).map((s) => s.flag)).toContain("would work for any firm");
    const u = verifyOutput({ ...m, input: fixtureDraftInput(), ownSpans: [], judged: [{ index: n, about: "them", refs: ["jd"], verdict: "unsupported" }] });
    expect(flagged(u.spans).map((s) => s.flag)).toContain("not in the job post or your picked facts");
  });

  it("a tag gives an unmarked sentence its sources, which then face the deterministic checks", () => {
    const n = idx("I sized positions");
    expect(flagged(verifyOutput({ ...m, input: fixtureDraftInput(), ownSpans: [] }).spans).map((s) => s.flag)).toEqual(["no source"]);
    const tagged = verifyOutput({ ...m, input: fixtureDraftInput(), ownSpans: [], judged: [{ index: n, about: "me", refs: ["X1-B0"], verdict: "ok" }] });
    expect(flagged(tagged.spans)).toEqual([]);
    const wrong = verifyOutput({ ...m, input: fixtureDraftInput(), ownSpans: [], judged: [{ index: n, about: "me", refs: ["x2-b0"], verdict: "ok" }] });
    expect(flagged(wrong.spans)).toHaveLength(1);
  });

  it("an ok verdict never clears a deterministic flag, and a tag never relabels a marked sentence", () => {
    const bad = letter("Your traders work a four-day week in London.⟦them:jd⟧ We placed 3rd of 62 teams.⟦me:p1-b0⟧");
    const judged = bad.sentences.map((s, index) => ({ index, about: "me" as const, refs: ["p1-b0"], verdict: "ok" as const }));
    expect(flagged(verifyOutput({ ...bad, input: fixtureDraftInput(), ownSpans: [], judged }).spans)).toHaveLength(2);
  });

  it("judgeSentences sends only unmarked and them sentences and keeps their indexes (fixture mode)", async () => {
    process.env.AI_MODE = "fixture";
    try {
      const d = parseMarked(readFileSync("fixtures/ai/coverLetterDraft/default.txt", "utf8"));
      const j = await judgeSentences({ sentences: d.sentences, input: fixtureDraftInput() });
      expect(j.map((x) => x.index)).toEqual([1, 4, 11, 12]);
      expect(j.every((x) => x.verdict === "ok")).toBe(true);
      const v = verifyOutput({ ...d, input: fixtureDraftInput(), ownSpans: [], judged: j });
      expect(flagged(v.spans)).toHaveLength(1);
      // Indexes that point at sentences the judge was not shown are dropped.
      expect(await judgeSentences({ sentences: d.sentences.slice(0, 3), input: fixtureDraftInput() })).toEqual([{ index: 1, about: "them", refs: ["jd"], verdict: "ok" }]);
    } finally {
      delete process.env.AI_MODE;
    }
  });
});

describe("fix round 2: firm talk outside them-sentences", () => {
  const full = (sal: string, body: string) => {
    const m = parseMarked(sal + "\n\n" + OPEN + body + "\n\nYours faithfully,");
    return { ...m, ...verifyOutput({ ...m, input: fixtureDraftInput(), ownSpans: [] }) };
  };
  const ready = (r: ReturnType<typeof full>) => canMarkReady({ text: r.text, spans: r.spans, lint: r.lint, limit: null }).ok;
  const a1 = FIXTURE_ANSWERS[0].text!;

  it("firm claims in me, courtesy and quoted-answer sentences are blocked", () => {
    for (const body of [
      "Thank you, and congratulations on your successful trading year.⟦me:⟧",
      `${a1.slice(0, -1)}, and your analysts get guaranteed bonuses.⟦you:a1⟧`,
      "Northbridge pays its analysts generously.⟦me:a1⟧",
      "Northbridge analysts get a fortnight of extra holiday.⟦me:⟧",
    ]) {
      const r = full("Dear Hiring Manager,", body);
      expect(ready(r), body).toBe(false);
    }
  });

  it("a firm claim wrapped in \"I know\" or \"I was impressed that\" is still checked, with no judge", () => {
    for (const body of [
      "I know your analysts get guaranteed bonuses.⟦me:⟧",
      "I understand that Northbridge doubled its revenue last year.⟦me:x1-b0⟧",
      "I was impressed that your desk won the Risk Awards.⟦me:⟧",
      "I heard you are opening a Tokyo office.⟦me:⟧",
      "I have read that your analysts receive guaranteed bonuses.⟦me:x1-b0⟧",
      "I admire how your desk pays analysts generously.⟦me:x1-b0⟧",
      "I am excited that Northbridge offers guaranteed bonuses.⟦me:x1-b0⟧",
    ]) {
      const r = full("Dear Hiring Manager,", body);
      expect(flagged(r.spans).length, body).toBeGreaterThan(0);
      expect(ready(r), body).toBe(false);
    }
  });

  it("boilerplate intent naming only the firm, the programme or the team is not a firm claim", () => {
    for (const body of [
      "That is why I am applying to Northbridge Capital.⟦me:⟧",
      "My experience on the fund fits your Markets programme.⟦me:x1-b0⟧",
      "I would value the opportunity to contribute to your team.⟦me:⟧",
    ]) {
      const r = full("Dear Hiring Manager,", body);
      expect(flagged(r.spans), body).toEqual([]);
      expect(ready(r), body).toBe(true);
    }
    // A clause that says what the firm has, pays or does is still a claim.
    for (const body of [
      "I would love to join your team, which pays guaranteed bonuses.⟦me:⟧",
      "I am applying to Northbridge because Northbridge pays guaranteed bonuses.⟦me:⟧",
      "I want to join your desk that won the Risk Awards.⟦me:⟧",
    ]) expect(ready(full("Dear Hiring Manager,", body)), body).toBe(false);
  });

  it("a firm claim after because / since / and, about \"it\" or \"there\", is checked and goes to the judge", async () => {
    const bodies = [
      "I am applying to Northbridge because it offers guaranteed bonuses.⟦me:⟧",
      "I am applying to Northbridge because it pays analysts generously.⟦me:⟧",
      "I am applying to Northbridge since its analysts receive guaranteed bonuses.⟦me:⟧",
      "I am applying to Northbridge because analysts there get guaranteed bonuses.⟦me:⟧",
      "I am applying to Northbridge and look forward to the guaranteed bonuses it offers.⟦me:⟧",
      // Through prepositions, and with no pronoun at all.
      "I want to join Northbridge for its guaranteed bonuses.⟦me:⟧",
      "I want to join Northbridge for the guaranteed bonuses.⟦me:⟧",
      "I am applying to Northbridge for its four-day week and guaranteed bonuses.⟦me:⟧",
      "I want to join Northbridge with its record trading profits.⟦me:⟧",
      "I am applying to Northbridge in its record-breaking year.⟦me:⟧",
      "I am applying to Northbridge as an analyst with guaranteed bonuses.⟦me:⟧",
      "I hope to join Northbridge to share in guaranteed bonuses.⟦me:⟧",
      "Northbridge, with its guaranteed bonuses, is where I want to start.⟦me:⟧",
      "I am applying to Northbridge because bonuses are guaranteed for analysts.⟦me:⟧",
      "I am applying to Northbridge, where analysts get guaranteed bonuses.⟦me:⟧",
    ];
    for (const body of bodies) {
      const r = full("Dear Hiring Manager,", body);
      expect(flagged(r.spans).length, body).toBeGreaterThan(0);
      expect(ready(r), body).toBe(false);
    }
    // Each is also shown to the judge.
    process.env.AI_MODE = "fixture";
    try {
      const { judgeSentences: judge } = await import("@/lib/cover-letter/verify");
      for (const body of bodies) {
        const m = letter(body);
        const n = m.sentences.findIndex((x) => x.about === "me");
        const shown: number[] = [];
        vi.spyOn(await import("@/lib/ai/provider"), "runAi").mockResolvedValue({ items: m.sentences.map((_, index) => ({ index, about: "me", refs: [], verdict: "ok" })) } as never);
        for (const x of await judge({ sentences: m.sentences, input: fixtureDraftInput() })) shown.push(x.index);
        vi.restoreAllMocks();
        expect(shown, body).toContain(n);
      }
    } finally {
      vi.restoreAllMocks();
      delete process.env.AI_MODE;
    }
  });

  it("a reason lead-in before the student (\"Because of…\", \"Thanks to its…\") is firm talk", () => {
    for (const body of [
      "Because of the bonuses I want to join Northbridge.⟦me:⟧",
      "Thanks to its four-day week, Northbridge is my first choice.⟦me:⟧",
      "Given its generous bonuses, I want to join Northbridge.⟦me:⟧",
      // Cited to a CV bullet, so only the firm check can catch the lead-in.
      "Because of its bonuses I am applying to Northbridge.⟦me:x1-b0⟧",
      "Owing to its generous bonuses, I am applying to Northbridge.⟦me:x1-b0⟧",
    ]) {
      const r = full("Dear Hiring Manager,", body);
      expect(flagged(r.spans).length, body).toBeGreaterThan(0);
      expect(ready(r), body).toBe(false);
    }
  });

  it("every sentence that names the firm goes to the judge, intent included, and a pass stays a pass", async () => {
    process.env.AI_MODE = "fixture";
    try {
      const { judgeSentences: judge } = await import("@/lib/cover-letter/verify");
      for (const body of ["That is why I am applying to Northbridge.⟦me:⟧", "I would value the opportunity to contribute to your team.⟦me:⟧"]) {
        const m = letter(body);
        const n = m.sentences.findIndex((x) => x.about === "me");
        vi.spyOn(await import("@/lib/ai/provider"), "runAi").mockResolvedValue({ items: m.sentences.map((_, index) => ({ index, about: "me", refs: [], verdict: "ok" })) } as never);
        const verdicts = await judge({ sentences: m.sentences, input: fixtureDraftInput() });
        vi.restoreAllMocks();
        expect(verdicts.map((x) => x.index), body).toContain(n);
        expect(flagged(verifyOutput({ ...m, input: fixtureDraftInput(), ownSpans: [], judged: verdicts }).spans), body).toEqual([]);
      }
    } finally {
      vi.restoreAllMocks();
      delete process.env.AI_MODE;
    }
  });

  it("intent followed by a preposition phrase or the student's own reason stays unflagged", () => {
    for (const body of [
      "That is why I am applying to Northbridge.⟦me:⟧",
      "I am applying to Northbridge as a summer analyst.⟦me:⟧",
      "I would value the opportunity to contribute to your team in London.⟦me:⟧",
    ]) {
      const r = full("Dear Hiring Manager,", body);
      expect(flagged(r.spans), body).toEqual([]);
    }
  });

  it("pure courtesy passes", () => {
    for (const body of ["Thank you for your consideration.⟦me:⟧", "I would welcome the chance to discuss my application.⟦me:⟧"]) {
      const r = full("Dear Hiring Manager,", body);
      expect(flagged(r.spans), body).toEqual([]);
      expect(ready(r), body).toBe(true);
    }
  });

  it("a greeting may use the connectors at, of, the and and", () => {
    expect(ready(full("Dear Recruitment Team at Northbridge,", "I ran the trading desk of a £50k student investment fund.⟦me:x1-b0⟧"))).toBe(true);
  });

  it("the judge sees firm-talking me sentences, and its verdict applies to them", async () => {
    // (A sentence whose words around "your Markets team" all come from the sources is intent and never goes to the
    // judge: this one has words after the firm reference that no source has.)
    const m = letter("I would bring my rates scenario model to your desks, where I could stress-test it.⟦me:x1-b1⟧");
    const n = m.sentences.findIndex((s) => s.text.startsWith("I would bring"));
    expect(flagged(verifyOutput({ ...m, input: fixtureDraftInput(), ownSpans: [] }).spans)).toEqual([]);
    const v = verifyOutput({ ...m, input: fixtureDraftInput(), ownSpans: [], judged: [{ index: n, about: "me", refs: ["x1-b1"], verdict: "generic" }] });
    expect(flagged(v.spans).map((s) => s.flag)).toEqual(["would work for any firm"]);
    const q = letter(`${a1.slice(0, -1)}, and that suits your desk.⟦you:a1⟧`);
    const k = q.sentences.findIndex((s) => s.about === "you");
    const vq = verifyOutput({ ...q, input: fixtureDraftInput(), ownSpans: [], judged: [{ index: k, about: "you", refs: ["a1"], verdict: "unsupported" }] });
    expect(vq.spans.find((s) => s.kind === "theirs")).toBeDefined();
    expect(flagged(vq.spans).map((s) => s.flag)).toEqual(["not in the job post or your picked facts"]);

    process.env.AI_MODE = "fixture";
    try {
      const { judgeSentences: judge } = await import("@/lib/cover-letter/verify");
      const seen: number[] = [];
      // The model answers for every sentence; only the ones it was shown come back.
      vi.spyOn(await import("@/lib/ai/provider"), "runAi").mockResolvedValue({ items: m.sentences.map((_, index) => ({ index, about: "me", refs: [], verdict: "ok" })) } as never);
      for (const x of await judge({ sentences: m.sentences, input: fixtureDraftInput() })) seen.push(x.index);
      expect(seen).toEqual([1, n]); // the opening them-sentence and the firm-talking me-sentence, not the salutation
    } finally {
      vi.restoreAllMocks();
      delete process.env.AI_MODE;
    }
  });
});
