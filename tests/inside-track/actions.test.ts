import { describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db/client";
import { outreach } from "@/lib/db/schema";
import { seedJob, U, withTempDb } from "../gamify/temp-db";

const drafted = vi.hoisted(() => [] as unknown[]);
vi.mock("@/lib/db/queries", () => ({ getActiveCv: async () => ({ id: "cv", parsed: { name: "A" }, rawText: "cv text" }) }));
vi.mock("@/lib/outreach/draft", () => ({
  draftOutreach: async (i: unknown) => { drafted.push(i); return { connectionNote: "Hi Priya", coffeeChat: "Coffee?", questions: [], removed: [] }; },
  isEmptyDraft: () => false,
}));

const { draftInsideTrack } = await import("@/app/(app)/jobs/[id]/inside-track-actions");
withTempDb(() => { db.delete(outreach).run(); drafted.length = 0; });

describe("draftInsideTrack", () => {
  it("refuses bad input", async () => {
    expect(await draftInsideTrack("nope", "alumni", "Priya Shah")).toMatchObject({ ok: false });
    expect(await draftInsideTrack(seedJob(), "recent_joiner", "Priya Shah")).toMatchObject({ ok: false });
    expect(await draftInsideTrack(seedJob(), "alumni", "  ")).toMatchObject({ ok: false });
  });

  it("drafts with the first name, stores the full name, and reuses the draft unless asked to rewrite", async () => {
    const jobId = seedJob({ title: "Data Analyst" }, "Monzo");
    const r = await draftInsideTrack(jobId, "alumni", "Priya  Shah");
    expect(r).toEqual({ ok: true, id: expect.any(String), note: "Hi Priya", removed: [] });
    expect(drafted[0]).toMatchObject({ recipientName: "Priya", target: "alumni" });
    expect(db.select().from(outreach).get()).toMatchObject({ user_id: U, recipient_name: "Priya Shah", body: "Hi Priya\n\nCoffee?" });

    expect(await draftInsideTrack(jobId, "alumni", "Priya Shah")).toMatchObject({ ok: true, id: r.ok ? r.id : "" });
    expect(drafted).toHaveLength(1);
    await draftInsideTrack(jobId, "alumni", "Priya Shah", true);
    expect(drafted).toHaveLength(2);
  });

  it("caps drafts per role per day", async () => {
    const jobId = seedJob();
    for (let i = 0; i < 8; i++) expect(await draftInsideTrack(jobId, "team", `Person Number${String.fromCharCode(65 + i)}`)).toMatchObject({ ok: true });
    expect(await draftInsideTrack(jobId, "team", "One More")).toMatchObject({ ok: false, message: expect.stringContaining("plenty") });
  });
});
