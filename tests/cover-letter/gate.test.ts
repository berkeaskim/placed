import { describe, expect, it } from "vitest";
import { canMarkReady } from "@/lib/cover-letter/gate";
import { lintLetter } from "@/lib/cover-letter/rules";
import type { Limit, Span } from "@/lib/cover-letter/types";
import { verifyOutput } from "@/lib/cover-letter/verify";
import { FIXTURE_COMPANY, FIXTURE_ROLE, fixtureDraftInput, parseMarked } from "./fixtures";

const BODY = "I am applying for the Summer Analyst – Markets role at Northbridge Capital. I ran the trading desk of our student fund.";
const lint = (text: string, ownSpans: Span[] = [], limit: Limit = null) =>
  lintLetter(text, { mode: "short_note", limit, company: FIXTURE_COMPANY, role: FIXTURE_ROLE, otherEmployers: [], ownSpans });

describe("canMarkReady", () => {
  it("passes a clean letter", () => {
    expect(canMarkReady({ text: BODY, spans: [], lint: lint(BODY), limit: null })).toEqual({ ok: true });
  });

  it("an invented number cannot be marked Ready", () => {
    const m = parseMarked("Dear Northbridge Graduate Recruitment Team,\n\nI am applying for the 2027 Summer Analyst Programme in Markets at Northbridge Capital.⟦them:jd⟧ I ran the trading desk of a £50k student investment fund with 12 traders.⟦me:x1-b0⟧\n\nYours faithfully,\nAlex Morgan");
    const v = verifyOutput({ ...m, input: fixtureDraftInput(), ownSpans: [] });
    const r = canMarkReady({ text: m.text, ...v, limit: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.join(" ")).toMatch(/unsupported number/);
  });

  it("a placeholder [Company] cannot be marked Ready", () => {
    const text = BODY + " I would bring this to [Company].";
    const r = canMarkReady({ text, spans: [], lint: lint(text), limit: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons.join(" ")).toMatch(/Placeholder/);
  });

  it("own text is exempt from block", () => {
    const own = " I am a real team player!";
    const text = BODY + own;
    const span: Span = { start: BODY.length + 1, end: text.length, kind: "theirs", refs: [] };
    const hits = lint(text, [span]);
    expect(hits.some((h) => h.severity === "block" && h.scope === "theirs")).toBe(true);
    expect(canMarkReady({ text, spans: [span], lint: hits, limit: null })).toEqual({ ok: true });
  });

  it("the same words written by the AI do block", () => {
    const text = BODY + " I am a real team player!";
    expect(canMarkReady({ text, spans: [], lint: lint(text), limit: null }).ok).toBe(false);
  });

  it("ready blocked over char limit", () => {
    const limit: Limit = { unit: "chars", max: BODY.length - 1 };
    const r = canMarkReady({ text: BODY, spans: [], lint: [], limit });
    expect(r).toEqual({ ok: false, reasons: [`Over the limit (${BODY.length}/${BODY.length - 1} chars)`] });
    expect(canMarkReady({ text: BODY, spans: [], lint: [], limit: { unit: "chars", max: BODY.length } })).toEqual({ ok: true });
  });

  it("counts newlines toward a char limit", () => {
    const text = "Line one.\n\nLine two.";
    expect(canMarkReady({ text, spans: [], lint: [], limit: { unit: "chars", max: 19 } }).ok).toBe(false);
  });

  it("a flagged AI span blocks; letter-scope block hits block; high and med hits do not", () => {
    const flaggedSpan: Span = { start: 0, end: 10, kind: "ai", refs: [], flag: "not on your CV" };
    const r = canMarkReady({ text: BODY, spans: [flaggedSpan], lint: [], limit: null });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reasons[0]).toMatch(/not on your CV/);
    const letterHit = { ruleId: "CL-20", label: "Company not named in the opening", severity: "block" as const, start: 0, end: 5, scope: "letter" as const };
    expect(canMarkReady({ text: BODY, spans: [], lint: [letterHit], limit: null }).ok).toBe(false);
    const soft = { ...letterHit, severity: "high" as const, scope: "ai" as const };
    expect(canMarkReady({ text: BODY, spans: [], lint: [soft, { ...soft, severity: "med" }], limit: null })).toEqual({ ok: true });
  });

  it("an empty letter cannot be marked Ready", () => {
    expect(canMarkReady({ text: "  ", spans: [], lint: [], limit: null }).ok).toBe(false);
  });
});
