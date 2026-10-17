import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildEvidence, pickStoryEntry } from "@/lib/cover-letter/evidence";
import type { ParsedCV } from "@/lib/types";

const entry = (id: string, org: string, title: string, bullets: string[]) => ({
  id, org, title, dates: "", location: "London", bullets: bullets.map((text, n) => ({ id: `${id}-b${n}`, text })),
});
const cv = {
  name: "A", email: null, phone: null, location: null, links: [], summary: null, education: [],
  experience: [
    entry("x0", "Cafe Lune", "Barista", ["Served 200 customers a day", "Trained new staff on the till"]),
    entry("x1", "Hudson Fund", "Trading Analyst", ["Built a markets dashboard tracking equity and FX positions", "Backtested trading signals on futures data"]),
  ],
  projects: [entry("p0", "UCL", "Society project", ["Organised events for 300 members"])],
  leadership: [], skills: [], interests: null, sectionOrder: [], yearGuess: null, archetypes: [],
} as unknown as ParsedCV;

describe("pickStoryEntry", () => {
  it("chooses the trading fund entry for a markets JD", () => {
    expect(pickStoryEntry(cv, ["Join our markets desk", "Analyse equity, FX and futures trading data"])).toEqual({ id: "x1", label: "Trading Analyst at Hudson Fund" });
  });
  it("ties go to the entry earlier in the CV (more recent)", () => {
    const tie = { ...cv, experience: [entry("a", "A Co", "Dev", ["Wrote code"]), entry("b", "B Co", "Dev", ["Wrote code"])], projects: [] } as unknown as ParsedCV;
    expect(pickStoryEntry(tie, ["code"])?.id).toBe("a");
  });
  it("falls back to the most recent entry with no overlap, null with no entries", () => {
    expect(pickStoryEntry(cv, ["zzz"])?.id).toBe("x0");
    expect(pickStoryEntry({ ...cv, experience: [], projects: [], leadership: [] } as unknown as ParsedCV, ["code"])).toBeNull();
  });
});

describe("buildEvidence", () => {
  beforeEach(() => { vi.stubEnv("AI_MODE", "fixture"); });
  afterEach(() => { vi.unstubAllEnvs(); });

  it("drops unknown cvRefs from the model output", async () => {
    const ev = await buildEvidence({ cv, jdLines: ["Analyse equity, FX and futures trading data", "Strong analytical skills"], company: "Acme", rivals: ["Rival"], archetype: "quant_trading" });
    expect(ev.requirements.length).toBeGreaterThanOrEqual(2);
    expect(ev.requirements.length).toBeLessThanOrEqual(3);
    const known = new Set(["x0-b0", "x0-b1", "x1-b0", "x1-b1", "p0-b0"]);
    for (const r of ev.requirements) for (const id of r.cvRefs) expect(known.has(id)).toBe(true);
    expect(ev.requirements.flatMap((r) => r.cvRefs)).toContain("x1-b0");
    expect(ev.requirements.flatMap((r) => r.cvRefs)).not.toContain("nope-b9");
    expect(ev.storyEntry?.id).toBe("x1");
    expect(ev.rivals).toEqual(["Rival"]);
    expect(ev.sector).toBe("quant_trading");
  });

  it("falls back to a deterministic pack when there is no fixture", async () => {
    vi.spyOn(process, "cwd").mockReturnValue("/nonexistent");
    const ev = await buildEvidence({ cv, jdLines: ["Analyse equity, FX and futures trading data", "Backtest trading signals", "Great team"], company: "Acme", rivals: [], archetype: null });
    expect(ev.requirements.length).toBeGreaterThanOrEqual(2);
    expect(ev.requirements[0].cvRefs.length).toBeGreaterThan(0);
    expect(ev.requirements[0].cvRefs.every((id) => id.startsWith("x1-"))).toBe(true);
    vi.restoreAllMocks();
  });
});
