import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ParsedCV } from "@/lib/types";
import type { DraftInput } from "@/lib/autopilot/drafts";

const ai = vi.hoisted(() => ({ raw: null as unknown, fail: false as false | "boom" | "off" }));
vi.mock("@/lib/ai/provider", async (o) => {
  const real = await o<typeof import("@/lib/ai/provider")>();
  return {
    ...real,
    runAi: async () => { if (ai.fail === "off") throw new real.AiError(real.AI_NOT_SET_UP); if (ai.fail) throw new Error("boom"); return ai.raw; },
    generateStructured: vi.fn(),
  };
});
import { AI_NOT_SET_UP } from "@/lib/ai/provider";
import { draftAnswer } from "@/lib/autopilot/drafts";
import { gateIdeas, suggestIdeas } from "@/lib/autopilot/ideas";
import { ownFacts, reviseAnswer } from "@/lib/autopilot/revise";

const cv = {
  name: "Ayşe Demir", email: null, phone: null, location: null, links: [], summary: null, skills: [], interests: null, sectionOrder: [], yearGuess: null, archetypes: [],
  education: [{ id: "ed1", institution: "UCL", degree: "BSc Economics", dates: "2025 – 2028", grade: null, details: [] }],
  experience: [{ id: "x1", org: "UCL Economics Society", title: "Events Officer", dates: "2025 – present", location: "London",
    bullets: [{ id: "x1b1", text: "Organised weekly society events using Excel to analyse attendance" }, { id: "x1b2", text: "Helped run a 3-day fundraising campaign" }] }],
  projects: [], leadership: [],
} as unknown as ParsedCV;
const base: DraftInput = { question: "Tell us about yourself", wordLimit: 100, company: "Monzo", jobExtId: "8232726", fieldKey: "q", jdLines: ["Monzo has over 13 million customers"], cv, facts: [{ id: "f1", claim: "Organised weekly society events for 40 members" }] };

beforeEach(() => { ai.raw = null; ai.fail = false; });

describe("AI not set up", () => {
  it("ideas, revise and draft let the not-set-up error through so the chat can say so", async () => {
    ai.fail = "off";
    await expect(suggestIdeas(base)).rejects.toThrow(AI_NOT_SET_UP);
    await expect(reviseAnswer(base, "I led X.", "tidy")).rejects.toThrow(AI_NOT_SET_UP);
    await expect(draftAnswer(base)).rejects.toThrow(AI_NOT_SET_UP);
  });
});

describe("ideas", () => {
  it("gateIdeas drops ideas with unknown refs and caps at 3", () => {
    const ok = (n: number) => ({ text: `Angle ${n} on weekly events`, refs: ["x1b1"] });
    const r = gateIdeas([
      ok(1), { text: "Bad ref", refs: ["nope"] }, { text: "Bad jd", refs: ["jd:5"] }, { text: "No refs", refs: [] },
      { text: "Fact and job", refs: ["fact:f1", "jd:0"] }, ok(3), ok(4),
    ], base);
    expect(r.map((x) => x.text)).toEqual(["Angle 1 on weekly events", "Fact and job", "Angle 3 on weekly events"]);
  });
  it("suggestIdeas returns [] when the model throws", async () => {
    ai.fail = "boom";
    expect(await suggestIdeas(base)).toEqual([]);
  });
  it("suggestIdeas gates what the model returns", async () => {
    ai.raw = { ideas: [{ text: "Weekly events", refs: ["x1b1"] }, { text: "Made up", refs: ["zzz"] }] };
    expect(await suggestIdeas(base)).toEqual([{ text: "Weekly events", refs: ["x1b1"] }]);
  });
});

describe("revise", () => {
  it("ownFacts splits sentences with stable ids", () => {
    expect(ownFacts("I led X. I ran Y.")).toEqual([{ id: "own-0", claim: "I led X." }, { id: "own-1", claim: "I ran Y." }]);
  });
  it("keeps the user's own sentences", async () => {
    ai.raw = { sentences: [{ text: "I organised a 40-person hackathon.", about: "me", refs: ["fact:own-0"] }] };
    const r = await reviseAnswer(base, "I organised a 40-person hackathon.", "tidy");
    expect(r.text).toBe("I organised a 40-person hackathon.");
    expect(r.caught).toEqual([]);
  });
  it("catches an added unsupported claim", async () => {
    ai.raw = { sentences: [
      { text: "I organised a 40-person hackathon.", about: "me", refs: ["fact:own-0"] },
      { text: "I managed a £2m budget.", about: "me", refs: ["fact:own-0"] },
    ] };
    const r = await reviseAnswer(base, "I organised a 40-person hackathon.", "warmer");
    expect(r.text).not.toContain("£2m");
    expect(r.caught.map((c) => c.text)).toContain("I managed a £2m budget.");
  });
  it("returns an empty result when the model throws", async () => {
    ai.fail = "boom";
    expect(await reviseAnswer(base, "I led X.", "shorter")).toMatchObject({ text: "", source: "none" });
  });
});
