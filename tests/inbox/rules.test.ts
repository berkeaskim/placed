import { describe, expect, it } from "vitest";
import { AUTO_MOVE_MIN_CONFIDENCE, canUndo, decide, nextDeadline, targetStatus } from "@/lib/inbox/rules";
import type { AppRef, Classification } from "@/lib/inbox/types";

const app = (status: AppRef["status"]): AppRef => ({ id: "a1", jobId: "j1", status, company: "Lendable", title: "Credit Analyst Intern" });
const c = (kind: Classification["kind"], confidence = 0.9): Classification =>
  ({ kind, company: "Lendable", roleHint: null, deadline: null, actionUrl: null, confidence });

describe("targetStatus: forward only", () => {
  it("moves saved forward on every non-other kind", () => {
    expect(targetStatus("saved", "received")).toBe("applied");
    expect(targetStatus("saved", "assessment")).toBe("applied");
    expect(targetStatus("saved", "interview")).toBe("interview");
    expect(targetStatus("saved", "offer")).toBe("offer");
    expect(targetStatus("saved", "rejection")).toBe("rejected");
  });
  it("never moves backwards", () => {
    expect(targetStatus("interview", "received")).toBeNull();
    expect(targetStatus("interview", "assessment")).toBeNull();
    expect(targetStatus("offer", "interview")).toBeNull();
    expect(targetStatus("applied", "applied" as never)).toBeNull();
  });
  it("allows rejection from every status except rejected", () => {
    for (const s of ["saved", "applied", "interview", "offer"] as const) expect(targetStatus(s, "rejection")).toBe("rejected");
    expect(targetStatus("rejected", "rejection")).toBeNull();
  });
  it("never revives a rejected application", () => {
    for (const k of ["received", "assessment", "interview", "offer"] as const) expect(targetStatus("rejected", k)).toBeNull();
  });
  it("other never moves anything", () => {
    for (const s of ["saved", "applied", "interview", "offer", "rejected"] as const) expect(targetStatus(s, "other")).toBeNull();
  });
});

describe("decide", () => {
  it("moves a matched, confident email", () => {
    expect(decide(c("interview"), app("applied"), false)).toEqual({ effect: "moved", to: "interview" });
  });
  it("suggests instead of moving below the confidence bar", () => {
    expect(decide(c("interview", AUTO_MOVE_MIN_CONFIDENCE - 0.01), app("applied"), false))
      .toEqual({ effect: "suggested", reason: "low_confidence" });
    expect(decide(c("interview", AUTO_MOVE_MIN_CONFIDENCE), app("applied"), false)).toEqual({ effect: "moved", to: "interview" });
  });
  it("suggests adding an unmatched company, and flags ambiguity", () => {
    expect(decide(c("received"), null, false)).toEqual({ effect: "suggested", reason: "unmatched" });
    expect(decide(c("received"), null, true)).toEqual({ effect: "suggested", reason: "ambiguous" });
  });
  it("does nothing for other, for an unmatched email with no company, or when no forward move exists", () => {
    expect(decide(c("other"), app("applied"), false)).toEqual({ effect: "none" });
    expect(decide({ ...c("received"), company: null }, null, false)).toEqual({ effect: "none" });
    expect(decide(c("received"), app("interview"), false)).toEqual({ effect: "none" });
  });
  it("does not suggest a low-confidence email that could not move its card anyway", () => {
    expect(decide(c("received", 0.3), app("interview"), false)).toEqual({ effect: "none" });
    expect(decide(c("interview", 0.3), app("rejected"), false)).toEqual({ effect: "none" });
    expect(decide(c("interview", 0.3), app("applied"), false)).toEqual({ effect: "suggested", reason: "low_confidence" });
  });
});

describe("canUndo", () => {
  it("only undoes a move whose status is still current", () => {
    expect(canUndo({ effect: "moved", new_status: "interview" }, "interview")).toBe(true);
    expect(canUndo({ effect: "moved", new_status: "interview" }, "offer")).toBe(false);
    expect(canUndo({ effect: "suggested", new_status: null }, "applied")).toBe(false);
    expect(canUndo({ effect: "undone", new_status: "interview" }, "interview")).toBe(false);
  });
});

describe("nextDeadline", () => {
  it("picks the earliest deadline today or later", () => {
    expect(nextDeadline(["2026-10-20", null, "2026-10-16", "2026-10-01"], "2026-10-14")).toBe("2026-10-16");
    expect(nextDeadline(["2026-10-14"], "2026-10-14")).toBe("2026-10-14");
    expect(nextDeadline(["2026-10-01", null], "2026-10-14")).toBeNull();
    expect(nextDeadline([], "2026-10-14")).toBeNull();
  });
});
