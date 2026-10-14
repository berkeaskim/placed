/**
 * Tailoring orchestration (spec §7.1/§7.3, amendments Task 23 pipeline items 1–3 and 6, research 05 §2).
 *
 *   [0] deterministic pre-pass: coverage buckets; gap skills are NEVER sent to the tailor
 *   [2] tailor (injected: lib/ai/tailorCV in the app, fakes in tests)
 *   [3] verifyTailoring gate → on block re-prompt once with the offending claims → still block: revertBlocked
 *       → still block: the original CV (identity tailoring)
 *   [6] reverifyEdits: the same gate on the student's final edits, before any PDF is rendered
 *
 * Item 4 (optional entailment judge) is deliberately skipped. Pure: no I/O, no AI imports beyond the injected tailor.
 */
import type { ParsedCV, TailorChangeType, TailoredBullet, TailoredCV, TailoredEntry } from "@/lib/types";
import type { JobListItem } from "@/lib/db/queries";
import { computeCoverage, cvSkillSource, jdRequirementSkills, type CoverageResult, type JdSkill } from "@/lib/scoring/coverage";
import { extractSkills } from "@/lib/skills/extract";
import { gapsStillOpen, revertBlocked, toTailored, verifyTailoring, type Issue, type VerifyReport } from "@/lib/verify/tailoring";
import { NEEDS_NUMBER } from "@/lib/ai/prompts";
import type { TailorInput } from "@/lib/ai/tailorCV";

export { NEEDS_NUMBER };

/** The tailor may say its answer came from the reorder-only heuristic (TailorCvResult); fakes may omit it. */
export type TailorFn = (i: TailorInput) => Promise<TailoredCV & { usedFallback?: boolean; fallbackReason?: string }>;
export type Counts = { matched: number; total: number };
export type BeforeAfter<T> = { before: T; after: T };

/** One posting requirement and what tailoring did about it. "missing" = not in the CV, so we did not invent it. */
export type TailoredFor = { requirement: string; skill: string | null; section: "must" | "nice"; state: "covered" | "surfaced" | "missing" };

/** Everything 23b needs to render one change (C17 / B7). */
export type TailorChangeView = {
  bulletId: string;
  /** Entry id for bullet changes; null for the skills list and summary. */
  entryId: string | null;
  section: "experience" | "projects" | "leadership" | "skills" | "summary";
  changeType: TailorChangeType;
  jdRequirement: string | null;
  before: string;
  after: string;
  reason: string;
  /** The original CV line(s) this change comes from, resolved via sourceRefs (for skills: the lines that mention the added skills). */
  sources: { id: string; text: string }[];
  keywordsAdded: string[];
  qualifiersKept: string[];
  /** The text holds a NEEDS_NUMBER placeholder: the student must confirm a real figure (B9) or keep the original. */
  needsNumber: boolean;
  /** Must/nice coverage of the original CV vs the original CV with only this change applied. */
  mustHaves: BeforeAfter<Counts>;
  niceToHaves: BeforeAfter<Counts>;
};

export type RevertedChange = { bulletId: string; reason: string; attempted: string; restored: string | null };
export type NeedsNumber = { bulletId: string; text: string; original: string };

export type TailorOutcome = {
  tailored: TailoredCV;
  report: VerifyReport;
  coverageBefore: number | null;
  coverageAfter: number | null;
  mustHaves: BeforeAfter<Counts>;
  niceToHaves: BeforeAfter<Counts>;
  tailoredFor: TailoredFor[];
  changes: TailorChangeView[];
  reverted: RevertedChange[];
  /** Invented figures the gate caught in any attempt (candidates for "Confirm this number"). */
  unconfirmedNumbers: string[];
  needsNumber: NeedsNumber[];
  attempts: 1 | 2;
  /** Even the revert still blocked, so the original CV stands unchanged. */
  fellBackToOriginal: boolean;
  /** The model wasn't used (unavailable, or no recorded fixture): only reordering/surfacing happened. 23b must say so. */
  usedFallback: boolean;
  fallbackReason?: string;
};

export type GateInput = { cv: ParsedCV; rawText: string; job: JobListItem; confirmedFacts: string[] };

// ---------- helpers ----------

const SECTIONS = ["experience", "projects", "leadership"] as const;
const PLACEHOLDER_RE = new RegExp(`\\s*\\b${NEEDS_NUMBER}\\b\\s*`, "g");
const hasPlaceholder = (s: string) => s.includes(NEEDS_NUMBER);
const lc = (s: string) => s.toLowerCase();

function sourceLines(cv: ParsedCV): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of SECTIONS) for (const e of cv[s]) for (const b of e.bullets) m.set(b.id, b.text);
  for (const e of cv.education) for (const d of e.details) m.set(d.id, d.text);
  return m;
}

const mapBullets = (t: TailoredCV, f: (b: TailoredBullet, e: TailoredEntry) => TailoredBullet[]): TailoredCV => {
  const out: TailoredCV = { ...t };
  for (const s of SECTIONS) out[s] = t[s].map((e) => ({ ...e, bullets: e.bullets.flatMap((b) => f(b, e)) }));
  return out;
};

/** What the gate checks: NEEDS_NUMBER removed, every other word kept ("Tracked NEEDS_NUMBER tickets" → "Tracked tickets"). */
function gateView(t: TailoredCV): TailoredCV {
  return mapBullets(t, (b) => [hasPlaceholder(b.text) ? { ...b, text: b.text.replace(PLACEHOLDER_RE, " ").replace(/\s{2,}/g, " ").trim() } : b]);
}

/**
 * What gets rendered: dropped bullets removed; a bullet still holding NEEDS_NUMBER is replaced by its original
 * line(s) (the "keep my original wording" outcome) until the student confirms a real figure.
 */
export function renderView(t: TailoredCV, cv: ParsedCV): TailoredCV {
  const src = sourceLines(cv);
  return mapBullets(t, (b, e) => {
    if (b.changeType === "dropped") return [];
    if (!hasPlaceholder(b.text)) return [b];
    const present = new Set(e.bullets.map((x) => x.id));
    return b.sourceRefs.filter((r) => src.has(r)).flatMap((r, n) =>
      n > 0 && present.has(r) ? [] : [{ id: n === 0 ? b.id : r, text: src.get(r)!, sourceRefs: [r], changeType: "kept" as const }]);
  });
}

type Ctx = { reqs: JdSkill[]; jdKeywords: string[]; before: CoverageResult };

function context(cv: ParsedCV, job: JobListItem): Ctx {
  const reqs = jdRequirementSkills(job.textLines, job.requirements);
  return { reqs, jdKeywords: reqs.map((r) => r.skill), before: computeCoverage(reqs, cvSkillSource(cv)) };
}

const counts = (c: CoverageResult) => ({ must: c.must, nice: c.nice });

/** The gate on one candidate. keywordCoverage and gapsStillOpen are always filled (C8). */
function gate(i: GateInput, ctx: Ctx, t: TailoredCV): { report: VerifyReport; after: CoverageResult } {
  const after = computeCoverage(ctx.reqs, cvSkillSource(renderView(t, i.cv)));
  const report = verifyTailoring({
    source: i.cv, sourceText: i.rawText, confirmedFacts: i.confirmedFacts, tailored: gateView(t), jdKeywords: ctx.jdKeywords,
    coverageBefore: ctx.before.weighted ?? 0, coverageAfter: after.weighted ?? 0,
  });
  report.keywordCoverage ??= { before: ctx.before.weighted ?? 0, after: after.weighted ?? 0, missing: [] };
  report.gapsStillOpen ??= gapsStillOpen({ source: i.cv, sourceText: i.rawText, confirmedFacts: i.confirmedFacts, jdKeywords: ctx.jdKeywords });
  return { report, after };
}

/** Pre-pass [0]: allowed = existing ∪ supportedByResume ∪ skills the student confirmed; supported = prose-only skills. Gaps never. */
function buckets(i: GateInput, ctx: Ctx): { allowed: string[]; supported: string[] } {
  const src = cvSkillSource(i.cv);
  const statusOf = (skill: string, section: "must" | "nice") => computeCoverage([{ skill, section }], src).items[0].status;
  const confirmed = new Set(extractSkills(i.confirmedFacts.join("\n")).map(lc));
  const allowed: string[] = [], supported: string[] = [];
  // A skill named in the student's own confirmed facts is allowed even if the CV text lacks it: it is the student's
  // statement (confirmed_facts), never the JD's. The gate accepts the same facts.
  for (const item of ctx.before.items) {
    for (const s of item.anyOf?.length ? item.anyOf : [item.skill]) {
      const st = statusOf(s, item.section);
      if (st !== "gap" || confirmed.has(lc(s))) allowed.push(s);
      if (st === "supportedByResume") supported.push(s);
    }
  }
  return { allowed: [...new Set(allowed)], supported: [...new Set(supported)] };
}

const feedbackFrom = (issues: Issue[]) =>
  [...new Set(issues.filter((x) => x.severity === "block").map((x) => `"${x.claim}" (${x.type}): ${x.reason}`))];

// ---------- change views (C17) ----------

const DEFAULT_REASON: Record<TailorChangeType, string> = {
  kept: "Unchanged",
  reordered: "Moved up so the most relevant line is read first",
  rephrased: "Reworded so the posting's wording is visible, using only what your original line says",
  merged: "Combined related lines from the same role",
  dropped: "Less relevant to this role, so it was left out",
};

function applyOne(cv: ParsedCV, t: TailoredCV, change: { kind: "bullet"; entryId: string; bullet: TailoredBullet } | { kind: "skills" } | { kind: "summary" }): TailoredCV {
  const base = toTailored(cv);
  if (change.kind === "skills") return { ...base, skills: t.skills };
  if (change.kind === "summary") return { ...base, summary: t.summary };
  const b = change.bullet;
  const refs = new Set(b.sourceRefs);
  for (const s of SECTIONS) {
    base[s] = base[s].map((e) => {
      const kept = e.bullets.filter((x) => !refs.has(x.id) && x.id !== b.id);
      const add = e.id === change.entryId && b.changeType !== "dropped" ? [{ ...b, text: b.text.replace(PLACEHOLDER_RE, " ").trim() }] : [];
      return { ...e, bullets: [...kept, ...add] };
    });
  }
  return base;
}

function buildChanges(i: GateInput, ctx: Ctx, t: TailoredCV): TailorChangeView[] {
  const src = sourceLines(i.cv);
  const srcIndex = new Map<string, { entryId: string; n: number }>();
  for (const s of SECTIONS) for (const e of i.cv[s]) e.bullets.forEach((b, n) => srcIndex.set(b.id, { entryId: e.id, n }));
  const model = new Map(t.changes.map((c) => [c.bulletId, c]));
  const before = counts(ctx.before);
  const delta = (cand: TailoredCV) => {
    const a = counts(computeCoverage(ctx.reqs, cvSkillSource(cand)));
    return { mustHaves: { before: before.must, after: a.must }, niceToHaves: { before: before.nice, after: a.nice } };
  };
  const out: TailorChangeView[] = [];

  for (const section of SECTIONS) {
    for (const e of t[section]) {
      e.bullets.forEach((b, n) => {
        const sources = b.sourceRefs.filter((r) => src.has(r)).map((r) => ({ id: r, text: src.get(r)! }));
        const original = sources.map((s) => s.text).join(" / ");
        let ct: TailorChangeType = b.changeType ?? (b.sourceRefs.length > 1 ? "merged" : b.text === original ? "kept" : "rephrased");
        if ((ct === "kept" || ct === "reordered") && b.text !== original) ct = b.sourceRefs.length > 1 ? "merged" : "rephrased";
        // the model's label alone is no change: an unchanged single-source line is kept (or reordered, below)
        if ((ct === "rephrased" || ct === "reordered") && b.sourceRefs.length === 1 && b.text === original) ct = "kept";
        if (ct === "kept") {
          const at = srcIndex.get(b.sourceRefs[0] ?? "");
          if (at && at.entryId === e.id && at.n !== n) ct = "reordered";
        }
        if (ct === "kept") return;
        const m = model.get(b.id);
        out.push({
          bulletId: b.id, entryId: e.id, section, changeType: ct,
          jdRequirement: m?.jdRequirement ?? null,
          before: original, after: ct === "dropped" ? "" : b.text,
          reason: (ct === "dropped" ? b.dropReason : null) || m?.reason || DEFAULT_REASON[ct],
          sources, keywordsAdded: m?.keywordsAdded ?? [], qualifiersKept: b.qualifiersKept ?? [],
          needsNumber: hasPlaceholder(b.text),
          ...delta(applyOne(i.cv, t, { kind: "bullet", entryId: e.id, bullet: b })),
        });
      });
    }
  }

  const items = (cv: { skills: TailoredCV["skills"] }) => cv.skills.flatMap((g) => g.items);
  const srcItems = new Set(items(i.cv).map(lc));
  const added = items(t).filter((x) => !srcItems.has(lc(x)));
  const removed = items(i.cv).filter((x) => !new Set(items(t).map(lc)).has(lc(x)));
  if (added.length || removed.length) {
    const m = model.get("skills");
    const addedCanon = new Set(added.flatMap((a) => [lc(a), ...extractSkills(a).map(lc)]));
    const sources = [...src.entries()]
      .filter(([, text]) => extractSkills(text).some((s) => addedCanon.has(lc(s))))
      .map(([id, text]) => ({ id, text }));
    out.push({
      bulletId: "skills", entryId: null, section: "skills", changeType: "rephrased",
      jdRequirement: m?.jdRequirement ?? added[0] ?? null,
      before: items(i.cv).join(", "), after: items(t).join(", "),
      reason: m?.reason || (added.length ? `Listed ${added.join(", ")} in Skills: your CV already mentions ${added.length > 1 ? "them" : "it"} elsewhere` : "Tidied the Skills list"),
      sources, keywordsAdded: added, qualifiersKept: [], needsNumber: false,
      ...delta(applyOne(i.cv, t, { kind: "skills" })),
    });
  }
  if ((t.summary ?? "") !== (i.cv.summary ?? "")) {
    const m = model.get("summary");
    out.push({
      bulletId: "summary", entryId: null, section: "summary", changeType: "rephrased",
      jdRequirement: m?.jdRequirement ?? null, before: i.cv.summary ?? "", after: t.summary ?? "",
      reason: m?.reason || "Reworded your summary towards this role", sources: i.cv.summary ? [{ id: "summary", text: i.cv.summary }] : [],
      keywordsAdded: m?.keywordsAdded ?? [], qualifiersKept: [], needsNumber: hasPlaceholder(t.summary ?? ""),
      ...delta(applyOne(i.cv, t, { kind: "summary" })),
    });
  }
  return out;
}

function needsNumberOf(cv: ParsedCV, t: TailoredCV): NeedsNumber[] {
  const src = sourceLines(cv);
  return SECTIONS.flatMap((s) => t[s].flatMap((e) => e.bullets
    .filter((b) => b.changeType !== "dropped" && hasPlaceholder(b.text))
    .map((b) => ({ bulletId: b.id, text: b.text, original: b.sourceRefs.map((r) => src.get(r)).filter(Boolean).join(" / ") }))));
}

function bulletTexts(t: TailoredCV): Map<string, string> {
  const m = new Map<string, string>();
  for (const s of SECTIONS) for (const e of t[s]) for (const b of e.bullets) m.set(b.id, b.text);
  m.set("summary", t.summary ?? ""); m.set("interests", t.interests ?? "");
  return m;
}

// ---------- public API ----------

export async function runTailoring(i: GateInput & { tailor: TailorFn }): Promise<TailorOutcome> {
  const ctx = context(i.cv, i.job);
  const { allowed, supported } = buckets(i, ctx);
  const invented = new Set<string>();
  const note = (r: VerifyReport) => r.issues.filter((x) => x.type === "inventedMetrics" && x.severity === "block").forEach((x) => invented.add(x.claim));

  let usedFallback = false;
  let fallbackReason: string | undefined;
  /** Strips the tailor's fallback flags so they never reach the stored/rendered CV. */
  const call = async (feedback: string[] | null): Promise<TailoredCV> => {
    const { usedFallback: fb, fallbackReason: why, ...t } = await i.tailor({ cv: i.cv, job: i.job, allowed, supported, feedback });
    if (fb) { usedFallback = true; fallbackReason = why ?? fallbackReason; }
    return t;
  };
  let tailored = await call(null);
  let { report } = gate(i, ctx, tailored);
  note(report);
  let attempts: 1 | 2 = 1;
  if (report.verdict === "block") {
    attempts = 2;
    tailored = await call(feedbackFrom(report.issues));
    ({ report } = gate(i, ctx, tailored));
    note(report);
  }

  let reverted: RevertedChange[] = [];
  let fellBackToOriginal = false;
  if (report.verdict === "block") {
    const attempted = bulletTexts(tailored);
    const r = revertBlocked(tailored, i.cv, report.issues);
    const restored = bulletTexts(r.tailored);
    reverted = r.reverted.map((x) => ({ ...x, attempted: attempted.get(x.bulletId) ?? "", restored: restored.has(x.bulletId) ? restored.get(x.bulletId)! : null }));
    if (r.removedSkills.length) {
      const reason = report.issues.find((x) => x.type === "skillInjection" && r.removedSkills.some((s) => lc(s) === lc(x.claim)))?.reason
        ?? "Not in your CV, so we didn't add it";
      reverted.push({ bulletId: "skills", reason, attempted: r.removedSkills.join(", "), restored: null });
    }
    tailored = r.tailored;
    ({ report } = gate(i, ctx, tailored));
    if (report.verdict === "block") {
      tailored = toTailored(i.cv);
      fellBackToOriginal = true;
      ({ report } = gate(i, ctx, tailored));
    }
  }

  const after = computeCoverage(ctx.reqs, cvSkillSource(renderView(tailored, i.cv)));
  const afterStatus = new Map(after.items.map((x) => [x.skill, x.status]));
  const tailoredFor: TailoredFor[] = ctx.before.items.map((b) => ({
    requirement: b.skill, skill: b.skill, section: b.section,
    state: b.status === "gap" ? "missing" : b.status === "supportedByResume" && afterStatus.get(b.skill) === "existing" ? "surfaced" : "covered",
  }));
  return {
    tailored, report,
    coverageBefore: ctx.before.weighted, coverageAfter: after.weighted,
    mustHaves: { before: ctx.before.must, after: after.must }, niceToHaves: { before: ctx.before.nice, after: after.nice },
    tailoredFor, changes: buildChanges(i, ctx, tailored), reverted,
    unconfirmedNumbers: [...invented], needsNumber: needsNumberOf(i.cv, tailored),
    attempts, fellBackToOriginal, usedFallback, ...(fallbackReason ? { fallbackReason } : {}),
  };
}

export type ReverifyResult = {
  tailored: TailoredCV; report: VerifyReport; renderable: boolean;
  coverageAfter: number | null; mustHaves: BeforeAfter<Counts>; niceToHaves: BeforeAfter<Counts>;
  changes: TailorChangeView[]; needsNumber: NeedsNumber[];
};

/**
 * Amendment item 6: re-run the gate on the student's final (accepted/edited/rejected) version before any PDF.
 * Education and interests are forced back to the source: tailoring never changes them.
 */
export function reverifyEdits(i: GateInput & { tailored: TailoredCV }): ReverifyResult {
  const ctx = context(i.cv, i.job);
  const tailored: TailoredCV = {
    ...i.tailored,
    education: i.cv.education.map((e) => ({ ...e, details: e.details.map((d) => ({ ...d })) })),
    interests: i.cv.interests,
  };
  const { report, after } = gate(i, ctx, tailored);
  return {
    tailored, report, renderable: report.verdict !== "block",
    coverageAfter: after.weighted,
    mustHaves: { before: ctx.before.must, after: after.must }, niceToHaves: { before: ctx.before.nice, after: after.nice },
    changes: buildChanges(i, ctx, tailored), needsNumber: needsNumberOf(i.cv, tailored),
  };
}
