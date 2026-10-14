import { describe, it, expect } from "vitest";
import { UPLOAD_SCORING_GRACE_MS, uploadScoringInFlight } from "@/lib/cv-score/defer";

const now = Date.parse("2026-10-14T12:00:00Z");
const ago = (ms: number) => new Date(now - ms).toISOString();

describe("uploadScoringInFlight (avoid a second live judge call right after upload)", () => {
  it("true for the sector the upload is scoring, within 60 s of the upload", () => {
    expect(UPLOAD_SCORING_GRACE_MS).toBe(60_000);
    expect(uploadScoringInFlight({ uploadedAt: ago(5_000), now, sector: "consulting", target: "consulting" })).toBe(true);
    expect(uploadScoringInFlight({ uploadedAt: ago(59_999), now, sector: "consulting", target: "consulting" })).toBe(true);
  });
  it("false after 60 s, so a failed background score is retried on the page", () => {
    expect(uploadScoringInFlight({ uploadedAt: ago(60_000), now, sector: "consulting", target: "consulting" })).toBe(false);
  });
  it("false for a sector the upload did not score (no target, or a different one)", () => {
    expect(uploadScoringInFlight({ uploadedAt: ago(1_000), now, sector: "consulting", target: null })).toBe(false);
    expect(uploadScoringInFlight({ uploadedAt: ago(1_000), now, sector: "consulting", target: "banking" })).toBe(false);
  });
  it("false for a missing or unparseable timestamp, and for a clock-skewed future one beyond the window", () => {
    expect(uploadScoringInFlight({ uploadedAt: null, now, sector: "consulting", target: "consulting" })).toBe(false);
    expect(uploadScoringInFlight({ uploadedAt: "nope", now, sector: "consulting", target: "consulting" })).toBe(false);
    expect(uploadScoringInFlight({ uploadedAt: ago(-120_000), now, sector: "consulting", target: "consulting" })).toBe(false);
  });
});
