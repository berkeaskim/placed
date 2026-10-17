import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/auth/local-user", async (orig) => {
  const m = await orig<typeof import("@/lib/auth/local-user")>();
  return { ...m, requireUser: async () => ({ user: { id: m.LOCAL_USER_ID, email: m.LOCAL_USER_EMAIL } }) };
});
import { LOCAL_USER_ID as U } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { applications, bankBullets, bankEntries, bankSources, bankSuggestions, cvs } from "@/lib/db/schema";
import { getJob } from "@/lib/db/queries";
import { getBank, insertEntry, updateBullet } from "@/lib/bank/store";
import { bankStamp, cvForJob, groundingText, isStale } from "@/lib/bank/tailor-context";
import { toTailored } from "@/lib/verify/tailoring";
import { reverifyEdits, type TailorOutcome } from "@/lib/tailor/run";
import type { ParsedCV } from "@/lib/types";
import type { StoredTailoring } from "@/app/(app)/jobs/[id]/actions";
import { previewTailoring } from "@/app/(app)/jobs/[id]/tailor-actions";
import { seedCv, seedJob, withTempDb } from "../cv/temp-db";

withTempDb();

const activeCv = (): ParsedCV => ({
  name: "Ada Student", email: "ada@example.com", phone: "07700 900000", location: "London", links: [], summary: null,
  education: [{ id: "ed0", institution: "University College London", degree: "BSc Mathematics", dates: "2024 - 2027", grade: "First", details: [] }],
  experience: [{ id: "x0", org: "Hargreave Capital", title: "Spring Insight Intern", dates: "Apr 2026", location: "London", bullets: [
    { id: "x0-b0", text: "Summarised 12 company filings into one-page briefings for senior analysts" },
    { id: "x0-b1", text: "Built a Python screen of 40 FTSE 250 stocks by margin and growth" },
  ] }],
  projects: [], leadership: [], skills: [{ group: "Technical", items: ["Python", "Excel"] }], interests: null,
  sectionOrder: ["education", "experience", "skills"], yearGuess: null, archetypes: [],
});
const RAW = "ACTIVE CV RAW TEXT Hargreave Capital";

async function setup() {
  seedCv({ is_active: true, parsed_json: activeCv() as never, raw_text: RAW });
  const row = seedJob({ title: "Data Analyst Intern", text_lines: ["## Requirements", "- Python", "- SQL"] });
  const job = (await getJob(row.id))!;
  return job;
}

const outcomeFor = (cv: ParsedCV) => ({ tailored: toTailored(cv) }) as unknown as TailorOutcome;

async function storedV2(job: NonNullable<Awaited<ReturnType<typeof getJob>>>): Promise<Extract<StoredTailoring, { v: 2 }>> {
  const r = await cvForJob(U, job, null);
  if (!r?.selection) throw new Error("expected a selection");
  return {
    v: 2, outcome: outcomeFor(r.parsed), final: null, base: r.parsed, rawText: r.rawText, report: r.selection.report,
    scores: r.selection.scores, overrides: { pinned: [], excluded: [] }, bankStamp: bankStamp(getBank(U), r.parsed),
  };
}
const firstBulletId = (cv: ParsedCV) => cv.experience[0].bullets[0].id;
const tick = () => new Promise((r) => setTimeout(r, 5));

describe("tailor context from the bank", () => {
  beforeEach(() => {
    for (const t of [applications, bankSuggestions, bankBullets, bankEntries, bankSources, cvs]) db.delete(t).run();
  });

  it("v1 stored row falls back to active CV", async () => {
    const job = await setup();
    const r = await cvForJob(U, job, { v: 1, outcome: outcomeFor(activeCv()), final: null });
    expect(r?.parsed).toEqual(activeCv());
    expect(r?.rawText).toBe(RAW);
    expect(r?.selection).toBeNull();
  });

  it("v2 stored row returns frozen base even after bank edits", async () => {
    const job = await setup();
    const stored = await storedV2(job);
    expect(firstBulletId(stored.base)).not.toBe("x0-b0"); // bank ids
    await tick();
    updateBullet(U, firstBulletId(stored.base), { text: "Something else entirely" });
    const r = await cvForJob(U, job, stored);
    expect(r?.parsed).toEqual(stored.base);
    expect(r?.rawText).toBe(stored.rawText);
    expect(r?.selection).toBeNull();
  });

  it("isStale after editing a bullet in base", async () => {
    const job = await setup();
    const stored = await storedV2(job);
    expect(isStale(U, stored)).toBe(false);
    await tick();
    updateBullet(U, firstBulletId(stored.base), { text: "Summarised 12 company filings for analysts" });
    expect(isStale(U, stored)).toBe(true);
    expect(isStale(U, { v: 1, outcome: stored.outcome, final: null })).toBe(false);
  });

  it("isStale after hiding a bullet in base; preview still works", async () => {
    const job = await setup();
    const stored = await storedV2(job);
    await tick();
    const hidden = firstBulletId(stored.base);
    updateBullet(U, hidden, { hidden: true });
    expect(isStale(U, stored)).toBe(true);
    db.insert(applications).values({ user_id: U, job_id: job.id, tailored_json: stored }).run();
    const r = await cvForJob(U, job, stored);
    expect(firstBulletId(r!.parsed)).toBe(hidden); // frozen base keeps the hidden bullet
    expect(reverifyEdits({ cv: r!.parsed, rawText: r!.rawText, job, confirmedFacts: [], tailored: stored.outcome.tailored }).renderable).toBe(true);
    const p = await previewTailoring(job.id, stored.outcome.tailored);
    expect("error" in p).toBe(false);
    if (!("error" in p)) expect(p.report.verdict).not.toBe("block");
  });

  it("groundingText contains active raw_text and bank sourceText", async () => {
    const job = await setup();
    await cvForJob(U, job, null); // bootstraps the bank
    insertEntry(U, {
      section: "projects", org: "Rent Tracker", title: "Personal project", dates: "2025", startYm: "2025-01", endYm: "2025-06", location: "",
      pinned: false, hidden: false, sourceIds: ["manual"],
      bullets: [{ text: "Cleaned 1,200 rental listings with Python and SQL", position: 0, pinned: false, hidden: false, sourceIds: ["manual"], sourceText: "POST EXCERPT: I cleaned 1,200 listings" }],
    });
    const r = await cvForJob(U, job, null);
    const text = groundingText(RAW, r!.parsed, getBank(U));
    expect(text).toContain(RAW);
    expect(text).toContain("Cleaned 1,200 rental listings with Python and SQL");
    expect(text).toContain("POST EXCERPT: I cleaned 1,200 listings");
    expect(r!.rawText).toBe(text);
  });
});
