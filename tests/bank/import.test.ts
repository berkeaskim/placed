import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { LOCAL_USER_ID as U } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { cvs, linkedinScores } from "@/lib/db/schema";
import { getBank, insertEntry, listSuggestions, setSuggestionStatus } from "@/lib/bank/store";
import { ensureBank, importCandidates, importCvPdf, importLinkedInFromLatestCapture } from "@/lib/bank/import";
import type { CandidateEntry } from "@/lib/bank/types";
import { seedCv, withTempDb } from "../cv/temp-db";

withTempDb();

const cvJson = (extra: boolean) => ({
  name: "A", email: null, phone: null, location: null, links: [], summary: null, education: [], skills: [], interests: null,
  sectionOrder: [], yearGuess: null, archetypes: [], projects: [], leadership: [],
  experience: [
    { id: "e1", org: "Acme Capital", title: "Analyst", dates: "Jun 2024 - Aug 2024", location: "London", bullets: [{ id: "b1", text: "Built a valuation model for retail clients" }] },
    ...(extra ? [{ id: "e2", org: "Zeta Labs", title: "Researcher", dates: "2023", location: "", bullets: [{ id: "b2", text: "Analysed survey data for the lab" }] }] : []),
  ],
});

const cand = (over: Partial<CandidateEntry> = {}): CandidateEntry => ({
  section: "experience", org: "Foo Partners", title: "Intern", dates: "2022", startYm: "2022-01", endYm: "2022-12", location: "",
  bullets: [{ text: "Prepared weekly reports for senior partners", sourceText: "Prepared weekly reports for senior partners" }], ...over,
});

let n = 0;
const src = () => ({ kind: "manual" as const, ref: `r${n++}`, rawText: "x" });

describe("experience bank import", () => {
  beforeEach(() => { db.delete(cvs).run(); });

  it("ensureBank bootstraps from the active CV with no suggestions", async () => {
    // fresh user bank state: use a clean slate via distinct CV content
    seedCv({ is_active: true, parsed_json: cvJson(false) as never, raw_text: "cv-one" });
    const r = await ensureBank(U);
    expect(r.bootstrapped).toBe(true);
    const bank = getBank(U);
    expect(bank.entries.some((e) => e.org === "Acme Capital" && e.bullets.length === 1)).toBe(true);
    expect(listSuggestions(U, "pending")).toHaveLength(0);
  });

  it("re-running ensureBank is a no-op", async () => {
    const before = getBank(U).entries.length;
    const r = await ensureBank(U);
    expect(r).toEqual({ bootstrapped: false, newCvSuggestions: 0 });
    expect(getBank(U).entries.length).toBe(before);
  });

  it("new active CV yields suggestions not rows", async () => {
    const before = getBank(U).entries.length;
    db.update(cvs).set({ is_active: false }).run();
    seedCv({ is_active: true, parsed_json: cvJson(true) as never, raw_text: "cv-two" });
    const r = await ensureBank(U);
    expect(r.newCvSuggestions).toBe(1);
    expect(getBank(U).entries.length).toBe(before);
  });

  it("duplicate bullet appends source instead of suggesting", () => {
    const first = importCandidates(U, src(), [cand()], { autoAccept: true });
    expect(first.suggestions).toBe(0);
    const s2 = upsertAndImport();
    expect(s2.duplicates).toBe(1);
    expect(s2.suggestions).toBe(0);
    const e = getBank(U).entries.find((x) => x.org === "Foo Partners")!;
    expect(e.bullets).toHaveLength(1);
    expect(e.bullets[0].sourceIds).toHaveLength(2);
    expect(e.sourceIds).toHaveLength(2);
  });

  it("autoAccept on a matched entry adds non-duplicate bullets directly", () => {
    importCandidates(U, src(), [cand({ bullets: [{ text: "Negotiated supplier contracts across three regions", sourceText: "x" }] })], { autoAccept: true });
    const e = getBank(U).entries.find((x) => x.org === "Foo Partners")!;
    expect(e.bullets).toHaveLength(2);
  });

  it("a rejected suggestion is not offered again", () => {
    const c = cand({ org: "Rej Corp", title: "Trainee" });
    expect(importCandidates(U, src(), [c], { autoAccept: false }).suggestions).toBe(1);
    const s = listSuggestions(U, "pending").find((x) => x.kind === "new_entry" && (x.payload as { candidate: CandidateEntry }).candidate.org === "Rej Corp")!;
    setSuggestionStatus(U, s.id, "rejected");
    expect(importCandidates(U, src(), [c], { autoAccept: false }).suggestions).toBe(0);
    // pending equal is skipped too
    const c2 = cand({ org: "Pend Corp", title: "Trainee" });
    importCandidates(U, src(), [c2], { autoAccept: false });
    expect(importCandidates(U, src(), [c2], { autoAccept: false }).suggestions).toBe(0);
  });

  it("2+ matches yield merge_into with targets", () => {
    const mk = () => insertEntry(U, { section: "experience", org: "Dup Co", title: "Analyst", dates: "2020", startYm: "2020-01", endYm: "2020-12", location: "", pinned: false, hidden: false, sourceIds: [], bullets: [] });
    const ids = [mk().id, mk().id];
    const r = importCandidates(U, src(), [cand({ org: "Dup Co", title: "Analyst", startYm: "2020-03", endYm: "2020-04" })], { autoAccept: false });
    expect(r.suggestions).toBe(1);
    const s = listSuggestions(U, "pending").find((x) => x.kind === "merge_into")!;
    expect((s.payload as { targets: string[] }).targets.sort()).toEqual(ids.sort());
  });

  it("importing the same LinkedIn twice creates no new suggestions", () => {
    const profile = {
      profileUrl: "https://linkedin.com/in/test", experience: [
        { company: "Linked Co", title: "Associate", dates: "Jun 2021 - Aug 2021", start: null, end: null, location: null, description: "• Wrote detailed market sizing analyses weekly\n• Coordinated client workshops across Europe" },
      ],
    };
    db.insert(linkedinScores).values({
      id: crypto.randomUUID(), user_id: U, sector: "consulting", year: "2026", total: 1, label: "l", dimensions: {}, profile_json: profile, text_hash: "h",
    }).run();
    const a = importLinkedInFromLatestCapture(U) as { ok: true; suggestions: number };
    expect(a.ok).toBe(true);
    expect(a.suggestions).toBeGreaterThan(0);
    const b = importLinkedInFromLatestCapture(U) as { ok: true; suggestions: number };
    expect(b.suggestions).toBe(0);
    db.delete(linkedinScores).where(eq(linkedinScores.user_id, U)).run();
    expect(importLinkedInFromLatestCapture(U)).toEqual({ error: "Capture your profile with the extension first" });
  });

  describe("importCvPdf", () => {
    const saved = process.env.AI_MODE;
    beforeEach(() => { process.env.AI_MODE = "fixture"; });
    afterEach(() => { if (saved === undefined) delete process.env.AI_MODE; else process.env.AI_MODE = saved; });
    it("never writes cvs", async () => {
      seedCv({ is_active: true, parsed_json: cvJson(false) as never, raw_text: "cv-x" });
      const count = () => db.select().from(cvs).all().length;
      const before = count();
      const bytes = new Uint8Array(readFileSync("tests/linkedin/fixtures/ayse-synthetic-export.pdf"));
      const r = await importCvPdf(U, bytes);
      expect(typeof r.suggestions).toBe("number");
      expect(count()).toBe(before);
    });
  });
});

function upsertAndImport() {
  return importCandidates(U, src(), [cand()], { autoAccept: false });
}
