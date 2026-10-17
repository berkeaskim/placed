import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FIXTURE_ANSWERS } from "./fixtures";
import { applyEdit, planEdit, type EditKind } from "@/lib/cover-letter/edit";
import type { Span } from "@/lib/cover-letter/types";
import { countWords } from "@/lib/cover-letter/rules";
import { NO_VERDICT, verifyOutput } from "@/lib/cover-letter/verify";
import { fixtureDraftInput, okVerdicts, parseMarked } from "./fixtures";

type Done = { text: string; spans: Span[]; lint: unknown[] };
const input = fixtureDraftInput();
const base = () => {
  const m = parseMarked(readFileSync("fixtures/ai/coverLetterDraft/default.txt", "utf8"));
  return { text: m.text, spans: verifyOutput({ ...m, input, ownSpans: [], judged: okVerdicts(m.sentences) }).spans };
};
/** A judge that says "ok" to every sentence of the rewritten paragraph. */
const okJudge = async (a: { sentences: { about: "me" | "them" | "you" | null; refs: string[] }[] }) => okVerdicts(a.sentences);
const run = async (kind: EditKind, instruction?: string, b = base(), judge: Parameters<typeof applyEdit>[0]["judge"] = okJudge) => {
  const events: { phase: string; [k: string]: unknown }[] = [];
  for await (const ev of applyEdit({ ...b, kind, instruction, input, judge })) events.push(ev);
  return { events, done: events.find((e) => e.phase === "done") as unknown as Done, before: b };
};
const paragraphs = (t: string) => t.split(/\n[ \t]*\n/);
const theirsText = (text: string, spans: Span[]) => spans.filter((s) => s.kind === "theirs").map((s) => text.slice(s.start, s.end));

beforeEach(() => { process.env.AI_MODE = "fixture"; });
afterEach(() => { delete process.env.AI_MODE; });

describe("planEdit", () => {
  it("remove_flag targets the first flagged span", () => {
    const b = base();
    const plan = planEdit(b.text, b.spans, "remove_flag") as { span: Span };
    expect(b.text.slice(plan.span.start, plan.span.end)).toBe("We placed 3rd of 62 teams.");
  });
  it("shorter with 'opening' targets paragraph 1; 'closing' the last body paragraph", () => {
    const b = base();
    expect(planEdit(b.text, b.spans, "shorter", "Make the opening shorter")).toEqual({ paragraph: 1 });
    const last = paragraphs(b.text).length - 2; // the sign-off paragraph is last
    expect(planEdit(b.text, b.spans, "free", "tighten the closing paragraph")).toEqual({ paragraph: last });
  });
  it("add_close inserts a new paragraph before the sign-off", () => {
    const b = base();
    expect(planEdit(b.text, b.spans, "add_close")).toEqual({ paragraph: paragraphs(b.text).length - 1 });
  });
  it("without a named paragraph, picks the paragraph with the most AI text", () => {
    const b = base();
    const plan = planEdit(b.text, b.spans, "more_formal") as { paragraph: number };
    expect(plan.paragraph).toBeGreaterThan(0);
    expect(plan.paragraph).toBeLessThan(paragraphs(b.text).length - 1);
  });
});

describe("applyEdit", () => {
  it("remove_flag deletes the flagged sentence without an LLM call and tidies the paragraph", async () => {
    process.env.AI_MODE = "live"; // a streamText call would throw: no provider
    const { events, done, before } = await run("remove_flag");
    expect(events.map((e) => e.phase)).toEqual(["target", "done"]);
    expect(done.text).not.toContain("3rd of 62");
    expect(done.text).toContain("changed our position size. For the fund itself");
    expect(done.text).not.toMatch(/ {2}| \./);
    expect(theirsText(done.text, done.spans)).toEqual(theirsText(before.text, before.spans));
    expect(done.spans.some((s) => s.flag === "no source" || /3rd/.test(done.text.slice(s.start, s.end)))).toBe(false);
  });

  it("remove_flag tidies a dangling clause: 'size; .' becomes 'size.'", async () => {
    const text = "Dear Hiring Manager,\n\nWe changed our position size; we placed 3rd of 62 teams.\n\nYours faithfully,";
    const start = text.indexOf("we placed");
    const spans: Span[] = [{ start, end: start + "we placed 3rd of 62 teams".length, kind: "ai", refs: ["p1-b0"], flag: "unsupported number" }];
    const { done } = await run("remove_flag", undefined, { text, spans });
    expect(done.text).toContain("We changed our position size.");
    expect(done.text).not.toContain("size; .");
  });

  it("shorter with 'opening' rewrites paragraph 1 only, and the word count drops", async () => {
    const { events, done, before } = await run("shorter", "Make the opening shorter");
    expect(events[0]).toEqual({ phase: "target", paragraph: 1 });
    const streamed = events.filter((e) => e.phase === "delta").map((e) => e.visible).join("");
    expect(streamed).not.toMatch(/[⟦⟧]/);
    const [bp, ap] = [paragraphs(before.text), paragraphs(done.text)];
    expect(ap.length).toBe(bp.length);
    expect(ap.filter((_, i) => i !== 1)).toEqual(bp.filter((_, i) => i !== 1));
    expect(countWords(ap[1])).toBeLessThan(countWords(bp[1]));
    expect(ap[1].trim()).toBe(streamed.trim());
  });

  it("a locked (theirs) span survives a rewrite verbatim, with correct offsets everywhere", async () => {
    const { done, before } = await run("shorter", "Make the opening shorter");
    expect(theirsText(done.text, done.spans)).toEqual(theirsText(before.text, before.spans));
    for (const s of done.spans) expect(s.end).toBeGreaterThan(s.start);
    // the flagged span in a later paragraph still points at the same words
    const f = done.spans.find((s) => s.flag);
    expect(done.text.slice(f!.start, f!.end)).toBe("We placed 3rd of 62 teams.");
    expect(done.lint).toBeDefined();
  });

  it("add_close appends a verified paragraph before the sign-off", async () => {
    const { events, done, before } = await run("add_close");
    const n = paragraphs(before.text).length;
    expect(events[0]).toEqual({ phase: "target", paragraph: n - 1 });
    const ap = paragraphs(done.text);
    expect(ap.length).toBe(n + 1);
    expect(ap.at(-1)).toMatch(/^Yours faithfully,/);
    expect(done.text.startsWith(before.text.slice(0, before.text.lastIndexOf("Yours faithfully")))).toBe(true);
    const added = ap[n - 1];
    expect(done.spans.filter((s) => s.kind === "ai" && s.start >= done.text.indexOf(added) && s.flag)).toEqual([]);
    expect((done.lint as { ruleId: string }[]).some((h) => h.ruleId === "CL-55")).toBe(false);
  });

  it("keeps the student's text that crosses into the next paragraph, locking only the part inside the edited one", async () => {
    const b = base();
    const text = b.text.replace(" Running the trading desk", "\n\nRunning the trading desk");
    const shifted = b.spans.map((s) => (s.start > b.text.indexOf(" Running the trading desk") ? { ...s, start: s.start + 1, end: s.end + 1 } : s));
    const a1 = FIXTURE_ANSWERS[0].text!;
    const from = text.indexOf(a1);
    const to = text.indexOf("as much as choosing it.") + "as much as choosing it.".length;
    // A hand edit made one span of theirs from the quoted answer across the break into the next paragraph.
    const spans: Span[] = [...shifted.filter((s) => s.end <= from || s.start >= to), { start: from, end: to, kind: "theirs" as const, refs: [] }].sort((x, y) => x.start - y.start);
    const { done } = await run("shorter", "Make the opening shorter", { text, spans });
    const own = theirsText(done.text, done.spans);
    expect(own).toContain(a1);
    expect(own).toContain("Running the trading desk of a £50k student investment fund taught me that sizing a position matters as much as choosing it.");
    expect(done.spans.some((s) => s.kind === "ai" && /Running the trading desk/.test(done.text.slice(s.start, s.end)))).toBe(false);
  });

  it("fails loudly when the rewrite changes a locked passage", async () => {
    const b = base();
    // paragraph 3 holds the a4 answer; the shorter fixture has no such passage
    await expect(run("shorter", "make paragraph 3 shorter", b)).rejects.toThrow(/locked/i);
  });
});

describe("sign-off detection", () => {
  const withThanks = (b = base()) => {
    const text = b.text.replace("Yours faithfully,", "Many thanks for considering my application.\n\nYours faithfully,");
    return { text, spans: b.spans.map((s) => (s.start >= b.text.indexOf("Yours faithfully") ? { ...s, start: s.start + 42, end: s.end + 42 } : s)) };
  };
  it("treats 'Many thanks for considering…' as a body paragraph", () => {
    const b = withThanks();
    const n = paragraphs(b.text).length;
    expect(planEdit(b.text, b.spans, "shorter", "the closing paragraph")).toEqual({ paragraph: n - 2 });
    expect(planEdit(b.text, b.spans, "add_close")).toEqual({ paragraph: n - 1 });
  });
});

describe("kinds with fixtures", () => {
  it.each(["more_formal", "free"] as const)("%s rewrites the opening and keeps the locked answer", async (kind) => {
    const { done, before } = await run(kind, "the opening");
    const [bp, ap] = [paragraphs(before.text), paragraphs(done.text)];
    expect(ap[1]).not.toBe(bp[1]);
    expect(ap.filter((_, i) => i !== 1)).toEqual(bp.filter((_, i) => i !== 1));
    const a1 = FIXTURE_ANSWERS[0].text!;
    expect(done.spans.filter((s) => s.kind === "theirs" && done.text.slice(s.start, s.end) === a1)).toHaveLength(1);
    const p1 = done.text.indexOf(ap[1]);
    expect(done.spans.filter((s) => s.kind === "ai" && s.flag && s.start >= p1 && s.end <= p1 + ap[1].length)).toEqual([]);
  });
});

describe("judge flags", () => {
  const judgedBase = () => {
    const m = parseMarked(readFileSync("fixtures/ai/coverLetterDraft/default.txt", "utf8"));
    const index = m.sentences.findIndex((s) => s.text.startsWith("Presenting it each week"));
    const judged = [...okVerdicts(m.sentences).filter((j) => j.index !== index), { index, about: "me" as const, refs: ["x1-b0"], verdict: "unsupported" as const }];
    const v = verifyOutput({ ...m, input, ownSpans: [], judged });
    return { text: m.text, spans: v.spans, index };
  };

  it("remove_flag carries over the flags of sibling sentences", async () => {
    const b = judgedBase();
    expect(b.spans.some((s) => s.flag === "not in the job post or your picked facts")).toBe(true);
    const { done } = await run("remove_flag", undefined, b);
    const f = done.spans.filter((s) => s.flag === "not in the job post or your picked facts");
    expect(f).toHaveLength(1);
    expect(done.text.slice(f[0].start, f[0].end)).toMatch(/^Presenting it each week/);
  });

  it("a rewrite re-runs the judge on the edited paragraph only, and its verdicts add flags", async () => {
    const seen: string[][] = [];
    const judge = async (a: { sentences: { text: string }[] }) => {
      seen.push(a.sentences.map((s) => s.text));
      return [{ index: 0, about: "them" as const, refs: ["jd"], verdict: "generic" as const }];
    };
    const { done } = await run("shorter", "the opening", base(), judge as never);
    expect(seen).toHaveLength(1);
    expect(seen[0]).toHaveLength(2);
    const f = done.spans.find((s) => s.flag === "would work for any firm");
    expect(done.text.slice(f!.start, f!.end)).toMatch(/^I am applying for the 2027/);
  });
});

describe("a rewrite the judge cannot check", () => {
  it("flags the rewritten paragraph's sentences about the firm (fail closed)", async () => {
    const { done } = await run("free", "the opening", base(), async () => []);
    const p1 = paragraphs(done.text)[1];
    const at = done.text.indexOf(p1);
    const flags = done.spans.filter((s) => s.kind === "ai" && s.flag && s.start >= at && s.end <= at + p1.length);
    expect(flags.map((s) => s.flag)).toContain(NO_VERDICT);
  });
});

describe("remove_flag on a paragraph's only sentence", () => {
  it("collapses the paragraph and its separator", async () => {
    const text = "Dear Hiring Manager,\n\nWe placed 3rd of 62 teams.\n\nI ran the desk.\n\nYours faithfully,";
    const spans: Span[] = [{ start: 22, end: 48, kind: "ai", refs: ["p1-b0"], flag: "unsupported number" }];
    const { done } = await run("remove_flag", undefined, { text, spans });
    expect(done.text).toBe("Dear Hiring Manager,\n\nI ran the desk.\n\nYours faithfully,");
    expect(done.text).not.toMatch(/\n{3}/);
  });
});
