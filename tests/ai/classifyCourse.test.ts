import { describe, expect, it, vi, beforeEach } from "vitest";

const s = vi.hoisted(() => ({ gen: vi.fn(), mode: "live" as "live" | "fixture" }));
vi.mock("@/lib/ai/provider", () => ({
  generateStructured: s.gen,
  runAi: async (o: { live: () => Promise<unknown>; fallback: () => unknown }) => (s.mode === "live" ? o.live() : o.fallback()),
}));

import { classifyCourse } from "@/lib/ai/classifyCourse";

beforeEach(() => { s.gen.mockReset(); s.mode = "live"; });

describe("classifyCourse", () => {
  it("never calls the AI for a recognisable course", async () => {
    expect(await classifyCourse("BSc Computer Science")).toBe("Computer Science");
    expect(s.gen).not.toHaveBeenCalled();
  });
  it("asks the fast tier for an unusual one, passing the name as quoted data", async () => {
    s.gen.mockResolvedValue({ field: "Natural Sciences" });
    expect(await classifyCourse("Liberal Arts and Sciences")).toBe("Natural Sciences");
    const req = s.gen.mock.calls[0][0];
    expect(req.tier).toBe("fast");
    expect(req.parts[0].text).toContain('Course: "Liberal Arts and Sciences"');
  });
  it("falls back to Other without an AI or when it fails", async () => {
    s.mode = "fixture";
    expect(await classifyCourse("Liberal Arts")).toBe("Other");
    s.mode = "live";
    s.gen.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await classifyCourse("Liberal Arts")).toBe("Other");
  });
});
