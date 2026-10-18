import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_USER_ID as U } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { bankBullets, bankEntries, bankSources, bankSuggestions } from "@/lib/db/schema";
import { getBank, insertEntry, insertSuggestion, listSuggestions, upsertSource } from "@/lib/bank/store";
import { acceptAllFromSource, acceptSuggestion, rejectSuggestion } from "@/lib/bank/suggestions";
import type { CandidateEntry } from "@/lib/bank/types";
import { withTempDb } from "../cv/temp-db";

withTempDb();

const cand = (over: Partial<CandidateEntry> = {}): CandidateEntry => ({
  section: "experience", org: "Foo Partners", title: "Intern", dates: "2022", startYm: "2022-01", endYm: "2022-12", location: "",
  bullets: [{ text: "Prepared weekly reports for senior partners", sourceText: "orig report text" }], ...over,
});
const seedEntry = (org = "Acme") => insertEntry(U, {
  section: "experience", org, title: "Analyst", dates: "2024", startYm: "2024-06", endYm: "2024-08", location: "", pinned: false, hidden: false,
  sourceIds: [], bullets: [{ text: "Built a valuation model for retail clients", position: 0, pinned: false, hidden: false, sourceIds: [], sourceText: null }],
});
const src = (kind: "cv" | "linkedin_post" = "cv", ref = "r") => upsertSource(U, kind, ref, "x").id;

describe("bank suggestion review", () => {
  beforeEach(() => {
    db.delete(bankSuggestions).run();
    db.delete(bankBullets).run();
    db.delete(bankEntries).run();
    db.delete(bankSources).run();
  });

  it("accepts new_entry into the bank with provenance", () => {
    const s = src();
    const sg = insertSuggestion(U, { sourceId: s, kind: "new_entry", targetEntryId: null, payload: { candidate: cand() } });
    acceptSuggestion(U, sg.id);
    const e = getBank(U).entries.find((x) => x.org === "Foo Partners")!;
    expect(e.sourceIds).toEqual([s]);
    expect(e.bullets[0]).toMatchObject({ sourceIds: [s], sourceText: "orig report text" });
    expect(listSuggestions(U, "accepted")).toHaveLength(1);
  });

  it("accepts new_bullet at the end; editedText adds manual and keeps original sourceText", () => {
    const s = src();
    const entry = seedEntry();
    const sg = insertSuggestion(U, { sourceId: s, kind: "new_bullet", targetEntryId: entry.id, payload: { text: "Original text", sourceText: "Original text" } });
    acceptSuggestion(U, sg.id, { editedText: "Edited text" });
    const bs = getBank(U).entries[0].bullets;
    expect(bs).toHaveLength(2);
    expect(bs[1]).toMatchObject({ text: "Edited text", position: 1, sourceText: "Original text" });
    expect(bs[1].sourceIds).toEqual([s, "manual"]);
  });

  it("merge_into requires a target from payload.targets, then adds only non-duplicate bullets", () => {
    const s = src();
    const a = seedEntry("Acme");
    const b = seedEntry("Acme Ltd");
    const c = cand({ bullets: [
      { text: "Built a valuation model for retail clients", sourceText: "dup" },
      { text: "Led a pricing review with the desk", sourceText: "fresh" },
    ] });
    const sg = insertSuggestion(U, { sourceId: s, kind: "merge_into", targetEntryId: null, payload: { candidate: c, targets: [a.id, b.id] } });
    expect(() => acceptSuggestion(U, sg.id)).toThrow();
    expect(() => acceptSuggestion(U, sg.id, { targetEntryId: "nope" })).toThrow();
    expect(listSuggestions(U, "pending")).toHaveLength(1);
    acceptSuggestion(U, sg.id, { targetEntryId: b.id });
    const t = getBank(U).entries.find((e) => e.id === b.id)!;
    expect(t.bullets.map((x) => x.text)).toEqual(["Built a valuation model for retail clients", "Led a pricing review with the desk"]);
    expect(t.bullets[1]).toMatchObject({ sourceIds: [s], sourceText: "fresh" });
    expect(t.bullets[0].sourceIds).toEqual([s]);
    expect(t.sourceIds).toEqual([s]);
  });

  it("reject marks rejected; resolved suggestions are no-ops", () => {
    const s = src();
    const sg = insertSuggestion(U, { sourceId: s, kind: "new_entry", targetEntryId: null, payload: { candidate: cand() } });
    rejectSuggestion(U, sg.id);
    expect(listSuggestions(U, "rejected")).toHaveLength(1);
    acceptSuggestion(U, sg.id);
    expect(getBank(U).entries).toHaveLength(0);
    const sg2 = insertSuggestion(U, { sourceId: s, kind: "new_entry", targetEntryId: null, payload: { candidate: cand({ org: "Zed" }) } });
    acceptSuggestion(U, sg2.id);
    acceptSuggestion(U, sg2.id);
    rejectSuggestion(U, sg2.id);
    expect(getBank(U).entries).toHaveLength(1);
    expect(listSuggestions(U, "accepted")).toHaveLength(1);
  });

  it("acceptAllFromSource accepts only that source's pending, skips merge_into", () => {
    const s1 = src("cv", "a");
    const s2 = src("cv", "b");
    const entry = seedEntry();
    insertSuggestion(U, { sourceId: s1, kind: "new_entry", targetEntryId: null, payload: { candidate: cand() } });
    insertSuggestion(U, { sourceId: s1, kind: "new_bullet", targetEntryId: entry.id, payload: { text: "Another bullet", sourceText: "Another bullet" } });
    insertSuggestion(U, { sourceId: s1, kind: "merge_into", targetEntryId: null, payload: { candidate: cand({ org: "M" }), targets: [entry.id] } });
    insertSuggestion(U, { sourceId: s2, kind: "new_entry", targetEntryId: null, payload: { candidate: cand({ org: "Other" }) } });
    expect(acceptAllFromSource(U, s1)).toBe(2);
    expect(listSuggestions(U, "pending").map((x) => x.kind).sort()).toEqual(["merge_into", "new_entry"]);
    expect(getBank(U).entries.map((e) => e.org).sort()).toEqual(["Acme", "Foo Partners"]);
  });

  it("acceptAllFromSource refuses linkedin_post sources", () => {
    const s = src("linkedin_post", "p");
    insertSuggestion(U, { sourceId: s, kind: "new_entry", targetEntryId: null, payload: { candidate: cand() } });
    expect(() => acceptAllFromSource(U, s)).toThrow("Posts are reviewed one by one");
    expect(listSuggestions(U, "pending")).toHaveLength(1);
  });

  it("acceptAllFromSource rejects orphaned new_bullet suggestions and carries on", () => {
    const s = src();
    const a = seedEntry("Acme");
    const b = seedEntry("Beta");
    const o = insertSuggestion(U, { sourceId: s, kind: "new_bullet", targetEntryId: a.id, payload: { text: "Orphan bullet", sourceText: "Orphan bullet" } });
    insertSuggestion(U, { sourceId: s, kind: "new_bullet", targetEntryId: b.id, payload: { text: "Fine bullet", sourceText: "Fine bullet" } });
    db.delete(bankBullets).where(eq(bankBullets.entry_id, a.id)).run();
    db.delete(bankEntries).where(eq(bankEntries.id, a.id)).run();
    expect(acceptAllFromSource(U, s)).toBe(1);
    expect(listSuggestions(U, "rejected").map((x) => x.id)).toEqual([o.id]);
    expect(listSuggestions(U, "pending")).toHaveLength(0);
    expect(getBank(U).entries.find((e) => e.id === b.id)!.bullets.map((x) => x.text)).toContain("Fine bullet");
  });

  it("rejects blank editedText", () => {
    const s = src();
    const entry = seedEntry();
    const sg = insertSuggestion(U, { sourceId: s, kind: "new_bullet", targetEntryId: entry.id, payload: { text: "T", sourceText: "T" } });
    expect(() => acceptSuggestion(U, sg.id, { editedText: "   " })).toThrow("Bullet text can't be empty");
    expect(listSuggestions(U, "pending")).toHaveLength(1);
  });

  it("acceptAllFromSource logs a suggestion it had to skip and carries on", () => {
    const s = src();
    const bad = insertSuggestion(U, { sourceId: s, kind: "new_entry", targetEntryId: null, payload: { candidate: cand({ section: "bogus" as never }) } });
    insertSuggestion(U, { sourceId: s, kind: "new_entry", targetEntryId: null, payload: { candidate: cand({ org: "Good Co" }) } });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      expect(acceptAllFromSource(U, s)).toBe(1);
      expect(err).toHaveBeenCalledWith("acceptAllFromSource: skipped", bad.id, expect.stringMatching(/CHECK constraint/i));
    } finally { err.mockRestore(); }
    expect(listSuggestions(U, "pending").map((x) => x.id)).toEqual([bad.id]);
  });

  it("merge_into with bulletIndexes adds only the ticked bullets", () => {
    const e = seedEntry("Foo Partners");
    const s = src();
    const c = cand({ bullets: [{ text: "Ran the onboarding for new analysts", sourceText: "a" }, { text: "Wrote the quarterly market summary", sourceText: "b" }] });
    const sg = insertSuggestion(U, { sourceId: s, kind: "merge_into", targetEntryId: null, payload: { candidate: c, targets: [e.id] } });
    acceptSuggestion(U, sg.id, { targetEntryId: e.id, bulletIndexes: [0] });
    const texts = getBank(U).entries.find((x) => x.id === e.id)!.bullets.map((b) => b.text);
    expect(texts).toContain("Ran the onboarding for new analysts");
    expect(texts).not.toContain("Wrote the quarterly market summary");
  });
});
