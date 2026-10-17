import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

let reply = "";
vi.mock("@/lib/ai/provider", async (orig) => ({
  ...(await orig<typeof import("@/lib/ai/provider")>()),
  streamText: async function* () { yield reply; },
}));

import { applyEdit } from "@/lib/cover-letter/edit";
import { verifyOutput } from "@/lib/cover-letter/verify";
import { FIXTURE_ANSWERS, fixtureDraftInput, parseMarked } from "./fixtures";

const input = fixtureDraftInput();
const A4 = FIXTURE_ANSWERS[3].text!;
const m = parseMarked(readFileSync("fixtures/ai/coverLetterDraft/default.txt", "utf8"));
const spans = verifyOutput({ ...m, input, ownSpans: [] }).spans;
const run = async (instruction: string) => {
  let done: any;
  for await (const e of applyEdit({ text: m.text, spans, kind: "free", instruction, input, judge: async () => [] })) if (e.phase === "done") done = e;
  return done as { text: string; spans: { start: number; end: number; kind: string; refs: string[]; flag?: string }[] };
};

describe("locked span inside the rewritten paragraph", () => {
  beforeEach(() => { reply = `Sizing positions across rates and FX is what I know best.⟦me:x1-b0⟧ ${A4}⟦you:a4⟧`; });

  it("is kept verbatim as exactly one theirs span with correct offsets", async () => {
    const done = await run("rewrite paragraph 3");
    const inA4 = done.spans.filter((s) => s.kind === "theirs" && done.text.slice(s.start, s.end) === A4);
    expect(inA4).toHaveLength(1);
    expect(inA4[0].refs).toEqual(["a4"]);
    expect(done.text.indexOf(A4)).toBe(inA4[0].start);
    expect(done.spans.filter((s) => s.kind === "theirs").map((s) => done.text.slice(s.start, s.end)))
      .toEqual(spans.filter((s) => s.kind === "theirs").map((s) => m.text.slice(s.start, s.end)));
    expect(done.text).toContain("Sizing positions across rates and FX is what I know best.");
  });
});
