import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db/client";
import { companies, jobs } from "@/lib/db/schema";
import { isBucket } from "@/lib/files";
import {
  deleteStory, findStories, getOrCreateLetter, getResearch, listOutputs, popUndo, pushUndo, putResearch, rememberStory, saveLetter, upsertOutput,
} from "@/lib/cover-letter/store";

const DAY = 24 * 60 * 60 * 1000;
let jobId: string;
beforeAll(() => {
  const c = db.insert(companies).values({ slug: "acme", name: "Acme", ats: "greenhouse" }).returning().get();
  jobId = db.insert(jobs).values({ company_id: c.id, ext_id: "1", title: "Intern", url: "https://x" }).returning().get().id;
});

describe("letters", () => {
  it("getOrCreateLetter is idempotent and saveLetter patches", () => {
    const a = getOrCreateLetter("u", jobId);
    expect(getOrCreateLetter("u", jobId).id).toBe(a.id);
    expect(a).toMatchObject({ chat: [], answers: [], facts: [], evidence: null, research_state: "idle", draft_state: "idle" });
    saveLetter(a.id, { draft_state: "done", chat: [{ id: "1", from: "bot", text: "hi" }] });
    expect(getOrCreateLetter("u", jobId)).toMatchObject({ draft_state: "done", chat: [{ id: "1", from: "bot", text: "hi" }] });
  });
});

describe("outputs", () => {
  it("are keyed by fieldKey, or by upload", () => {
    const l = getOrCreateLetter("u", jobId);
    const up = upsertOutput(l.id, { kind: "upload" }, { mode: "full_letter", text: "one" });
    const f1 = upsertOutput(l.id, { kind: "field", fieldKey: "q1", label: "Why us?" }, { mode: "field_answer", limit: { unit: "words", max: 300 } });
    const f2 = upsertOutput(l.id, { kind: "field", fieldKey: "q2", label: "Why role?" }, { mode: "field_answer" });
    expect(new Set([up.id, f1.id, f2.id]).size).toBe(3);
    const again = upsertOutput(l.id, { kind: "upload" }, { text: "two" });
    expect(again).toMatchObject({ id: up.id, text: "two", mode: "full_letter" });
    expect(upsertOutput(l.id, { kind: "field", fieldKey: "q1", label: "Why us?" }, { status: "ready" }).id).toBe(f1.id);
    expect(listOutputs(l.id)).toHaveLength(3);
  });
  it("popUndo returns entries last in, first out", () => {
    const l = getOrCreateLetter("u", jobId);
    const o = upsertOutput(l.id, { kind: "field", fieldKey: "undo", label: "U" }, { mode: "short_note" });
    pushUndo(o.id, { text: "a", spans: [] });
    pushUndo(o.id, { text: "b", spans: [] });
    expect(popUndo(o.id)?.text).toBe("b");
    expect(popUndo(o.id)?.text).toBe("a");
    expect(popUndo(o.id)).toBeNull();
  });
});

describe("stories", () => {
  it("findStories filters by cvEntryId and kind; deleteStory is per user", () => {
    rememberStory("u", { kind: "story", cvEntryId: "e1", text: "s1" });
    rememberStory("u", { kind: "story", cvEntryId: "e2", text: "s2" });
    rememberStory("u", { kind: "why_firm", company: "Acme", text: "w" });
    expect(findStories("u", { cvEntryId: "e1", kind: "story" }).map((s) => s.text)).toEqual(["s1"]);
    expect(findStories("u", { kind: "story" })).toHaveLength(2);
    const w = findStories("u", { company: "Acme", kind: "why_firm" });
    expect(w).toHaveLength(1);
    deleteStory("other", w[0].id);
    expect(findStories("u", { kind: "why_firm" })).toHaveLength(1);
    deleteStory("u", w[0].id);
    expect(findStories("u", { kind: "why_firm" })).toHaveLength(0);
  });
});

describe("research cache", () => {
  it("returns null at 7 days + 1 ms", () => {
    const t = Date.UTC(2026, 9, 1);
    putResearch({ company_key: "acme|", facts: [], rivals: ["Beta"], provider: "gemini", fetched_at: new Date(t).toISOString() });
    expect(getResearch("acme|", t + 7 * DAY)?.rivals).toEqual(["Beta"]);
    expect(getResearch("acme|", t + 7 * DAY + 1)).toBeNull();
    expect(getResearch("missing|")).toBeNull();
  });
  it("putResearch replaces by key", () => {
    putResearch({ company_key: "k|", facts: [], rivals: [], provider: "none", fetched_at: new Date().toISOString() });
    putResearch({ company_key: "k|", facts: [], rivals: ["X"], provider: "serper", fetched_at: new Date().toISOString() });
    expect(getResearch("k|")).toMatchObject({ rivals: ["X"], provider: "serper" });
  });
});

it("serves the letters bucket", () => expect(isBucket("letters")).toBe(true));
