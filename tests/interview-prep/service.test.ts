import { describe, it, expect, vi } from "vitest";
import { DAILY_CAP, getOrCreatePrep, type PrepDeps } from "@/lib/interview-prep/service";
import type { PrepResultT } from "@/lib/ai/interviewPrep";

const result: PrepResultT = { pack: { process: [], questions: [], tips: [] }, sources: [], grounded: true };
const NOW = new Date("2026-10-16T12:00:00Z");
const deps = (over: Partial<PrepDeps> = {}): PrepDeps => ({
  key: `k-${Math.random()}`,
  readCache: vi.fn().mockResolvedValue(null), countRecent: vi.fn().mockResolvedValue(0), writeCache: vi.fn().mockResolvedValue(undefined),
  generate: vi.fn().mockResolvedValue(result), stories: vi.fn().mockResolvedValue([]), now: () => NOW, ...over,
});

describe("getOrCreatePrep", () => {
  it("serves a fresh cache hit without generating or checking the cap", async () => {
    const d = deps({ readCache: vi.fn().mockResolvedValue({ ...result, createdAt: "2026-10-10T00:00:00Z" }) });
    const r = await getOrCreatePrep(d);
    expect(r).toMatchObject({ cached: true, createdAt: "2026-10-10T00:00:00Z" });
    expect(d.generate).not.toHaveBeenCalled();
    expect(d.countRecent).not.toHaveBeenCalled();
    expect(d.stories).toHaveBeenCalled();
  });

  it("regenerates and overwrites a cache row older than 14 days", async () => {
    const d = deps({ readCache: vi.fn().mockResolvedValue({ ...result, createdAt: "2026-09-30T00:00:00Z" }) });
    const r = await getOrCreatePrep(d);
    expect(r).toMatchObject({ cached: false, createdAt: NOW.toISOString() });
    expect(d.generate).toHaveBeenCalledOnce();
    expect(d.writeCache).toHaveBeenCalledWith(result, NOW.toISOString());
  });

  it("counts generations over the last 24 hours and refuses at the cap", async () => {
    const d = deps({ countRecent: vi.fn().mockResolvedValue(DAILY_CAP) });
    expect(await getOrCreatePrep(d)).toEqual({ error: expect.stringContaining("10") });
    expect(d.countRecent).toHaveBeenCalledWith("2026-10-15T12:00:00.000Z");
    expect(d.generate).not.toHaveBeenCalled();
  });

  it("still returns the pack if saving the cache fails", async () => {
    const d = deps({ writeCache: vi.fn().mockRejectedValue(new Error("rls")) });
    expect(await getOrCreatePrep(d)).toMatchObject({ cached: false, grounded: true });
  });

  it("maps an AI failure to its user message", async () => {
    const { AiError, AI_UNAVAILABLE } = await import("@/lib/ai/provider");
    const d = deps({ generate: vi.fn().mockRejectedValue(new AiError(AI_UNAVAILABLE)) });
    expect(await getOrCreatePrep(d)).toEqual({ error: AI_UNAVAILABLE });
  });
});

describe("getOrCreatePrep — review fixes", () => {
  it("fails closed when the generation count cannot be read", async () => {
    const d = deps({ countRecent: vi.fn().mockRejectedValue(new Error("relation does not exist")) });
    expect(await getOrCreatePrep(d)).toEqual({ error: expect.any(String) });
    expect(d.generate).not.toHaveBeenCalled();
  });

  it("shares one generation between concurrent requests for the same key", async () => {
    let release!: (r: PrepResultT) => void;
    const generate = vi.fn(() => new Promise<PrepResultT>((res) => { release = res; }));
    const a = getOrCreatePrep(deps({ key: "7:ib:internship", generate }));
    const b = getOrCreatePrep(deps({ key: "7:ib:internship", generate }));
    await new Promise((r) => setTimeout(r, 0));
    release(result);
    expect(await a).toMatchObject({ grounded: true });
    expect(await b).toMatchObject({ grounded: true });
    expect(generate).toHaveBeenCalledOnce();
  });

  it("treats an ungrounded cache row as stale after 2 days", async () => {
    const d = deps({ readCache: vi.fn().mockResolvedValue({ ...result, grounded: false, createdAt: "2026-10-13T12:00:00Z" }) });
    expect(await getOrCreatePrep(d)).toMatchObject({ cached: false });
    expect(d.generate).toHaveBeenCalledOnce();
  });

  it("never reads or writes the shared cache when caching is off (fixture mode)", async () => {
    const d = deps({ cache: false });
    expect(await getOrCreatePrep(d)).toMatchObject({ cached: false });
    expect(d.readCache).not.toHaveBeenCalled();
    expect(d.writeCache).not.toHaveBeenCalled();
    expect(d.countRecent).not.toHaveBeenCalled();
  });
});
