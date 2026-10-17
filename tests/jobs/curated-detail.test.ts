import { describe, it, expect, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// Server action + toast are not reachable from a static render; the dialog is mocked to always render a marker,
// so its absence proves the curated link has no "Did you apply?" path that records an application.
vi.mock("@/components/mark-applied", () => ({
  useMarkApplied: (_id: string, applied: boolean) => ({ applied, pending: false, mark: vi.fn() }),
  AppliedChip: () => createElement("span", null, "Applied"),
}));
vi.mock("@/components/ui/dialog", () => {
  const Pass = (p: { children?: unknown }) => createElement("div", { "data-dialog": "" }, p.children as never);
  return { Dialog: Pass, DialogContent: Pass, DialogDescription: Pass, DialogHeader: Pass, DialogTitle: Pass };
});

const { ApplyButton } = await import("@/app/(app)/jobs/[id]/apply-button");
const { curatedDetail } = await import("@/lib/jobs/detail");

const props = { jobId: "j1", url: "https://example.com/programme", company: "BCG", alreadyApplied: false };

describe("job detail for curated programme cards", () => {
  it("live postings keep the Apply link and the Did-you-apply dialog", () => {
    const html = renderToStaticMarkup(createElement(ApplyButton, props));
    expect(html).toContain("Apply on company site");
    expect(html).toContain("data-dialog");
  });

  it("curated cards link to the official programme page, without the apply dialog, and keep mark-as-applied", () => {
    const html = renderToStaticMarkup(createElement(ApplyButton, { ...props, curated: true }));
    expect(html).toContain("Official programme page");
    expect(html).not.toContain("Apply on company site");
    expect(html).not.toContain("data-dialog");
    expect(html).toContain("Mark as applied");
  });

  it("hides Autopilot, shows the Curated chip and an honest unscored note", () => {
    expect(curatedDetail({ curated: true }, true)).toEqual({
      curated: true, showAutopilot: false, unscoredNote: "Curated programme: no posting text to score against yet",
    });
    expect(curatedDetail({ curated: false }, true)).toEqual({ curated: false, showAutopilot: true, unscoredNote: null });
    expect(curatedDetail({}, false).showAutopilot).toBe(false);
  });
});
