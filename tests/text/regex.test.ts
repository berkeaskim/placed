import { describe, it, expect } from "vitest";
import { escapeRegex } from "@/lib/text/regex";

describe("escapeRegex", () => {
  it("escapes special regex characters", () => {
    expect(escapeRegex("a.b")).toBe("a\\.b");
    expect(escapeRegex("a*b")).toBe("a\\*b");
    expect(escapeRegex("a+b")).toBe("a\\+b");
    expect(escapeRegex("a?b")).toBe("a\\?b");
    expect(escapeRegex("a^b")).toBe("a\\^b");
    expect(escapeRegex("a$b")).toBe("a\\$b");
    expect(escapeRegex("a{b}c")).toBe("a\\{b\\}c");
    expect(escapeRegex("a(b)c")).toBe("a\\(b\\)c");
    expect(escapeRegex("a|b")).toBe("a\\|b");
    expect(escapeRegex("a[b]c")).toBe("a\\[b\\]c");
    expect(escapeRegex("a\\b")).toBe("a\\\\b");
  });

  it("handles plain strings without special characters", () => {
    expect(escapeRegex("hello")).toBe("hello");
    expect(escapeRegex("world123")).toBe("world123");
  });

  it("preserves the original string content", () => {
    const input = "[a-z]+";
    const escaped = escapeRegex(input);
    expect(escaped).toBe("\\[a-z\\]\\+");
  });
});
