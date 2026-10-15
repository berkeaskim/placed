import { describe, expect, it, vi } from "vitest";
import { withDeadline } from "@/lib/ai/parseCV";

describe("withDeadline", () => {
  it("returns the result when it settles in time", async () => {
    await expect(withDeadline(Promise.resolve("live"), 1000, () => "fallback", "t")).resolves.toBe("live");
  });

  it("falls back when the call hangs past the deadline", async () => {
    vi.useFakeTimers();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = withDeadline(new Promise<string>(() => {}), 60_000, () => "fallback", "t");
    await vi.advanceTimersByTimeAsync(60_000);
    await expect(r).resolves.toBe("fallback");
    vi.useRealTimers();
    err.mockRestore();
  });

  it("falls back when the call rejects", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(withDeadline(Promise.reject(new Error("503")), 1000, () => "fallback", "t")).resolves.toBe("fallback");
    err.mockRestore();
  });
});
