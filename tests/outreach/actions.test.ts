import { describe, expect, it, vi } from "vitest";
import { db } from "@/lib/db/client";
import { applications, confirmedFacts, outreach } from "@/lib/db/schema";
import { seedJob, U, withTempDb } from "../gamify/temp-db";

const cv = vi.hoisted(() => ({ current: null as null | { id: string; parsed: unknown; rawText: string } }));
const drafted = vi.hoisted(() => [] as unknown[]);
vi.mock("@/lib/db/queries", () => ({ getActiveCv: async () => cv.current }));
vi.mock("@/lib/outreach/draft", () => ({
  draftOutreach: async (i: unknown) => { drafted.push(i); return { connectionNote: "Hi", coffeeChat: "Coffee?", questions: [], removed: [] }; },
  isEmptyDraft: () => false,
}));

const { draftOutreachAction, setOutreachStatus } = await import("@/app/(app)/outreach/actions");
withTempDb(() => { db.delete(outreach).run(); drafted.length = 0; cv.current = null; });
const raw = { target: "alumni", purpose: "intro", recipientName: "Sam", note: null };

describe("draftOutreachAction", () => {
  it("refuses bad input, a missing job and a missing CV", async () => {
    expect(await draftOutreachAction("nope", raw)).toMatchObject({ ok: false });
    expect(await draftOutreachAction(crypto.randomUUID(), raw)).toEqual({ ok: false, message: "That role no longer exists." });
    expect(await draftOutreachAction(seedJob(), raw)).toMatchObject({ ok: false, message: expect.stringContaining("Upload your CV") });
    expect(drafted).toHaveLength(0);
  });

  it("drafts from the CV and facts, stores the message against the application, and updates status", async () => {
    cv.current = { id: "cv", parsed: { name: "A" }, rawText: "cv text" };
    const jobId = seedJob({ title: "Analyst" }, "Northwind");
    const app = db.insert(applications).values({ user_id: U, job_id: jobId, status: "applied" }).returning().get();
    db.insert(confirmedFacts).values({ user_id: U, claim: "Led a team of 5" }).run();
    const r = await draftOutreachAction(jobId, raw);
    expect(r).toMatchObject({ ok: true, id: expect.any(String) });
    expect(drafted[0]).toMatchObject({ company: "Northwind", jobTitle: "Analyst", cvText: "cv text", facts: ["Led a team of 5"], recipientName: "Sam" });
    const row = db.select().from(outreach).get()!;
    expect(row).toMatchObject({ user_id: U, job_id: jobId, application_id: app.id, company: "Northwind", target: "alumni", body: "Hi\n\nCoffee?", status: "drafted" });

    expect(await setOutreachStatus(row.id, "sent")).toBe(true);
    expect(db.select().from(outreach).get()!.status).toBe("sent");
    expect(await setOutreachStatus(row.id, "drafted" as never)).toBe(false);
  });
});
