import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { repair, verifyOutput } from "@/lib/cover-letter/verify";
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
