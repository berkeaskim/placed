import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { canMarkReady } from "@/lib/cover-letter/gate";
import { lintLetter } from "@/lib/cover-letter/rules";
import { diffSpans, sameLetter, tidySpaces } from "@/lib/cover-letter/spans";
import type { Span } from "@/lib/cover-letter/types";
import { verifyOutput } from "@/lib/cover-letter/verify";
import { fixtureDraftInput, parseMarked } from "./fixtures";

const RAW = readFileSync(path.resolve(__dirname, "../../fixtures/ai/coverLetterDraft/default.txt"), "utf8");

/** The recorded draft as the service saves it: verified, with the student's name under the sign-off. */
function draft(raw = RAW) {
  const m = parseMarked(raw);
  const text = `${m.text.trimEnd()}\nAlex Morgan`;
  const sentences = [...m.sentences];
  const last = sentences.at(-1)!;
  sentences[sentences.length - 1] = { ...last, text: `${last.text}\nAlex Morgan` };
  const input = fixtureDraftInput();
  const v = verifyOutput({ text, sentences, input, ownSpans: [] });
  return { text, spans: v.spans, input };
}

const slices = (text: string, spans: Span[]) => spans.map((s) => ({ text: text.slice(s.start, s.end), kind: s.kind, flag: s.flag, refs: s.refs }));
const replaceOnce = (t: string, a: string, b: string) => {
  expect(t.includes(a)).toBe(true);
  return t.replace(a, b);
};

describe("diffSpans", () => {
  it("two small edits far apart make only those two sentences theirs; the flag between them survives", () => {
    const d = draft();
    const flagged = d.spans.find((s) => d.text.slice(s.start, s.end) === "We placed 3rd of 62 teams.");
    expect(flagged).toMatchObject({ kind: "ai", flag: "unsupported number" });

    let after = replaceOnce(d.text, "I sized positions across rates and FX.", "I sized positions in rates and FX.");
    after = replaceOnce(after, "Thank you for considering my application", "Thanks for considering my application");
    const spans = diffSpans(d.text, d.spans, after);

    const before = slices(d.text, d.spans);
    const now = slices(after, spans);
    const newTheirs = now.filter((s) => s.kind === "theirs" && !before.some((b) => b.kind === "theirs" && b.text === s.text));
    expect(newTheirs.map((s) => s.text)).toEqual([
      "Running the trading desk of a £50k student investment fund, I sized positions in rates and FX.",
      "Thanks for considering my application, and I would welcome the chance to discuss it at interview.",
    ]);
    // Every other span is untouched: same words, same owner, same flag.
    const untouched = before.filter((b) => !b.text.includes("I sized positions across rates and FX.") && !b.text.includes("Thank you for considering"));
    for (const b of untouched) expect(now).toContainEqual(b);
    expect(now.find((s) => s.text === "We placed 3rd of 62 teams.")).toMatchObject({ kind: "ai", flag: "unsupported number" });

    const input = d.input;
    const lint = lintLetter(after, { mode: "full_letter", limit: null, company: input.company, role: input.role, otherEmployers: input.evidence.rivals, ownSpans: spans.filter((s) => s.kind === "theirs") });
    const gate = canMarkReady({ text: after, spans, lint, limit: null });
    expect(gate.ok).toBe(false);
    if (!gate.ok) expect(gate.reasons.join(" ")).toMatch(/3rd of 62 teams.*unsupported number/);
  });

  it("whitespace-only differences change no owner and keep every span on the same words", () => {
    const d = draft();
    const after = d.text.replace("fund. The", "fund.  The").replace(/\. We placed/, ".\n\nWe placed");
    expect(after).not.toBe(d.text);
    const spans = diffSpans(d.text, d.spans, after);
    expect(slices(after, spans)).toEqual(slices(d.text, d.spans));
  });

  it("a sentence typed between two others becomes theirs on its own", () => {
    const d = draft();
    const after = replaceOnce(d.text, "We placed 3rd of 62 teams. ", "We placed 3rd of 62 teams. It was my first competition. ");
    const now = slices(after, diffSpans(d.text, d.spans, after));
    expect(now.filter((s) => s.kind === "theirs").map((s) => s.text)).toContain("It was my first competition.");
    for (const b of slices(d.text, d.spans)) expect(now).toContainEqual(b);
  });

  it("deleting a whole sentence drops its span and leaves the rest alone", () => {
    const d = draft();
    const after = replaceOnce(d.text, " We placed 3rd of 62 teams.", "");
    const now = slices(after, diffSpans(d.text, d.spans, after));
    expect(now.some((s) => s.text.includes("3rd of 62"))).toBe(false);
    for (const b of slices(d.text, d.spans).filter((b) => !b.text.includes("3rd of 62"))) expect(now).toContainEqual(b);
  });

  it("an edit across two sentences makes both theirs", () => {
    const d = draft();
    const after = replaceOnce(d.text, "position size. We placed", "position size, and we placed");
    const spans = diffSpans(d.text, d.spans, after);
    const own = spans.filter((s) => s.kind === "theirs").map((s) => after.slice(s.start, s.end));
    expect(own.some((t) => t.startsWith("I built our rates scenario model") && t.endsWith("position size,"))).toBe(true);
    expect(own).toContain("and we placed 3rd of 62 teams.");
    expect(spans.some((s) => s.kind === "ai" && s.flag === "unsupported number")).toBe(false);
    // The AI lead-in before the quoted answer is untouched.
    expect(slices(after, spans)).toContainEqual(slices(d.text, d.spans).find((b) => b.text === "At the Warwick Trading Challenge"));
  });
});

describe("whitespace", () => {
  it("tidySpaces collapses space runs and trims lines, as the rendered paper shows them", () => {
    expect(tidySpaces("Dear Team,\n\nOne.  Two. \nThree\n\n\n\nYours faithfully,\nAlex")).toBe("Dear Team,\n\nOne. Two.\nThree\n\nYours faithfully,\nAlex");
  });

  it("a letter read back from the paper with no edit is the same letter, so blur saves nothing", () => {
    // A small model's spacing: a space before each marker leaves double spaces between sentences.
    const stored = parseMarked(RAW.replace(/\.⟦/g, ". ⟦")).text.trimEnd();
    expect(stored).toMatch(/ {2}/);
    // What the contenteditable gives back: pre-line collapses space runs, each paragraph trimmed.
    const read = stored.split(/\n[ \t]*\n/).map((p) => p.replace(/ {2,}/g, " ").trim()).filter(Boolean).join("\n\n");
    expect(read).not.toBe(stored);
    expect(sameLetter(read, stored)).toBe(true);
    expect(sameLetter(`${read} More.`, stored)).toBe(false);
  });
});
