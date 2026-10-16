import { describe, it, expect, vi } from "vitest";
import { attachSources, resolveSources, roleKey, type PrepModelOutputT } from "@/lib/interview-prep/sources";

const REDIRECT = "https://vertexaisearch.cloud.google.com/grounding-api-redirect/";
const redirectTo = (loc: string | null, status = 302) => new Response(null, { status, headers: loc ? { location: loc } : {} });

describe("roleKey", () => {
  it("joins archetype and employment type, with general for no archetype", () => {
    expect(roleKey({ archetype: "investment_banking", employmentType: "internship" })).toBe("investment_banking:internship");
    expect(roleKey({ archetype: null, employmentType: "graduate" })).toBe("general:graduate");
  });
});

describe("resolveSources", () => {
  it("follows grounding redirects to the real page, dedupes, and keeps the chunk title", async () => {
    const f = vi.fn()
      .mockResolvedValueOnce(redirectTo("https://www.reddit.com/r/FinancialCareers/comments/abc"))
      .mockResolvedValueOnce(redirectTo("https://www.reddit.com/r/FinancialCareers/comments/abc"))
      .mockResolvedValueOnce(redirectTo("https://www.wallstreetoasis.com/company/goldman-sachs/interview"));
    const out = await resolveSources([
      { uri: `${REDIRECT}a`, title: "reddit.com" }, { uri: `${REDIRECT}b`, title: "reddit.com" }, { uri: `${REDIRECT}c`, title: "wallstreetoasis.com" },
    ], f as unknown as typeof fetch);
    expect(out).toEqual([
      { url: "https://www.reddit.com/r/FinancialCareers/comments/abc", title: "reddit.com" },
      { url: "https://www.wallstreetoasis.com/company/goldman-sachs/interview", title: "wallstreetoasis.com" },
    ]);
    expect(f).toHaveBeenCalledWith(`${REDIRECT}a`, expect.objectContaining({ method: "HEAD", redirect: "manual" }));
  });

  it("drops chunks whose redirect fails, has no location, or is not http(s)", async () => {
    const f = vi.fn()
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(redirectTo(null, 404))
      .mockResolvedValueOnce(redirectTo("javascript:alert(1)"));
    const out = await resolveSources([{ uri: `${REDIRECT}a`, title: "a" }, { uri: `${REDIRECT}b`, title: "b" }, { uri: `${REDIRECT}c`, title: "c" }], f as unknown as typeof fetch);
    expect(out).toEqual([]);
  });

  it("keeps a direct (non-redirect) https uri without fetching, and caps at 12 sources", async () => {
    const f = vi.fn();
    const chunks = Array.from({ length: 15 }, (_, i) => ({ uri: `https://example.com/p${i}`, title: `t${i}` }));
    const out = await resolveSources(chunks, f as unknown as typeof fetch);
    expect(out).toHaveLength(12);
    expect(f).not.toHaveBeenCalled();
  });
});

describe("attachSources", () => {
  const raw: PrepModelOutputT = {
    process: [{ stage: "HireVue", note: "Three questions" }],
    tips: [],
    questions: [
      { question: "Why us?", category: "motivational", reported: true, sourceIndex: 0, whyTheyAsk: "w", prepTip: "p" },
      { question: "Walk me through a DCF", category: "technical", reported: true, sourceIndex: 7, whyTheyAsk: "w", prepTip: "p" },
      { question: "Tell me about a failure", category: "behavioural", reported: true, sourceIndex: null, whyTheyAsk: "w", prepTip: "p" },
      { question: "Market sizing", category: "case", reported: false, sourceIndex: 0, whyTheyAsk: "w", prepTip: "p" },
      { question: "Negative", category: "case", reported: true, sourceIndex: -1, whyTheyAsk: "w", prepTip: "p" },
    ],
  };
  const sources = [{ url: "https://www.reddit.com/r/x", title: "reddit.com" }];

  it("marks a question reported only with a valid index, and copies the url from the list", () => {
    const qs = attachSources(raw, sources, true).questions;
    expect(qs.map((q) => [q.reported, q.sourceUrl])).toEqual([
      [true, "https://www.reddit.com/r/x"], [false, null], [false, null], [false, null], [false, null],
    ]);
  });

  it("marks nothing as reported when the research was not grounded", () => {
    expect(attachSources(raw, sources, false).questions.every((q) => !q.reported && q.sourceUrl === null)).toBe(true);
  });
});
