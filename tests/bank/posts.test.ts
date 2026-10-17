import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_USER_ID as U } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { bankBullets, bankEntries, bankSources, bankSuggestions } from "@/lib/db/schema";
import { insertEntry, listSuggestions } from "@/lib/bank/store";
import { importPosts } from "@/lib/bank/import";
import { AI_NOT_SET_UP, AiError } from "@/lib/ai/provider";
import type { NewBulletPayload, NewEntryPayload } from "@/lib/bank/types";
import { withTempDb } from "../cv/temp-db";

const cfg = vi.hoisted(() => ({ mode: "fixture" as "fixture" | "off" | "live" }));
vi.mock("@/lib/ai/config", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/config")>()), aiMode: () => cfg.mode }));
const override = vi.hoisted(() => ({ items: null as unknown }));
vi.mock("@/lib/ai/extractPostBullets", async (orig) => {
  const real = await orig<typeof import("@/lib/ai/extractPostBullets")>();
  return { ...real, extractPostBullets: (...a: Parameters<typeof real.extractPostBullets>) => override.items ? Promise.resolve({ items: override.items }) : real.extractPostBullets(...a) };
});

withTempDb();

const POST = "Proud to share that our team won 1st place out of 40 teams at the UCL FinTech hackathon. I built the pricing API in Python. Thanks to everyone!";
const item = (over: Record<string, unknown> = {}) => ({
  text: "Won 1st place of 40 teams at the UCL FinTech hackathon", entryHint: null, newProjectTitle: "UCL FinTech Hackathon",
  excerpt: "our team won 1st place out of 40 teams at the UCL FinTech hackathon.", ...over,
});

describe("importPosts", () => {
  beforeEach(() => {
    cfg.mode = "fixture"; override.items = null;
    for (const t of [bankSuggestions, bankBullets, bankEntries, bankSources]) db.delete(t).run();
  });
  afterEach(() => { cfg.mode = "fixture"; override.items = null; });

  it("turns a post into a grounded new_entry in projects, keeping 40", async () => {
    const r = await importPosts(U, [POST]);
    expect(r).toEqual({ suggestions: 1, dropped: 0 });
    const [s] = listSuggestions(U, "pending");
    expect(s.kind).toBe("new_entry");
    const c = (s.payload as NewEntryPayload).candidate;
    expect(c.section).toBe("projects");
    expect(c.org).toBe("");
    expect(c.title).toBe("UCL FinTech Hackathon");
    expect(c.bullets[0].text).toContain("40");
  });

  it("drops an item whose number is not in the post", async () => {
    override.items = [item({ text: "Won 1st of 40 teams, lifting accuracy by 60%" })];
    expect(await importPosts(U, [POST])).toEqual({ suggestions: 0, dropped: 1 });
  });

  it("drops an item whose excerpt is not in the post", async () => {
    override.items = [item({ excerpt: "we crushed the competition at the hackathon" })];
    expect(await importPosts(U, [POST])).toEqual({ suggestions: 0, dropped: 1 });
  });

  it("accepts an excerpt that differs only in whitespace", async () => {
    override.items = [item({ excerpt: "our team won 1st place out of 40   teams\nat the UCL FinTech hackathon." })];
    expect((await importPosts(U, [POST])).suggestions).toBe(1);
  });

  it("a matching entryHint makes a new_bullet on that entry, with the excerpt as sourceText", async () => {
    const e = insertEntry(U, { section: "projects", org: "UCL FinTech Society", title: "Hackathon Lead", dates: "", startYm: null, endYm: null, location: "", pinned: false, hidden: false, sourceIds: [], bullets: [] });
    override.items = [item({ entryHint: { org: "UCL FinTech Society", title: "Hackathon Lead" } })];
    expect((await importPosts(U, [POST])).suggestions).toBe(1);
    const [s] = listSuggestions(U, "pending");
    expect(s.kind).toBe("new_bullet");
    expect(s.targetEntryId).toBe(e.id);
    expect((s.payload as NewBulletPayload).sourceText).toBe("our team won 1st place out of 40 teams at the UCL FinTech hackathon.");
  });

  it("falls back to a Project title and re-pasting creates nothing new", async () => {
    override.items = [item({ newProjectTitle: null })];
    await importPosts(U, [POST]);
    expect(((listSuggestions(U, "pending")[0].payload) as NewEntryPayload).candidate.title).toBe("Project");
    expect(await importPosts(U, [POST])).toEqual({ suggestions: 0, dropped: 0 });
    expect(listSuggestions(U)).toHaveLength(1);
    expect(db.select().from(bankSources).all()).toHaveLength(1);
  });

  it("rejects with AI_NOT_SET_UP when AI is off", async () => {
    cfg.mode = "off";
    await expect(importPosts(U, [POST])).rejects.toThrow(AI_NOT_SET_UP);
    await expect(importPosts(U, [POST])).rejects.toBeInstanceOf(AiError);
    expect(db.select().from(bankSources).all()).toHaveLength(0);
  });
});
