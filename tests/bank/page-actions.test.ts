import { describe, expect, it, vi } from "vitest";
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
import { LOCAL_USER_ID } from "@/lib/auth/local-user";
import { withTempDb } from "../cv/temp-db";
import { getBank, insertEntry, insertSuggestion, listSources, listSuggestions, upsertSource } from "@/lib/bank/store";
import {
  acceptAction, addManualBullet, addManualEntry, deleteBulletAction, deleteEntryAction, editBullet, editEntry, moveBullet, toggleBullet, toggleEntry,
} from "@/app/(app)/profile/bank/actions";

withTempDb();

const seed = (org: string, texts: string[]) => insertEntry(LOCAL_USER_ID, {
  section: "experience", org, title: "Analyst", dates: "2025", startYm: "2025-01", endYm: "2025-12", location: "London",
  pinned: false, hidden: false, sourceIds: [],
  bullets: texts.map((text, position) => ({ text, position, pinned: false, hidden: false, sourceIds: ["s1"], sourceText: text })),
});
const find = (id: string) => getBank(LOCAL_USER_ID).entries.flatMap((e) => e.bullets).find((b) => b.id === id)!;

describe("bank page actions", () => {
  it("editBullet rejects over-long and empty text, accepts valid text with manual provenance", async () => {
    const e = seed("Edit", ["one"]);
    expect(await editBullet(e.bullets[0].id, "x".repeat(301))).toMatchObject({ error: expect.any(String) });
    expect(await editBullet(e.bullets[0].id, "   ")).toMatchObject({ error: expect.any(String) });
    expect(find(e.bullets[0].id).text).toBe("one");
    expect(await editBullet(e.bullets[0].id, "  two  ")).toEqual({ ok: true });
    expect(find(e.bullets[0].id)).toMatchObject({ text: "two", sourceIds: ["s1", "manual"] });
  });

  it("toggleBullet flips the flag each call", async () => {
    const e = seed("Tog", ["a"]);
    const id = e.bullets[0].id;
    await toggleBullet(id, "pinned");
    expect(find(id).pinned).toBe(true);
    await toggleBullet(id, "pinned");
    expect(find(id).pinned).toBe(false);
    await toggleBullet(id, "hidden");
    expect(find(id).hidden).toBe(true);
    expect(await toggleBullet(id, "text" as never)).toMatchObject({ error: expect.any(String) });
  });

  it("toggleEntry flips entry flags", async () => {
    const e = seed("TogE", ["a"]);
    await toggleEntry(e.id, "hidden");
    expect(getBank(LOCAL_USER_ID).entries.find((x) => x.id === e.id)!.hidden).toBe(true);
  });

  it("moveBullet swaps positions with the neighbour and stops at the ends", async () => {
    const e = seed("Move", ["a", "b", "c"]);
    const [a, b, c] = e.bullets.map((x) => x.id);
    await moveBullet(b, -1);
    const order = () => getBank(LOCAL_USER_ID).entries.find((x) => x.id === e.id)!.bullets.map((x) => x.id);
    expect(order()).toEqual([b, a, c]);
    await moveBullet(b, -1);
    expect(order()).toEqual([b, a, c]);
    await moveBullet(b, 1);
    await moveBullet(b, 1);
    expect(order()).toEqual([a, c, b]);
    await moveBullet(b, 1);
    expect(order()).toEqual([a, c, b]);
  });

  it("addManualEntry validates, parses dates and marks the entry manual", async () => {
    expect(await addManualEntry({ section: "experience", org: "x".repeat(121), title: "T", dates: "", location: "" })).toMatchObject({ error: expect.any(String) });
    expect(await addManualEntry({ section: "experience", org: "", title: "T", dates: "", location: "" })).toMatchObject({ error: expect.any(String) });
    const r = await addManualEntry({ section: "projects", org: "Side", title: "Builder", dates: "Jun 2024 - Aug 2024", location: "" });
    expect(r).toMatchObject({ ok: true });
    const e = getBank(LOCAL_USER_ID).entries.find((x) => x.org === "Side")!;
    expect(e).toMatchObject({ section: "projects", startYm: "2024-06", endYm: "2024-08", sourceIds: ["manual"] });
  });

  it("addManualBullet appends at the end, validates and refuses a foreign entry", async () => {
    const e = seed("AddB", ["a", "b"]);
    expect(await addManualBullet(e.id, "y".repeat(301))).toMatchObject({ error: expect.any(String) });
    expect(await addManualBullet(e.id, "c")).toEqual({ ok: true });
    const bs = getBank(LOCAL_USER_ID).entries.find((x) => x.id === e.id)!.bullets;
    expect(bs.map((b) => b.text)).toEqual(["a", "b", "c"]);
    expect(bs[2]).toMatchObject({ position: 2, sourceIds: ["manual"] });
    expect(await addManualBullet("no-such-entry", "c")).toMatchObject({ error: expect.any(String) });
  });

  it("deleteBulletAction removes the bullet", async () => {
    const e = seed("Del", ["a"]);
    await deleteBulletAction(e.bullets[0].id);
    expect(getBank(LOCAL_USER_ID).entries.find((x) => x.id === e.id)!.bullets).toEqual([]);
  });

  it("listSources maps source ids to kinds for this user", async () => {
    expect(listSources(LOCAL_USER_ID)).toBeInstanceOf(Map);
  });

  it("editEntry validates limits, recomputes the month range and marks the entry manual", async () => {
    const e = seed("EditE", ["a"]);
    const entry = () => getBank(LOCAL_USER_ID).entries.find((x) => x.id === e.id)!;
    const base = { org: "Acme", title: "Analyst", dates: "2025", location: "London" };
    expect(await editEntry(e.id, { ...base, org: "x".repeat(121) })).toMatchObject({ error: expect.any(String) });
    expect(await editEntry(e.id, { ...base, title: "x".repeat(121) })).toMatchObject({ error: expect.any(String) });
    expect(await editEntry(e.id, { ...base, title: "   " })).toMatchObject({ error: expect.any(String) });
    expect(await editEntry(e.id, { ...base, dates: "x".repeat(81) })).toMatchObject({ error: expect.any(String) });
    expect(await editEntry(e.id, { ...base, location: "x".repeat(81) })).toMatchObject({ error: expect.any(String) });
    expect(entry()).toMatchObject({ org: "EditE", sourceIds: [] });
    expect(await editEntry(e.id, { org: " Acme Bank ", title: "Summer Analyst", dates: "Jun 2024 - Aug 2024", location: "Leeds" })).toEqual({ ok: true });
    expect(entry()).toMatchObject({
      org: "Acme Bank", title: "Summer Analyst", dates: "Jun 2024 - Aug 2024", location: "Leeds", startYm: "2024-06", endYm: "2024-08", sourceIds: ["manual"],
    });
    expect(await editEntry(e.id, { org: "", title: "Summer Analyst", dates: "", location: "" })).toEqual({ ok: true });
    expect(entry()).toMatchObject({ org: "", dates: "", startYm: null, endYm: null, sourceIds: ["manual"] });
    expect(await editEntry("no-such-entry", base)).toMatchObject({ error: expect.any(String) });
  });

  it("deleteEntryAction removes the entry with its bullets", async () => {
    const e = seed("DelE", ["a", "b"]);
    expect(await deleteEntryAction(e.id)).toEqual({ ok: true });
    expect(getBank(LOCAL_USER_ID).entries.some((x) => x.id === e.id)).toBe(false);
    expect(getBank(LOCAL_USER_ID).entries.flatMap((x) => x.bullets).some((b) => b.entryId === e.id)).toBe(false);
  });

  it("acceptAction passes ticked bullet indexes and validates them", async () => {
    const s = upsertSource(LOCAL_USER_ID, "linkedin_post", "post-ticks", "x").id;
    const candidate = {
      section: "projects" as const, org: "", title: "Ticks Project", dates: "", startYm: null, endYm: null, location: "",
      bullets: [{ text: "First line", sourceText: "a" }, { text: "Second line", sourceText: "b" }],
    };
    const sg = insertSuggestion(LOCAL_USER_ID, { sourceId: s, kind: "new_entry", targetEntryId: null, payload: { candidate } });
    expect(await acceptAction(sg.id, { bulletIndexes: [-1] as number[] })).toMatchObject({ error: expect.any(String) });
    expect(await acceptAction(sg.id, { bulletIndexes: [] })).toMatchObject({ error: expect.stringMatching(/at least one/) });
    expect(listSuggestions(LOCAL_USER_ID, "pending").some((x) => x.id === sg.id)).toBe(true);
    expect(await acceptAction(sg.id, { bulletIndexes: [1] })).toEqual({ ok: true });
    expect(getBank(LOCAL_USER_ID).entries.find((x) => x.title === "Ticks Project")!.bullets.map((b) => b.text)).toEqual(["Second line"]);
  });
});
