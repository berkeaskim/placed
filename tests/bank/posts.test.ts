import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LOCAL_USER_ID as U } from "@/lib/auth/local-user";
import { db } from "@/lib/db/client";
import { bankBullets, bankEntries, bankSources, bankSuggestions } from "@/lib/db/schema";
import { getBank, insertEntry, listSuggestions } from "@/lib/bank/store";
import { acceptSuggestion } from "@/lib/bank/suggestions";
import { importPosts } from "@/lib/bank/import";
import { AI_NOT_SET_UP, AiError } from "@/lib/ai/provider";
import { PostBulletsOutput } from "@/lib/ai/schemas";
import type { NewBulletPayload, NewEntryPayload } from "@/lib/bank/types";
import { withTempDb } from "../cv/temp-db";

const cfg = vi.hoisted(() => ({ mode: "fixture" as "fixture" | "off" | "live" }));
vi.mock("@/lib/ai/config", async (orig) => ({ ...(await orig<typeof import("@/lib/ai/config")>()), aiMode: () => cfg.mode }));
const override = vi.hoisted(() => ({ items: null as unknown, delayMs: 0 }));
vi.mock("@/lib/ai/extractPostBullets", async (orig) => {
  const real = await orig<typeof import("@/lib/ai/extractPostBullets")>();
  return {
    ...real,
    extractPostBullets: (...a: Parameters<typeof real.extractPostBullets>) => {
      if (!override.items) return real.extractPostBullets(...a);
      const out = { items: override.items };
      return override.delayMs ? new Promise((r) => setTimeout(() => r(out), override.delayMs)) : Promise.resolve(out);
    },
  };
});

withTempDb();

const POST = "Proud to share that our team won 1st place out of 40 teams at the UCL FinTech hackathon. I built the pricing API in Python. Thanks to everyone!";
const item = (over: Record<string, unknown> = {}) => ({
  text: "Won 1st place of 40 teams at the UCL FinTech hackathon", entryHint: null, newProjectTitle: "UCL FinTech Hackathon",
  excerpt: "our team won 1st place out of 40 teams at the UCL FinTech hackathon.", ...over,
});

describe("importPosts", () => {
  beforeEach(() => {
    cfg.mode = "fixture"; override.items = null; override.delayMs = 0;
    for (const t of [bankSuggestions, bankBullets, bankEntries, bankSources]) db.delete(t).run();
  });
  afterEach(() => { cfg.mode = "fixture"; override.items = null; override.delayMs = 0; });

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

  it("falls back to a neutral title and re-pasting creates nothing new", async () => {
    override.items = [item({ newProjectTitle: null })];
    await importPosts(U, [POST]);
    expect(((listSuggestions(U, "pending")[0].payload) as NewEntryPayload).candidate.title).toBe("Project from LinkedIn post");
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

  it("drops an excerpt shorter than 15 characters", async () => {
    override.items = [item({ excerpt: "1st place" })];
    expect(await importPosts(U, [POST])).toEqual({ suggestions: 0, dropped: 1 });
  });

  it("groups bullets with the same project title into one new_entry", async () => {
    override.items = [item(), item({ text: "Built the pricing API in Python", excerpt: "I built the pricing API in Python." })];
    expect((await importPosts(U, [POST])).suggestions).toBe(1);
    const [s] = listSuggestions(U, "pending");
    expect((s.payload as NewEntryPayload).candidate.bullets).toHaveLength(2);
  });

  it("after accepting the new_entry, re-importing the same post suggests nothing", async () => {
    expect((await importPosts(U, [POST])).suggestions).toBe(1);
    acceptSuggestion(U, listSuggestions(U, "pending")[0].id);
    expect(getBank(U).entries).toHaveLength(1);
    expect(await importPosts(U, [POST])).toEqual({ suggestions: 0, dropped: 0 });
    expect(listSuggestions(U, "pending")).toHaveLength(0);
  });

  // I1: the tailoring gate's word-metric and known-employer checks run on each candidate against the post
  it("drops a candidate whose multiplier word the post doesn't back", async () => {
    const post = "Our society launch went well and sign-ups grew after launch. Thanks to the whole committee for the help!";
    override.items = [item({ text: "Tripled sign-ups for the society launch", excerpt: "sign-ups grew after launch", newProjectTitle: null })];
    expect(await importPosts(U, [post])).toEqual({ suggestions: 0, dropped: 1 });
  });

  it("drops a candidate that names an employer the post doesn't", async () => {
    override.items = [item({ text: "Led a Goldman Sachs pitch at the UCL FinTech hackathon" })];
    expect(await importPosts(U, [POST])).toEqual({ suggestions: 0, dropped: 1 });
  });

  it("keeps a grounded candidate that passes every check", async () => {
    override.items = [item({ text: "Built the pricing API in Python", excerpt: "I built the pricing API in Python." })];
    expect(await importPosts(U, [POST])).toEqual({ suggestions: 1, dropped: 0 });
  });

  // I2a: the AI's project title is kept only when the post backs every word
  it("keeps a project title whose words all appear in the post", async () => {
    override.items = [item({ newProjectTitle: "UCL FinTech Hackathon" })];
    await importPosts(U, [POST]);
    expect((listSuggestions(U, "pending")[0].payload as NewEntryPayload).candidate.title).toBe("UCL FinTech Hackathon");
  });

  it("replaces a project title with words the post doesn't contain", async () => {
    override.items = [item({ newProjectTitle: "Award-winning Trading Platform" })];
    await importPosts(U, [POST]);
    expect((listSuggestions(U, "pending")[0].payload as NewEntryPayload).candidate.title).toBe("Project from LinkedIn post");
  });

  it("replaces a project title that names an employer the post doesn't", async () => {
    override.items = [item({ newProjectTitle: "Goldman Sachs FinTech Hackathon" })];
    await importPosts(U, [POST]);
    expect((listSuggestions(U, "pending")[0].payload as NewEntryPayload).candidate.title).toBe("Project from LinkedIn post");
  });

  // M2: blank bullet text is never suggested
  it("PostBulletsOutput trims text and refuses blank text", () => {
    const one = (text: string) => PostBulletsOutput.safeParse({ items: [{ text, entryHint: null, newProjectTitle: null, excerpt: "" }] });
    expect(one("   ").success).toBe(false);
    const ok = one("  Built the API  ");
    expect(ok.success && ok.data.items[0].text).toBe("Built the API");
  });

  it("skips a candidate whose text is blank after trimming", async () => {
    override.items = [item({ text: "   " })];
    expect(await importPosts(U, [POST])).toEqual({ suggestions: 0, dropped: 1 });
    expect(listSuggestions(U)).toHaveLength(0);
  });

  // M4: a quick double submit must not insert twice
  it("two concurrent imports of the same post insert one suggestion", async () => {
    override.items = [item()];
    override.delayMs = 5;
    const [a, b] = await Promise.all([importPosts(U, [POST]), importPosts(U, [POST])]);
    expect(a.suggestions + b.suggestions).toBe(1);
    expect(listSuggestions(U)).toHaveLength(1);
  });

  it("two concurrent imports with a matching entryHint insert one new_bullet", async () => {
    insertEntry(U, { section: "projects", org: "UCL FinTech Society", title: "Hackathon Lead", dates: "", startYm: null, endYm: null, location: "", pinned: false, hidden: false, sourceIds: [], bullets: [] });
    override.items = [item({ entryHint: { org: "UCL FinTech Society", title: "Hackathon Lead" } })];
    override.delayMs = 5;
    await Promise.all([importPosts(U, [POST]), importPosts(U, [POST])]);
    expect(listSuggestions(U)).toHaveLength(1);
  });

  // M5: a post new_entry can be accepted with some bullets unticked
  it("acceptSuggestion with bulletIndexes inserts only those bullets", async () => {
    override.items = [item(), item({ text: "Built the pricing API in Python", excerpt: "I built the pricing API in Python." })];
    await importPosts(U, [POST]);
    const [s] = listSuggestions(U, "pending");
    acceptSuggestion(U, s.id, { bulletIndexes: [1] });
    const [e] = getBank(U).entries;
    expect(e.bullets.map((b) => b.text)).toEqual(["Built the pricing API in Python"]);
    expect(listSuggestions(U, "accepted")).toHaveLength(1);
  });

  it("acceptSuggestion with no bullets ticked refuses and leaves it pending", async () => {
    override.items = [item(), item({ text: "Built the pricing API in Python", excerpt: "I built the pricing API in Python." })];
    await importPosts(U, [POST]);
    const [s] = listSuggestions(U, "pending");
    expect(() => acceptSuggestion(U, s.id, { bulletIndexes: [] })).toThrow(/at least one/);
    expect(() => acceptSuggestion(U, s.id, { bulletIndexes: [5] })).toThrow(/at least one/);
    expect(getBank(U).entries).toHaveLength(0);
    expect(listSuggestions(U, "pending")).toHaveLength(1);
  });
});
