import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { CvScorePanelData } from "@/lib/cv-score/panel-data";
import { IMAGE_ONLY_CAP } from "@/lib/cv-score/aggregate";

vi.mock("@/components/cv-score/actions", () => ({ disagreeWithFix: vi.fn() }));
vi.mock("next/link", () => ({ default: (p: { href: string; children: unknown; className?: string }) => createElement("a", { href: p.href, className: p.className }, p.children as never) }));

const { CvScorePanel } = await import("@/components/cv-score-panel");

const data: CvScorePanelData = {
  cvId: "00000000-0000-4000-8000-000000000001", sector: "consulting", track: "standard", total: 68,
  dimensions: { ats: 82, impact: 54, clarity: 71, relevance: 66, uk: null },
  capsApplied: [IMAGE_ONLY_CAP],
  fixes: [
    { ruleId: "GEN-04", statement: "Quantify results.", dimension: "impact", lostPoints: 9, gain: 9.2, evidenceLine: "Organised weekly society events", fix: "Organised weekly events for [add your real number] members", citation: { title: "CV guide", publisher: "Prospects", year: "2025", url: "https://www.prospects.ac.uk/cv" }, evidence: "A", convention: false },
    { ruleId: "CON-02", statement: "Show leadership.", dimension: "relevance", lostPoints: 4, gain: 0.3, evidenceLine: null, fix: null, citation: null, evidence: "D", convention: true },
  ],
  assessed: 31, passed: 23, couldNotAssess: 2, history: [55, 61, 68], aiSaw: "CV\n[NAME]\nEDUCATION",
  aiUnavailable: false, provisional: false, range: { low: 68, high: 68 }, coverage: 1, scoredBy: "anthropic:claude-sonnet-5-5",
  madeByPlaced: false, disputed: [], delta: null,
};

describe("CvScorePanel render", () => {
  const html = renderToStaticMarkup(createElement(CvScorePanel, { data }));
  it("puts the next best fix before the ring", () => {
    expect(html.indexOf("Next best fix")).toBeGreaterThan(-1);
    expect(html.indexOf("Next best fix")).toBeLessThan(html.indexOf("Your CV Score"));
  });
  it("renders the B11 anatomy and labels", () => {
    expect(html).toContain("“Organised weekly society events”");
    expect(html).toContain("Source: Prospects · Evidence A");
    expect(html).toContain("[add your real number]");
    expect(html).toContain("Common practice · Evidence D");
    expect(html).toContain("Convention");
    expect(html).toContain("Developing");
    expect(html).toContain("Rules passed 23/31");
    expect(html).toContain("2 couldn&#x27;t assess");
    expect(html).toContain("for Consulting");
    expect(html).toContain("Big 4");
    expect(html).toContain("It does not predict whether you&#x27;ll get an interview.");
    expect(html).toContain('href="/profile/quiz"');
    expect(html).toContain("What our AI saw");
    expect(html).toContain("<polyline");
    expect(html).toContain("Score history: first 55, latest 68, 3 points");
    expect(html).toContain('target="_blank"');
  });
});

describe("CvScorePanel when the AI review failed", () => {
  it("says the score is the automatic checks only", () => {
    const html = renderToStaticMarkup(createElement(CvScorePanel, { data: { ...data, aiUnavailable: true } }));
    expect(html).toContain("AI review unavailable — showing the automatic checks only");
  });
  it("shows no such note otherwise", () => {
    expect(renderToStaticMarkup(createElement(CvScorePanel, { data }))).not.toContain("AI review unavailable");
  });
});

// Audit 04#22–#25, #28, #30: transparency on the panel itself.
describe("CvScorePanel transparency", () => {
  const render = (over: Partial<CvScorePanelData> = {}) => renderToStaticMarkup(createElement(CvScorePanel, { data: { ...data, ...over } }));
  const outsideDetails = (html: string, needle: string) => {
    const at = html.indexOf(needle);
    expect(at).toBeGreaterThan(-1);
    // Not inside any <details> (collapsed by default): every <details> before it is closed before it.
    const before = html.slice(0, at);
    return (before.match(/<details/g) ?? []).length === (before.match(/<\/details>/g) ?? []).length;
  };
  it("shows the 'does not predict interviews' disclaimer visibly, not in a collapsed section (04#23)", () => {
    expect(outsideDetails(render(), "It does not predict whether you&#x27;ll get an interview.")).toBe(true);
  });
  it("links the model card from 'How this score works' (04#24)", () => {
    const html = render();
    expect(html).toContain('href="https://github.com/berkeaskim/placed/blob/main/docs/validation/MODEL_CARD.md"');
    expect(html).toContain("Read the model card");
    expect(html.indexOf("How this score works")).toBeLessThan(html.indexOf("Read the model card"));
    expect(html).toContain("not yet set from data");
  });
  it("labels a CV made by Placed's tailor and warns against reading the rise as proof (04#28)", () => {
    expect(render()).not.toContain("Judged by the same AI family that tailored it");
    const html = render({ madeByPlaced: true });
    expect(html).toContain("Judged by the same AI family that tailored it");
    expect(html).toContain("isn&#x27;t proof that this version is better");
    expect(outsideDetails(html, "Judged by the same AI family that tailored it")).toBe(true);
  });
  it("marks a disputed verdict without hiding it or changing the score (04#25)", () => {
    const html = render({ disputed: ["GEN-04"] });
    expect(html).toContain("Disputed");
    expect(html).toContain("You disagreed");
    expect(html).toContain("“Organised weekly society events”");
    expect(html).toContain("CV score 68 out of 100");
    expect(render()).not.toContain("You disagreed");
  });
  it("says which verdicts were re-checked after an edit (04#30)", () => {
    expect(render({ delta: { reused: 30, rejudged: 9 } })).toContain("re-checked 9 rules your changes could affect; the other 30 kept their earlier verdict");
    expect(render({ delta: null })).not.toContain("re-checked");
  });
});
