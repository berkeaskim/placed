import { describe, it, expect } from "vitest";
import {
  NEEDS_NUMBER_TOKEN, hasPlaceholder, fillPlaceholder, stripPlaceholder, placeholderParts,
  tailoredForRows, STATE_COPY, fallbackNotice, buildFinal, keywordCounts, rulesGainedByDimension,
  blockedByBullet, applyGateBlocks, isDirty, defendBullets, verificationState, pct, canReject, canEdit,
  caughtNumbers, countStudentEdits, caughtStatus, verificationCopy, decisionsFromFinal, anyConfirmed, type Decisions,
} from "@/lib/tailor/view";
import { NEEDS_NUMBER } from "@/lib/ai/prompts";
import { FALLBACK_AI_ERROR, FALLBACK_NO_FIXTURE } from "@/lib/ai/tailorCV";
import type { TailorOutcome, TailorChangeView, TailoredFor } from "@/lib/tailor/run";
import type { TailoredCV } from "@/lib/types";
import type { VerifyReport } from "@/lib/verify/tailoring";

const tailored: TailoredCV = {
  summary: "Analyst using Excel and Stata",
  education: [],
  experience: [{
    id: "x0", org: "Society", title: "Officer", dates: "", location: "",
    bullets: [
      { id: "x0-b1", text: "Ran Stata regressions on 3 survey waves", sourceRefs: ["x0-b1"], changeType: "reordered" },
      { id: "x0-b0", text: "Tracked 200 tickets in Excel, cutting backlog by NEEDS_NUMBER", sourceRefs: ["x0-b0"], changeType: "rephrased" },
      { id: "x0-b2", text: "Merged line", sourceRefs: ["x0-b2", "x0-b3"], changeType: "merged" },
      { id: "x0-b4", text: "Old line", sourceRefs: ["x0-b4"], changeType: "dropped" },
    ],
  }],
  projects: [], leadership: [],
  skills: [{ group: "Skills", items: ["Excel", "Stata"] }],
  interests: null, changes: [],
};

const counts = (bm: number, am: number, total = 3) => ({ before: { matched: bm, total }, after: { matched: am, total } });
const change = (p: Partial<TailorChangeView> & { bulletId: string }): TailorChangeView => ({
  entryId: "x0", section: "experience", changeType: "rephrased", jdRequirement: null, before: "", after: "", reason: "",
  sources: [], keywordsAdded: [], qualifiersKept: [], needsNumber: false,
  mustHaves: counts(1, 1), niceToHaves: { before: { matched: 0, total: 1 }, after: { matched: 0, total: 1 } }, ...p,
});

const changes: TailorChangeView[] = [
  change({ bulletId: "x0-b1", changeType: "reordered", before: "Ran Stata regressions on 3 survey waves", after: "Ran Stata regressions on 3 survey waves", sources: [{ id: "x0-b1", text: "Ran Stata regressions on 3 survey waves" }] }),
  change({ bulletId: "x0-b0", before: "Used Excel to track 200 tickets", after: tailored.experience[0].bullets[1].text, sources: [{ id: "x0-b0", text: "Used Excel to track 200 tickets" }], needsNumber: true, jdRequirement: "Excel", mustHaves: counts(1, 2) }),
  change({ bulletId: "x0-b2", changeType: "merged", before: "A / B", after: "Merged line", sources: [{ id: "x0-b2", text: "A" }, { id: "x0-b3", text: "B" }], mustHaves: counts(1, 2) }),
  change({ bulletId: "x0-b4", changeType: "dropped", before: "Old line", after: "", sources: [{ id: "x0-b4", text: "Old line" }] }),
  change({ bulletId: "skills", entryId: null, section: "skills", before: "Excel", after: "Excel, Stata", keywordsAdded: ["Stata"], mustHaves: counts(1, 2) }),
  change({ bulletId: "summary", entryId: null, section: "summary", before: "Economics student", after: "Analyst using Excel and Stata", sources: [{ id: "summary", text: "Economics student" }] }),
];

const report = (verdict: VerifyReport["verdict"], issues: VerifyReport["issues"] = []): VerifyReport => ({ verdict, issues });

const outcome = {
  tailored, report: report("pass"), coverageBefore: 0.45, coverageAfter: 0.81,
  mustHaves: counts(1, 3), niceToHaves: { before: { matched: 0, total: 1 }, after: { matched: 1, total: 1 } },
  tailoredFor: [], changes, reverted: [], unconfirmedNumbers: [], needsNumber: [], attempts: 1, fellBackToOriginal: false, usedFallback: false,
} as unknown as TailorOutcome;

const original = { skills: [{ group: "Skills", items: ["Excel"] }], summary: "Economics student" };
const bulletTexts = (t: TailoredCV) => t.experience[0].bullets.map((b) => `${b.id}:${b.changeType ?? ""}:${b.text}`);

describe("placeholder detection (B9)", () => {
  it("uses the same token as the tailor prompt", () => {
    expect(NEEDS_NUMBER_TOKEN).toBe(NEEDS_NUMBER);
  });
  it("detects, fills, strips and splits NEEDS_NUMBER", () => {
    const t = "Cut backlog by NEEDS_NUMBER in a term";
    expect(hasPlaceholder(t)).toBe(true);
    expect(hasPlaceholder("Cut backlog by 30%")).toBe(false);
    expect(fillPlaceholder(t, " 30% ")).toBe("Cut backlog by 30% in a term");
    expect(stripPlaceholder(t)).toBe("Cut backlog by in a term");
    expect(stripPlaceholder("Cut backlog NEEDS_NUMBER.")).toBe("Cut backlog.");
    expect(placeholderParts(t)).toEqual([{ text: "Cut backlog by ", blank: false }, { text: "", blank: true }, { text: " in a term", blank: false }]);
  });
});

describe("tailoredForRows (state mapping)", () => {
  const rows: TailoredFor[] = [
    { requirement: "Excel", skill: "Excel", section: "must", state: "covered" },
    { requirement: "Tableau", skill: "Tableau", section: "nice", state: "missing" },
    { requirement: "Stata", skill: "Stata", section: "must", state: "surfaced" },
    { requirement: "CFA Level I", skill: "CFA", section: "must", state: "missing" },
    ...Array.from({ length: 8 }, (_, i) => ({ requirement: `Nice ${i}`, skill: null, section: "nice" as const, state: "covered" as const })),
  ];
  it("caps at 8, must-haves first, and never drops a missing requirement", () => {
    const out = tailoredForRows(rows);
    expect(out).toHaveLength(8);
    expect(out.slice(0, 3).map((r) => r.requirement)).toEqual(["Stata", "CFA Level I", "Excel"]);
    expect(out.map((r) => r.requirement)).toContain("Tableau");
  });
  it("maps each state to honest copy with an icon key, never emoji", () => {
    expect(STATE_COPY.covered.label).toBe("Already on your CV");
    expect(STATE_COPY.surfaced.label).toMatch(/made visible/i);
    expect(STATE_COPY.missing.label).toBe("Not in your CV — we didn't invent it");
    for (const s of Object.values(STATE_COPY)) expect(s.label).not.toMatch(/[✅🔁❌]/u);
    expect(new Set(Object.values(STATE_COPY).map((s) => s.icon)).size).toBe(3);
  });
});

describe("fallbackNotice (copy selection)", () => {
  it("is null when the model was used", () => {
    expect(fallbackNotice(false, undefined)).toBeNull();
  });
  it("AI error vs demo mode", () => {
    expect(fallbackNotice(true, FALLBACK_AI_ERROR)).toBe("AI is unavailable right now — we only reordered your bullets.");
    expect(fallbackNotice(true, FALLBACK_NO_FIXTURE)).toBe("Demo mode — showing a reorder-only preview.");
    expect(fallbackNotice(true, undefined)).toBe("Demo mode — showing a reorder-only preview.");
  });
});

describe("buildFinal (accept / edit / reject)", () => {
  it("all suggested = the tailored CV as produced", () => {
    const f = buildFinal(tailored, changes, {}, original);
    expect(bulletTexts(f)).toEqual(bulletTexts(tailored));
    expect(f.skills).toEqual(tailored.skills);
    expect(f.summary).toBe(tailored.summary);
  });
  it("reject restores the original line(s); merged restores every source; dropped comes back", () => {
    const d: Decisions = { "x0-b0": { kind: "rejected" }, "x0-b2": { kind: "rejected" }, "x0-b4": { kind: "rejected" }, skills: { kind: "rejected" }, summary: { kind: "rejected" } };
    const f = buildFinal(tailored, changes, d, original);
    expect(bulletTexts(f)).toEqual([
      "x0-b1:reordered:Ran Stata regressions on 3 survey waves",
      "x0-b0:kept:Used Excel to track 200 tickets",
      "x0-b2:kept:A", "x0-b3:kept:B",
      "x0-b4:kept:Old line",
    ]);
    expect(f.skills).toEqual(original.skills);
    expect(f.summary).toBe("Economics student");
  });
  it("edit replaces the text and keeps the sourceRefs", () => {
    const f = buildFinal(tailored, changes, { "x0-b0": { kind: "edited", text: "Tracked 200 tickets in Excel" }, summary: { kind: "edited", text: "Mine" } }, original);
    const b = f.experience[0].bullets.find((x) => x.id === "x0-b0")!;
    expect(b).toMatchObject({ text: "Tracked 200 tickets in Excel", sourceRefs: ["x0-b0"], changeType: "rephrased" });
    expect(f.summary).toBe("Mine");
  });
  it("an edit can target a bullet that isn't a change (a caught number the student confirmed)", () => {
    const t: TailoredCV = { ...tailored, experience: [{ ...tailored.experience[0], bullets: [{ id: "x0-b9", text: "Reduced regressions", sourceRefs: ["x0-b9"], changeType: "kept" }] }] };
    const f = buildFinal(t, [], { "x0-b9": { kind: "edited", text: "Reduced regressions by 20%" } }, original);
    expect(f.experience[0].bullets[0].text).toBe("Reduced regressions by 20%");
  });
  it("does not duplicate a restored source line already present in the entry", () => {
    const t: TailoredCV = { ...tailored, experience: [{ ...tailored.experience[0], bullets: [
      { id: "m", text: "Merged", sourceRefs: ["a", "b"], changeType: "merged" },
      { id: "b", text: "B", sourceRefs: ["b"], changeType: "kept" },
    ] }] };
    const ch = [change({ bulletId: "m", changeType: "merged", sources: [{ id: "a", text: "A" }, { id: "b", text: "B" }] })];
    expect(bulletTexts(buildFinal(t, ch, { m: { kind: "rejected" } }, original))).toEqual(["a:kept:A", "b:kept:B"]);
  });
});

describe("keywordCounts (hero agrees with What we tailored for)", () => {
  it("counts covered + surfaced rows per section over all rows", () => {
    const rows: TailoredFor[] = [
      { requirement: "Excel", skill: "Excel", section: "must", state: "covered" },
      { requirement: "Stata", skill: "Stata", section: "must", state: "surfaced" },
      { requirement: "CFA", skill: "CFA", section: "must", state: "missing" },
      { requirement: "Tableau", skill: "Tableau", section: "nice", state: "missing" },
      { requirement: "SQL", skill: "SQL", section: "nice", state: "covered" },
    ];
    expect(keywordCounts(rows)).toEqual({ must: { matched: 2, total: 3 }, nice: { matched: 1, total: 2 } });
    expect(keywordCounts([])).toEqual({ must: { matched: 0, total: 0 }, nice: { matched: 0, total: 0 } });
  });
});

describe("rulesGainedByDimension", () => {
  it("counts rules that flip to pass (gained) and from pass (lost), per dimension", () => {
    const before = [
      { ruleId: "a", dimension: "impact" as const, passed: false },
      { ruleId: "b", dimension: "impact" as const, passed: false },
      { ruleId: "c", dimension: "clarity" as const, passed: true },
      { ruleId: "d", dimension: "relevance" as const, passed: false },
    ];
    const after = [
      { ruleId: "a", dimension: "impact" as const, passed: true },
      { ruleId: "b", dimension: "impact" as const, passed: true },
      { ruleId: "c", dimension: "clarity" as const, passed: false },
      { ruleId: "d", dimension: "relevance" as const, passed: false },
    ];
    const r = rulesGainedByDimension(before, after);
    expect(r.gained).toBe(2);
    expect(r.lost).toBe(1);
    expect(r.dims).toEqual([
      { dimension: "impact", label: "Impact", gained: 2, lost: 0 },
      { dimension: "clarity", label: "Clarity", gained: 0, lost: 1 },
    ]);
  });
  it("is empty when nothing changed", () => {
    expect(rulesGainedByDimension([], [])).toEqual({ gained: 0, lost: 0, dims: [] });
  });
});

describe("gate on the student's edits", () => {
  const blocked = report("block", [
    { type: "inventedMetrics", severity: "block", bulletId: "x0-b0", claim: "45%", reason: "Number not in your CV" },
    { type: "perBulletDrift", severity: "warn", bulletId: "x0-b2", claim: "x", reason: "drift" },
  ]);
  it("maps block issues to bullets (warns ignored)", () => {
    expect([...blockedByBullet(blocked).entries()]).toEqual([["x0-b0", { claim: "45%", reason: "Number not in your CV" }]]);
    expect(blockedByBullet(report("pass")).size).toBe(0);
  });
  it("reverts a blocked bullet and records which claim, keeping the others", () => {
    const d: Decisions = { "x0-b0": { kind: "edited", text: "Cut backlog by 45%" }, "x0-b2": { kind: "accepted" } };
    expect(applyGateBlocks(d, blocked)).toEqual({
      "x0-b0": { kind: "rejected", blockedBy: { claim: "45%", reason: "Number not in your CV" } },
      "x0-b2": { kind: "accepted" },
    });
  });
});

describe("state helpers", () => {
  it("isDirty: only rejections and edits change the CV", () => {
    expect(isDirty({})).toBe(false);
    expect(isDirty({ a: { kind: "accepted" }, b: { kind: "suggested" } })).toBe(false);
    expect(isDirty({ a: { kind: "rejected" } })).toBe(true);
    expect(isDirty({ a: { kind: "edited", text: "x" } })).toBe(true);
  });
  it("canReject / canEdit", () => {
    expect(canReject(changes[0])).toBe(false); // reordered: text unchanged
    expect(canReject(changes[1])).toBe(true);
    expect(canEdit(changes[3])).toBe(false); // dropped
    expect(canEdit(changes[4])).toBe(false); // skills list
    expect(canEdit(changes[5])).toBe(true);
  });
  it("defendBullets: accepted/edited text changes only, no placeholders, no skills, no drops", () => {
    const d: Decisions = { "x0-b2": { kind: "accepted" }, summary: { kind: "edited", text: "Mine" }, skills: { kind: "accepted" }, "x0-b4": { kind: "accepted" }, "x0-b0": { kind: "accepted" }, "x0-b1": { kind: "accepted" } };
    const final = buildFinal(tailored, changes, d, original);
    expect(defendBullets(changes, d, final)).toEqual([
      { id: "x0-b2", before: "A / B", after: "Merged line" },
      { id: "summary", before: "Economics student", after: "Mine" },
    ]);
  });
  it("verificationState: traced on pass/warn, caught when reverted, blocked on block", () => {
    expect(verificationState(report("pass"), 0)).toBe("traced");
    expect(verificationState(report("warn"), 2)).toBe("caught");
    expect(verificationState(report("block"), 0)).toBe("blocked");
  });
  it("pct", () => {
    expect(pct(0.454)).toBe("45%");
    expect(pct(null)).toBe("–");
  });
  it("caughtNumbers: reverted bullets whose attempted text holds a caught figure, with the restored line", () => {
    const o = { ...outcome, unconfirmedNumbers: ["20%"], reverted: [
      { bulletId: "x0-b9", reason: "Number not in your CV", attempted: "Reduced regressions by 20%", restored: "Reduced regressions" },
      { bulletId: "skills", reason: "Not in your CV", attempted: "Azure", restored: null },
    ] } as unknown as TailorOutcome;
    expect(caughtNumbers(o)).toEqual([{ bulletId: "x0-b9", claim: "20%", attempted: "Reduced regressions by 20%", restored: "Reduced regressions" }]);
  });
});

describe("countStudentEdits (Made it yours)", () => {
  const cv = {
    summary: "Economics student", experience: [{ id: "x0", bullets: [{ id: "x0-b0", text: "Used Excel to track 200 tickets" }, { id: "x0-b2", text: "A" }, { id: "x0-b3", text: "B" }, { id: "x0-b4", text: "Old line" }, { id: "x0-b1", text: "Ran Stata regressions on 3 survey waves" }] }],
    projects: [], leadership: [],
  } as unknown as import("@/lib/types").ParsedCV;
  it("counts own words only: not accepts, not rejects back to the original", () => {
    expect(countStudentEdits(buildFinal(tailored, changes, {}, original), tailored, cv)).toBe(0);
    expect(countStudentEdits(buildFinal(tailored, changes, { "x0-b0": { kind: "rejected" }, summary: { kind: "rejected" } }, original), tailored, cv)).toBe(0);
    expect(countStudentEdits(buildFinal(tailored, changes, { "x0-b2": { kind: "edited", text: "My own merged line" }, summary: { kind: "edited", text: "Mine" } }, original), tailored, cv)).toBe(2);
  });
});

describe("caught it after the student confirms (fix 1)", () => {
  const reverted = [
    { bulletId: "x0-b9", reason: "Number not in your CV", attempted: "Reduced regressions by 20%", restored: "Reduced regressions" },
    { bulletId: "skills", reason: "Not in your CV", attempted: "Azure", restored: null },
  ];
  it("a reverted line the student confirmed reads as confirmed, with its current text", () => {
    expect(caughtStatus(reverted, { "x0-b9": { kind: "edited", text: "Reduced regressions by 20%" } })).toEqual([
      { bulletId: "x0-b9", confirmed: "Reduced regressions by 20%" }, { bulletId: "skills", confirmed: null },
    ]);
    expect(caughtStatus(reverted, {}).every((x) => x.confirmed === null)).toBe(true);
    expect(caughtStatus(reverted, { "x0-b9": { kind: "rejected" } })[0].confirmed).toBeNull();
  });
  it("anyConfirmed: a confirmed caught line or a blank filled with a figure", () => {
    const o = { ...outcome, reverted } as unknown as TailorOutcome;
    expect(anyConfirmed(o, {})).toBe(false);
    expect(anyConfirmed(o, { "x0-b9": { kind: "edited", text: "Reduced regressions by 20%" } })).toBe(true);
    expect(anyConfirmed(o, { "x0-b0": { kind: "edited", text: "Tracked 200 tickets, cutting backlog by 30%" } })).toBe(true);
    expect(anyConfirmed(o, { "x0-b0": { kind: "edited", text: "Tracked tickets, cutting backlog" } })).toBe(false);
  });
  it("badge copy names the student's confirmations", () => {
    expect(verificationCopy("traced", false)).toBe("Every claim traced to your original CV");
    expect(verificationCopy("caught", true)).toBe("Every claim traced to your CV or confirmed by you");
    expect(verificationCopy("traced", false, true)).toBe("Every claim traced to your CV or experience bank");
    expect(verificationCopy("caught", true, true)).toBe("Every claim traced to your CV or experience bank, or confirmed by you");
    expect(verificationCopy("blocked", true, true)).toMatch(/aren't supported/);
  });
});

describe("decisionsFromFinal (revisit keeps the saved version, fix 2)", () => {
  const caughtOutcome = { ...outcome, reverted: [{ bulletId: "x0-b1", reason: "r", attempted: "Ran Stata regressions on 30 survey waves", restored: "Ran Stata regressions on 3 survey waves" }] } as unknown as TailorOutcome;
  it("round-trips: rebuilding from a saved final gives the same final", () => {
    const d: Decisions = { "x0-b0": { kind: "rejected" }, "x0-b2": { kind: "edited", text: "Own words" }, "x0-b4": { kind: "rejected" }, skills: { kind: "rejected" }, summary: { kind: "edited", text: "Mine" } };
    const saved = buildFinal(tailored, changes, d, original);
    const back = decisionsFromFinal(outcome, saved, original);
    expect(buildFinal(tailored, changes, back, original)).toEqual(saved);
    expect(back["x0-b0"]).toEqual({ kind: "rejected" });
    expect(back["x0-b2"]).toEqual({ kind: "edited", text: "Own words" });
    expect(back["x0-b4"]).toEqual({ kind: "rejected" });
    expect(back.skills).toEqual({ kind: "rejected" });
    expect(back.summary).toEqual({ kind: "edited", text: "Mine" });
  });
  it("all suggested → no decisions; a confirmed caught line → edited", () => {
    expect(decisionsFromFinal(outcome, buildFinal(tailored, changes, {}, original), original)).toEqual({});
    const d: Decisions = { "x0-b1": { kind: "edited", text: "Ran Stata regressions on 30 survey waves" } };
    const back = decisionsFromFinal(caughtOutcome, buildFinal(tailored, changes, d, original), original);
    expect(back["x0-b1"]).toEqual(d["x0-b1"]);
  });
});

describe("decisionCounts (live tally above the change list)", () => {
  it("counts accepted (incl. own words), kept original and still pending; pure moves aren't decisions", async () => {
    const { decisionCounts } = await import("@/lib/tailor/view");
    expect(decisionCounts(changes, {})).toEqual({ accepted: 0, rejected: 0, pending: 5 });
    const d: Decisions = { "x0-b0": { kind: "edited", text: "x" }, "x0-b2": { kind: "accepted" }, skills: { kind: "rejected" } };
    expect(decisionCounts(changes, d)).toEqual({ accepted: 2, rejected: 1, pending: 2 });
  });
});
