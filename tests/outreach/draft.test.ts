import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ayse from "@/seed/demo/ayse.json";
import type { ParsedCV } from "@/lib/types";
import { checkOutreach, CONNECTION_NOTE_MAX } from "@/lib/outreach/guard";
import { draftOutreach, type DraftInput } from "@/lib/outreach/draft";
import { OUTREACH_TARGETS } from "@/lib/outreach/targets";

const base: DraftInput = {
  cv: ayse as unknown as ParsedCV, cvText: "", facts: [], note: null, company: "Lendable", jobTitle: "Credit Analyst Intern (June 2027)",
  target: "alumni", purpose: "intro", recipientName: "Sam",
};

describe("draftOutreach (live path with an injected generator)", () => {
  it("retries once with the problems named, then accepts a clean draft", async () => {
    const gen = vi.fn()
      .mockResolvedValueOnce({ connection_note: "Hi Sam, I interned at Goldman Sachs. Can we chat?", coffee_chat: "Hi Sam.", questions: ["What does a typical week look like?", "What helped you most in the interviews?"] })
      .mockResolvedValueOnce({ connection_note: "Hi Sam, I'm a UCL Economics student applying to Lendable. Could I ask you a couple of questions?", coffee_chat: "Hi Sam, thanks for connecting.", questions: ["What does a typical week look like?", "What helped you most in the interviews?"] });
    const d = await draftOutreach(base, gen);
    expect(gen).toHaveBeenCalledTimes(2);
    expect(gen.mock.calls[1][0]).toContain("Goldman Sachs");
    expect(d.removed).toEqual([]);
    expect(d.connectionNote).toContain("UCL Economics");
  });
  it("removes sentences still blocked after the retry, and fits the note to 300", async () => {
    const bad = { connection_note: `Hi Sam, I interned at Goldman Sachs. ${"I'm a UCL Economics student. ".repeat(15)}`, coffee_chat: "Hi Sam. I read your article on credit.", questions: ["Q1?", "Q2?"] };
    const d = await draftOutreach(base, vi.fn().mockResolvedValue(bad));
    expect(d.connectionNote).not.toContain("Goldman");
    expect(d.connectionNote.length).toBeLessThanOrEqual(CONNECTION_NOTE_MAX);
    expect(d.coffeeChat).not.toContain("article");
    expect(d.removed.length).toBeGreaterThanOrEqual(2);
  });
});

describe("demo fixtures", () => {
  const saved = process.env.AI_MODE;
  beforeEach(() => { process.env.AI_MODE = "fixture"; });
  afterEach(() => { if (saved === undefined) delete process.env.AI_MODE; else process.env.AI_MODE = saved; });

  it.each([...OUTREACH_TARGETS.map((t) => [t, "intro"] as const), ["recruiter", "follow_up"] as const, ["alumni", "interview_prep"] as const])(
    "%s/%s fixture is clean against the demo CV and fills in company and name", async (target, purpose) => {
      const d = await draftOutreach({ ...base, target, purpose });
      expect(d.removed).toEqual([]);
      expect(d.connectionNote.length).toBeLessThanOrEqual(CONNECTION_NOTE_MAX);
      expect(`${d.connectionNote} ${d.coffeeChat}`).toContain("Lendable");
      expect(`${d.connectionNote} ${d.coffeeChat}`).not.toMatch(/\{(company|name|role)\}/);
      expect(checkOutreach(`${d.connectionNote} ${d.coffeeChat}`, { ...base, allowInterviewClaim: purpose === "interview_prep" })).toEqual([]);
      expect(d.questions.length).toBeGreaterThanOrEqual(2);
    });
});
