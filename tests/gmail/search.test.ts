import { describe, expect, it } from "vitest";
import { buildGmailQuery, extractText, SENDER_DOMAINS, toRawEmail } from "@/lib/gmail/search";

const b64 = (s: string) => Buffer.from(s).toString("base64url");

describe("buildGmailQuery", () => {
  it("covers ATS and assessment senders within 60 days", () => {
    const q = buildGmailQuery([]);
    expect(q.startsWith("newer_than:60d ")).toBe(true);
    for (const d of ["greenhouse.io", "myworkday.com", "hirevue.com", "shl.com"]) expect(q).toContain(d);
    expect(SENDER_DOMAINS.length).toBeGreaterThan(10);
  });
  it("adds quoted, de-duplicated company names, max 30, stripping quotes", () => {
    const q = buildGmailQuery(["Lendable", "lendable", 'IMC "Trading"', ...Array.from({ length: 40 }, (_, i) => `Co${i}`)]);
    expect(q).toContain('"Lendable"');
    expect(q.match(/"Lendable"/gi)).toHaveLength(1);
    expect(q).toContain('"IMC Trading"');
    expect((q.match(/"Co\d+"/g) ?? []).length).toBeLessThanOrEqual(28);
  });
});

describe("extractText", () => {
  it("prefers text/plain in a multipart message", () => {
    expect(extractText({ mimeType: "multipart/alternative", parts: [
      { mimeType: "text/html", body: { data: b64("<p>HTML</p>") } },
      { mimeType: "text/plain", body: { data: b64("Plain body") } },
    ] })).toBe("Plain body");
  });
  it("falls back to HTML with tags, styles and entities stripped, keeping hrefs", () => {
    const html = '<style>p{}</style><p>Hi&nbsp;there &amp; <a href="https://x.example.com/t">start test</a></p>';
    const t = extractText({ mimeType: "text/html", body: { data: b64(html) } });
    expect(t).toContain("Hi there & start test");
    expect(t).toContain("https://x.example.com/t");
    expect(t).not.toContain("<");
  });
  it("finds text in nested parts and returns empty for none", () => {
    expect(extractText({ mimeType: "multipart/mixed", parts: [{ mimeType: "multipart/alternative", parts: [{ mimeType: "text/plain", body: { data: b64("deep") } }] }] })).toBe("deep");
    expect(extractText({ mimeType: "image/png" })).toBe("");
  });
});

describe("toRawEmail", () => {
  it("reads headers and internalDate", () => {
    const e = toRawEmail({ id: "abc", internalDate: String(Date.UTC(2026, 9, 12, 9)), payload: {
      mimeType: "text/plain", body: { data: b64("x".repeat(5000)) },
      headers: [{ name: "From", value: "A <a@b.com>" }, { name: "Subject", value: "Hello" }],
    } });
    expect(e).toMatchObject({ id: "abc", from: "A <a@b.com>", subject: "Hello", date: "2026-10-12T09:00:00.000Z" });
    expect(e.text.length).toBe(2000);
  });
});
