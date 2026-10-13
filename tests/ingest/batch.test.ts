import { describe, it, expect } from "vitest";
import { batchSlice, parseBatch } from "@/lib/ingest/batch";

const list = Array.from({ length: 25 }, (_, i) => i);

describe("batchSlice", () => {
  it("returns 10 per batch", () => {
    expect(batchSlice(list, 0)).toEqual(list.slice(0, 10));
    expect(batchSlice(list, 1)).toEqual(list.slice(10, 20));
    expect(batchSlice(list, 2)).toEqual(list.slice(20, 25));
  });
  it("returns empty past the end and honours size", () => {
    expect(batchSlice(list, 3)).toEqual([]);
    expect(batchSlice(list, 1, 5)).toEqual([5, 6, 7, 8, 9]);
  });
});

describe("parseBatch", () => {
  it("parses non-negative integers, null when absent, NaN-safe", () => {
    expect(parseBatch(null)).toBeNull();
    expect(parseBatch("0")).toBe(0);
    expect(parseBatch("3")).toBe(3);
    expect(parseBatch("-1")).toBe("invalid");
    expect(parseBatch("x")).toBe("invalid");
    expect(parseBatch("1.5")).toBe("invalid");
  });
});
