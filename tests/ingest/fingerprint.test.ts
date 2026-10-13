import { describe, it, expect } from "vitest";
import { normalizeUrl, jobFingerprint, contentHash } from "@/lib/ingest/fingerprint";

describe("fingerprint", () => {
  it("normalizes URLs by dropping tracking params, fragments and trailing slashes", () => {
    expect(normalizeUrl("https://Jobs.Lever.co/acme/123/?utm_source=x&gh_src=y#apply")).toBe("https://jobs.lever.co/acme/123");
  });
  it("keeps gh_jid while dropping utm_source", () => {
    expect(normalizeUrl("https://example.com/jobs?gh_jid=123&utm_source=x")).toBe("https://example.com/jobs?gh_jid=123");
  });
  it("preserves non-tracking params like referral_code", () => {
    expect(normalizeUrl("https://example.com/jobs?referral_code=abc&utm_medium=y")).toBe("https://example.com/jobs?referral_code=abc");
  });
  it("preserves non-tracking params like sourceId", () => {
    expect(normalizeUrl("https://example.com/jobs?sourceId=7")).toBe("https://example.com/jobs?sourceId=7");
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
