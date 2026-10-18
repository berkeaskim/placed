import { describe, it, expect } from "vitest";
import { db } from "@/lib/db/client";
import { cvFeedback, cvScores, cvs } from "@/lib/db/schema";
import { LOCAL_USER_ID } from "@/lib/auth/local-user";
import type { Fix } from "@/lib/cv-score/aggregate";
import {
  DISPUTE_MIN_SHOWN, alreadyDisputed, disputeReport, disputedRuleIds, loadDisputeData, renderDisputeReport, shownRuleIds,
} from "@/lib/cv-score/feedback";
import { disagreeWithFix } from "@/components/cv-score/actions";
import { seedCv, withTempDb } from "../cv/temp-db";

// Audit 04#25: "I disagree" records feedback but does nothing with it.

const fix = (ruleId: string, gain: number): Fix => ({
  ruleId, statement: ruleId, dimension: "impact", lostPoints: Math.round(gain), gain, evidenceLine: null, fix: null, citation: null, evidence: "B", convention: false,
});

describe("shownRuleIds", () => {
  it("is the next best fix plus up to four more, in panel order: the only fixes a student could dispute", () => {
    const fixes = [fix("A", 1), fix("B", 6), fix("C", 2), fix("D", 3), fix("E", 4), fix("F", 5)];
    expect(shownRuleIds(fixes)).toEqual(["B", "F", "E", "D", "C"]);
  });
});

describe("disputeReport", () => {
  it("ranks rules by dispute rate, counts repeated clicks on one showing once, and flags > 15% over ≥ 20 showings", () => {
    const shown = Array.from({ length: 25 }, (_, k) => ({ cvId: `cv${k}`, sector: "consulting", ruleIds: ["G-21", "G-12"] }));
    const feedback = [
      ...Array.from({ length: 5 }, (_, k) => ({ cvId: `cv${k}`, sector: "consulting", ruleId: "G-21" })),
      { cvId: "cv0", sector: "consulting", ruleId: "G-21" }, // repeat click
      { cvId: "cv1", sector: "consulting", ruleId: "G-12" },
    ];
    const rows = disputeReport({ shown, feedback });
    expect(rows[0]).toMatchObject({ ruleId: "G-21", shown: 25, disputed: 5, rate: 0.2, flagged: true });
    expect(rows[1]).toMatchObject({ ruleId: "G-12", shown: 25, disputed: 1, flagged: false });
  });
  it("doesn't flag a high rate on too few showings", () => {
    const rows = disputeReport({ shown: [{ cvId: "a", sector: "consulting", ruleIds: ["G-21"] }], feedback: [{ cvId: "a", sector: "consulting", ruleId: "G-21" }] });
    expect(rows[0]).toMatchObject({ rate: 1, flagged: false });
    expect(DISPUTE_MIN_SHOWN).toBe(20);
    expect(renderDisputeReport(rows, "2026-10-18")).toContain("too few showings");
  });
  it("counts a dispute whose score was since re-run as a showing", () => {
    const rows = disputeReport({ shown: [], feedback: [{ cvId: null, sector: "finance_banking", ruleId: "G-33" }] });
    expect(rows[0]).toMatchObject({ ruleId: "G-33", shown: 1, disputed: 1 });
  });
  it("renders an empty report without failing", () => {
    expect(renderDisputeReport([], "2026-10-18")).toContain("nothing to report");
  });
});

describe("feedback storage (temp SQLite)", () => {
  withTempDb();
  const U = LOCAL_USER_ID;

  it("one dispute per verdict: repeated clicks don't add rows; the panel can list the disputed rules", async () => {
    db.delete(cvFeedback).run();
    const cvId = seedCv({ raw_text: "x" }).id;
    expect(await disagreeWithFix({ cvId, ruleId: "G-21", sector: "consulting" })).toEqual({ ok: true });
    expect(await disagreeWithFix({ cvId, ruleId: "G-21", sector: "consulting" })).toEqual({ ok: true });
    expect(await disagreeWithFix({ cvId, ruleId: "G-12", sector: "consulting" })).toEqual({ ok: true });
    expect(db.select().from(cvFeedback).all()).toHaveLength(2);
    expect(alreadyDisputed(U, cvId, "consulting", "G-21")).toBe(true);
    expect(disputedRuleIds(U, cvId, "consulting")).toEqual(["G-12", "G-21"]);
    expect(disputedRuleIds(U, cvId, "finance_banking")).toEqual([]);
    expect(disputedRuleIds("someone-else", cvId, "consulting")).toEqual([]);
  });

  it("rejects unknown rules and bad ids without writing", async () => {
    db.delete(cvFeedback).run();
    expect(await disagreeWithFix({ cvId: "not-a-uuid", ruleId: "G-21", sector: "consulting" })).toHaveProperty("error");
    expect(await disagreeWithFix({ cvId: "00000000-0000-4000-8000-000000000009", ruleId: "NOPE", sector: "consulting" })).toHaveProperty("error");
    expect(db.select().from(cvFeedback).all()).toHaveLength(0);
  });

  it("loadDisputeData reads shown fixes from stored scores and disputes from cv_feedback", async () => {
    db.delete(cvFeedback).run();
    db.delete(cvScores).run();
    db.delete(cvs).run();
    const cvId = seedCv({ raw_text: "x" }).id;
    db.insert(cvScores).values({ user_id: U, cv_id: cvId, sector: "consulting", total: 70, dimensions: {}, rule_results: {}, fixes: [fix("G-21", 3), fix("G-12", 1)] }).run();
    await disagreeWithFix({ cvId, ruleId: "G-21", sector: "consulting" });
    const rows = disputeReport(loadDisputeData());
    expect(rows.find((r) => r.ruleId === "G-21")).toMatchObject({ shown: 1, disputed: 1 });
    expect(rows.find((r) => r.ruleId === "G-12")).toMatchObject({ shown: 1, disputed: 0 });
  });
});
