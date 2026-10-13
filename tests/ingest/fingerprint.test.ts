import { describe, it, expect } from "vitest";
import { normalizeUrl, jobFingerprint, contentHash } from "@/lib/ingest/fingerprint";

describe("fingerprint", () => {
  it("normalizes URLs by dropping tracking params, fragments and trailing slashes", () => {
    expect(normalizeUrl("https://Jobs.Lever.co/acme/123/?utm_source=x&gh_src=y#apply")).toBe("https://jobs.lever.co/acme/123");
  });
  it("treats reposts with year/punctuation differences as the same fingerprint", () => {
    expect(jobFingerprint("acme", "Software Engineer Intern - Summer 2027", "London, UK"))
      .toBe(jobFingerprint("acme", "software engineer intern (summer 2027)", "london uk"));
  });
  it("content hash changes when content changes", () => {
    expect(contentHash("a")).not.toBe(contentHash("b"));
    expect(contentHash("a")).toBe(contentHash("a"));
  });
});
