import { describe, expect, it } from "vitest";
import { cleanDraftInput } from "@/lib/outreach/input";

describe("cleanDraftInput", () => {
  it("accepts known targets/purposes and trims optional text", () => {
    expect(cleanDraftInput({ target: "alumni", purpose: "intro", recipientName: "  Sam ", note: " we met at a society event " }))
      .toEqual({ target: "alumni", purpose: "intro", recipientName: "Sam", note: "we met at a society event" });
  });
  it("rejects unknown targets and purposes", () => {
    expect(cleanDraftInput({ target: "ceo", purpose: "intro", recipientName: null, note: null })).toBeNull();
    expect(cleanDraftInput({ target: "alumni", purpose: "spam", recipientName: null, note: null })).toBeNull();
  });
  it("caps name at 60 and note at 200 characters, and blanks empties", () => {
    const r = cleanDraftInput({ target: "team", purpose: "intro", recipientName: "x".repeat(100), note: "y".repeat(500) })!;
    expect(r.recipientName!.length).toBe(60);
    expect(r.note!.length).toBe(200);
    expect(cleanDraftInput({ target: "team", purpose: "intro", recipientName: " ", note: "" })).toMatchObject({ recipientName: null, note: null });
  });
});
