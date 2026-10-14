import { describe, expect, it, vi } from "vitest";
import { planInboxEvents, safeClassify } from "@/lib/inbox/plan";
import type { AppRef, Classification, RawEmail } from "@/lib/inbox/types";

const app: AppRef = { id: "a1", jobId: "j1", status: "saved", company: "Lendable", title: "Credit Analyst Intern" };
const mail = (id: string, date: string): RawEmail => ({ id, from: "x", subject: id, date, text: "" });
const cls = (kind: Classification["kind"]): Classification => ({ kind, company: "Lendable", roleHint: null, deadline: null, actionUrl: null, confidence: 0.9 });

describe("planInboxEvents", () => {
  it("processes oldest first so a later email builds on an earlier move", async () => {
    const byId: Record<string, Classification> = { a: cls("received"), b: cls("interview") };
    const out = await planInboxEvents({
      apps: [app], seen: new Set(),
      emails: [mail("b", "2026-10-12T00:00:00Z"), mail("a", "2026-10-01T00:00:00Z")], // newest first, as Gmail lists
      classify: async (e) => byId[e.id],
    });
    expect(out.map((p) => [p.email.id, p.decision, p.prevStatus])).toEqual([
      ["a", { effect: "moved", to: "applied" }, "saved"],
      ["b", { effect: "moved", to: "interview" }, "applied"],
    ]);
  });
  it("skips messages already seen without classifying them", async () => {
    const classify = vi.fn(async () => cls("interview"));
    const out = await planInboxEvents({ apps: [app], seen: new Set(["a"]), emails: [mail("a", "2026-10-01T00:00:00Z")], classify });
    expect(out).toEqual([]);
    expect(classify).not.toHaveBeenCalled();
  });
  it("records a no-move event with its application (so deadlines still count)", async () => {
    const out = await planInboxEvents({
      apps: [{ ...app, status: "interview" }], seen: new Set(), emails: [mail("a", "2026-10-01T00:00:00Z")],
      classify: async () => ({ ...cls("assessment"), deadline: "2026-10-20" }),
    });
    expect(out[0]).toMatchObject({ appId: "a1", jobId: "j1", decision: { effect: "none" }, prevStatus: null });
  });
  it("a throwing classifier yields a no-op event, not a rejected sync", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const out = await planInboxEvents({
      apps: [app], seen: new Set(), emails: [mail("a", "2026-10-01T00:00:00Z"), mail("b", "2026-10-02T00:00:00Z")],
      classify: safeClassify(async (e) => { if (e.id === "a") throw new Error("malformed"); return cls("received"); }),
    });
    expect(out).toHaveLength(2);
    expect(out[0].decision).toEqual({ effect: "none" });
    expect(out[1].decision).toEqual({ effect: "moved", to: "applied" });
  });
});
