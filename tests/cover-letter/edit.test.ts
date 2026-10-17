import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { applyEdit, planEdit, type EditKind } from "@/lib/cover-letter/edit";
import type { Span } from "@/lib/cover-letter/types";
import { countWords } from "@/lib/cover-letter/rules";
import { verifyOutput } from "@/lib/cover-letter/verify";
import { fixtureDraftInput, parseMarked } from "./fixtures";

type Done = { text: string; spans: Span[]; lint: unknown[] };
const input = fixtureDraftInput();
const base = () => {
  const m = parseMarked(readFileSync("fixtures/ai/coverLetterDraft/default.txt", "utf8"));
  return { text: m.text, spans: verifyOutput({ ...m, input, ownSpans: [] }).spans };
};
const run = async (kind: EditKind, instruction?: string, b = base()) => {
  const events: { phase: string; [k: string]: unknown }[] = [];
  for await (const ev of applyEdit({ ...b, kind, instruction, input })) events.push(ev);
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

  it("fails loudly when the rewrite changes a locked passage", async () => {
    const b = base();
    // paragraph 3 holds the a4 answer; the shorter fixture has no such passage
    await expect(run("shorter", "make paragraph 3 shorter", b)).rejects.toThrow(/locked/i);
  });
});
