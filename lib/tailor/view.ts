/**
 * Pure view logic for the tailoring screen (Task 23b, spec §8, amendments B6–B9, C13). Client-safe: type-only
 * imports from lib/tailor/run and lib/verify, no AI, no I/O. The "use client" panel imports its types from here.
 */
import type { ParsedCV, TailoredCV } from "@/lib/types";
import type { Counts, RevertedChange, TailorChangeView, TailoredFor, TailorOutcome } from "@/lib/tailor/run";
import type { VerifyReport } from "@/lib/verify/tailoring";
import type { Dimension } from "@/lib/cv-rules/types";
import { DIM_LABEL } from "@/lib/cv-score/present";

export type { Counts, RevertedChange, TailorChangeView, TailoredFor, TailorOutcome, VerifyReport };
/** Same shape as lib/ai/defendQuestions DefendQuestionT (client-safe copy). */
export type DefendQuestion = { bulletId: string; question: string; whyTheyAsk: string; prepTip: string };

// ---------- NEEDS_NUMBER placeholders (B9) ----------

/** Same token as lib/ai/prompts NEEDS_NUMBER (a test pins them together; lib/ai is not client-safe). */
export const NEEDS_NUMBER_TOKEN = "NEEDS_NUMBER";
const TOKEN_RE = new RegExp(`\\b${NEEDS_NUMBER_TOKEN}\\b`, "g");

export const hasPlaceholder = (text: string) => text.includes(NEEDS_NUMBER_TOKEN);
export const fillPlaceholder = (text: string, figure: string) => text.replace(TOKEN_RE, figure.trim());
/** "Remove it": the line without the number. Mirrors what the gate checks. */
export const stripPlaceholder = (text: string) =>
  text.replace(new RegExp(`\\s*\\b${NEEDS_NUMBER_TOKEN}\\b\\s*`, "g"), " ").replace(/\s{2,}/g, " ").replace(/\s+([.,;:!?])/g, "$1").trim();
/** For rendering the placeholder as a visible blank instead of the raw token. */
export function placeholderParts(text: string): { text: string; blank: boolean }[] {
  const out: { text: string; blank: boolean }[] = [];
  text.split(TOKEN_RE).forEach((part, i) => {
    if (i > 0) out.push({ text: "", blank: true });
    if (part) out.push({ text: part, blank: false });
  });
  return out;
}

// ---------- "What we tailored for" ----------

export const STATE_COPY: Record<TailoredFor["state"], { label: string; icon: "check" | "surface" | "cross"; tone: string; bg: string }> = {
  covered: { label: "Already on your CV", icon: "check", tone: "text-[#0B6B49]", bg: "bg-[#E3F6EE]" },
  surfaced: { label: "Made visible by rephrasing your experience", icon: "surface", tone: "text-[#2340A8]", bg: "bg-[#E6EEFF]" },
  missing: { label: "Not in your CV — we didn't invent it", icon: "cross", tone: "text-[#B42318]", bg: "bg-[#FDECEA]" },
};

const STATE_ORDER: Record<TailoredFor["state"], number> = { surfaced: 0, missing: 1, covered: 2 };

/** Spec §8.2: 5–8 requirements. Must-haves first; a "missing" requirement is never cut (it is the honesty proof). */
export function tailoredForRows(items: TailoredFor[], max = 8): TailoredFor[] {
  const sorted = items
    .map((t, i) => ({ t, i }))
    .sort((a, b) => (a.t.section === b.t.section ? 0 : a.t.section === "must" ? -1 : 1)
      || STATE_ORDER[a.t.state] - STATE_ORDER[b.t.state] || a.i - b.i)
    .map((x) => x.t);
  const missing = sorted.filter((t) => t.state === "missing");
  const keep = new Set([...sorted.filter((t) => t.state !== "missing").slice(0, Math.max(0, max - missing.length)), ...missing]);
  return sorted.filter((t) => keep.has(t));
}

// ---------- fallback notice ----------

export const FALLBACK_COPY = {
  aiError: "AI is unavailable right now — we only reordered your bullets.",
  demo: "Demo mode — showing a reorder-only preview.",
} as const;

/** tailorCV's FALLBACK_AI_ERROR says "unavailable"; FALLBACK_NO_FIXTURE (or no reason) is demo mode. */
export function fallbackNotice(usedFallback: boolean, reason: string | undefined): string | null {
  if (!usedFallback) return null;
  return reason && /unavailable/i.test(reason) ? FALLBACK_COPY.aiError : FALLBACK_COPY.demo;
}

// ---------- per-bullet decisions (B8) ----------

export type Decision =
  | { kind: "suggested" }
  | { kind: "accepted" }
  | { kind: "edited"; text: string }
  | { kind: "rejected"; blockedBy?: { claim: string; reason: string } };
export type Decisions = Record<string, Decision>;
export type OriginalParts = { skills: TailoredCV["skills"]; summary: string | null };

const SECTIONS = ["experience", "projects", "leadership"] as const;
const kindOf = (d: Decisions, id: string) => d[id]?.kind ?? "suggested";

export const canReject = (c: TailorChangeView) => c.changeType !== "reordered";
export const canEdit = (c: TailorChangeView) => c.changeType !== "dropped" && c.section !== "skills";

/**
 * The student's version: suggested/accepted keep the tailored line, edited replaces its text (same sourceRefs, so
 * the gate still traces it), rejected restores the original CV line(s). Reject on a line that isn't a change
 * (e.g. a blocked edit of a caught number) simply drops the edit.
 */
export function buildFinal(t: TailoredCV, changes: TailorChangeView[], d: Decisions, original: OriginalParts): TailoredCV {
  const byId = new Map(changes.map((c) => [c.bulletId, c]));
  const out: TailoredCV = { ...t, changes: t.changes.filter((c) => kindOf(d, c.bulletId) !== "rejected") };
  for (const s of SECTIONS) {
    out[s] = t[s].map((e) => {
      const emitted = new Set<string>();
      const bullets = e.bullets.flatMap((b) => {
        const dec = d[b.id];
        const c = byId.get(b.id);
        if (dec?.kind === "rejected" && c) {
          const others = new Set(e.bullets.filter((x) => x.id !== b.id).map((x) => x.id));
          return c.sources
            .filter((src) => !others.has(src.id) && !emitted.has(src.id))
            .map((src) => { emitted.add(src.id); return { id: src.id, text: src.text, sourceRefs: [src.id], changeType: "kept" as const }; });
        }
        emitted.add(b.id);
        if (dec?.kind === "edited") return [{ ...b, text: dec.text.trim(), changeType: b.changeType === "merged" ? "merged" as const : "rephrased" as const }];
        return [b];
      });
      return { ...e, bullets };
    });
  }
  out.skills = kindOf(d, "skills") === "rejected" ? original.skills.map((g) => ({ group: g.group, items: [...g.items] })) : t.skills;
  const sd = d.summary;
  out.summary = sd?.kind === "rejected" ? original.summary : sd?.kind === "edited" ? sd.text.trim() : t.summary;
  return out;
}

/**
 * Controller ruling (fix round 1): the Findability box shows "Must-have keywords found X/Y", counted from the same rows
 * as "What we tailored for" (covered + surfaced), so the two always agree. "Must-haves met" is reserved for B10.
 */
export function keywordCounts(rows: TailoredFor[]): { must: Counts; nice: Counts } {
  const c = (section: TailoredFor["section"]) => {
    const r = rows.filter((x) => x.section === section);
    return { matched: r.filter((x) => x.state !== "missing").length, total: r.length };
  };
  return { must: c("must"), nice: c("nice") };
}

const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();

/** "Made it yours": lines the student wrote, i.e. neither the AI's suggestion for that id nor an original CV line. */
export function countStudentEdits(final: TailoredCV, suggested: TailoredCV, cv: ParsedCV): number {
  const suggestion = new Map<string, string>();
  for (const s of SECTIONS) for (const e of suggested[s]) for (const b of e.bullets) suggestion.set(b.id, norm(b.text));
  const originals = new Set([...cv.experience, ...cv.projects, ...cv.leadership].flatMap((e) => e.bullets.map((b) => norm(b.text))));
  if (cv.summary) originals.add(norm(cv.summary));
  let n = 0;
  for (const s of SECTIONS) for (const e of final[s]) for (const b of e.bullets) {
    const t = norm(b.text);
    if (b.changeType !== "dropped" && suggestion.has(b.id) && suggestion.get(b.id) !== t && !originals.has(t)) n++;
  }
  if (final.summary && norm(final.summary) !== norm(suggested.summary ?? "") && !originals.has(norm(final.summary))) n++;
  return n;
}

export const isDirty = (d: Decisions) => Object.values(d).some((x) => x.kind === "rejected" || x.kind === "edited");

// ---------- rules gained (score after tailoring, never a single LLM number) ----------

export type RuleCheck = { ruleId: string; dimension: Dimension; passed: boolean };
export type RulesGained = { gained: number; lost: number; dims: { dimension: Dimension; label: string; gained: number; lost: number }[] };
const DIM_ORDER: Dimension[] = ["ats", "impact", "clarity", "relevance", "uk"];

export function rulesGainedByDimension(before: RuleCheck[], after: RuleCheck[]): RulesGained {
  const prev = new Map(before.map((r) => [r.ruleId, r]));
  const per = new Map<Dimension, { gained: number; lost: number }>();
  for (const a of after) {
    const b = prev.get(a.ruleId);
    if (!b || b.passed === a.passed) continue;
    const cur = per.get(a.dimension) ?? { gained: 0, lost: 0 };
    if (a.passed) cur.gained++; else cur.lost++;
    per.set(a.dimension, cur);
  }
  const dims = DIM_ORDER.filter((x) => per.has(x)).map((dimension) => ({ dimension, label: DIM_LABEL[dimension], ...per.get(dimension)! }));
  return { gained: dims.reduce((n, x) => n + x.gained, 0), lost: dims.reduce((n, x) => n + x.lost, 0), dims };
}

// ---------- the gate on the student's edits ----------

export function blockedByBullet(r: VerifyReport): Map<string, { claim: string; reason: string }> {
  const m = new Map<string, { claim: string; reason: string }>();
  for (const x of r.issues) if (x.severity === "block" && x.bulletId && !m.has(x.bulletId)) m.set(x.bulletId, { claim: x.claim, reason: x.reason });
  return m;
}

/** "If the gate blocks an edit, show which claim and revert that bullet." */
export function applyGateBlocks(d: Decisions, r: VerifyReport): Decisions {
  const out = { ...d };
  for (const [id, blockedBy] of blockedByBullet(r)) out[id] = { kind: "rejected", blockedBy };
  return out;
}

export type VerificationState = "traced" | "caught" | "blocked";
export function verificationState(r: VerifyReport, revertedCount: number): VerificationState {
  if (r.verdict === "block") return "blocked";
  return revertedCount > 0 ? "caught" : "traced";
}

export function verificationCopy(state: VerificationState, confirmedAny: boolean): string {
  if (state === "blocked") return "Some lines aren't supported by your CV yet. Fix the flagged lines to download.";
  return confirmedAny ? "Every claim traced to your CV or confirmed by you" : "Every claim traced to your original CV";
}

// ---------- B6 "Caught it" → B9 confirm ----------

/** Fix 1: a caught line the student then confirmed (edited) shows as confirmed, not as still removed. */
export function caughtStatus(reverted: RevertedChange[], d: Decisions): { bulletId: string; confirmed: string | null }[] {
  return reverted.map((r) => {
    const x = d[r.bulletId];
    return { bulletId: r.bulletId, confirmed: r.restored !== null && x?.kind === "edited" ? x.text : null };
  });
}

/** Badge wording: a caught figure the student confirmed, or a NEEDS_NUMBER blank they filled with a figure. */
export function anyConfirmed(o: TailorOutcome, d: Decisions): boolean {
  if (caughtStatus(o.reverted, d).some((x) => x.confirmed !== null)) return true;
  return o.changes.some((c) => { const x = d[c.bulletId]; return c.needsNumber && x?.kind === "edited" && /\d/.test(x.text); });
}

/**
 * Fix 2: on a revisit, rebuild the decisions that produced the saved version (applications.tailored_json.final),
 * so the screen shows what's in the saved PDF and never offers to overwrite it with the AI version.
 */
export function decisionsFromFinal(o: TailorOutcome, final: TailoredCV, original: OriginalParts): Decisions {
  const lines = new Map<string, { text: string; changeType?: string }>();
  for (const s of SECTIONS) for (const e of final[s]) for (const b of e.bullets) lines.set(b.id, { text: b.text, changeType: b.changeType });
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  const d: Decisions = {};
  for (const c of o.changes) {
    if (c.section === "skills") {
      if (!same(final.skills, o.tailored.skills) && same(final.skills, original.skills)) d.skills = { kind: "rejected" };
      continue;
    }
    if (c.section === "summary") {
      if (final.summary === o.tailored.summary) continue;
      d.summary = final.summary === original.summary ? { kind: "rejected" } : { kind: "edited", text: final.summary ?? "" };
      continue;
    }
    const f = lines.get(c.bulletId);
    if (c.changeType === "dropped") { if (f && f.changeType !== "dropped") d[c.bulletId] = { kind: "rejected" }; continue; }
    if (!f) { d[c.bulletId] = { kind: "rejected" }; continue; }
    if (f.text === c.after) continue;
    const own = (c.sources.find((x) => x.id === c.bulletId) ?? c.sources[0])?.text;
    d[c.bulletId] = f.changeType === "kept" && f.text === own ? { kind: "rejected" } : { kind: "edited", text: f.text };
  }
  for (const r of o.reverted) {
    const f = lines.get(r.bulletId);
    if (r.restored !== null && !d[r.bulletId] && f && f.text !== r.restored) d[r.bulletId] = { kind: "edited", text: f.text };
  }
  return d;
}

export type CaughtNumber = { bulletId: string; claim: string; attempted: string; restored: string };
/** Reverted bullets whose attempted text held a figure the gate caught: the student may confirm it's real. */
export function caughtNumbers(o: TailorOutcome): CaughtNumber[] {
  return o.reverted.flatMap((r) => {
    if (r.restored === null || r.bulletId === "skills" || r.bulletId === "summary") return [];
    const claim = o.unconfirmedNumbers.find((n) => n && r.attempted.includes(n));
    return claim ? [{ bulletId: r.bulletId, claim, attempted: r.attempted, restored: r.restored }] : [];
  });
}

// ---------- C13 "Be ready to defend this" ----------

function finalText(t: TailoredCV, id: string): string | null {
  if (id === "summary") return t.summary;
  for (const s of SECTIONS) for (const e of t[s]) for (const b of e.bullets) if (b.id === id) return b.text;
  return null;
}

/** One question per line the student explicitly accepted or wrote, with real text (no placeholders, drops, skills or pure moves). */
export function defendBullets(changes: TailorChangeView[], d: Decisions, final: TailoredCV): { id: string; before: string; after: string }[] {
  return changes.flatMap((c) => {
    const k = kindOf(d, c.bulletId);
    if ((k !== "accepted" && k !== "edited") || c.section === "skills" || c.changeType === "dropped" || c.changeType === "reordered") return [];
    const after = finalText(final, c.bulletId);
    return after && !hasPlaceholder(after) ? [{ id: c.bulletId, before: c.before, after }] : [];
  });
}

export const pct = (x: number | null) => (x === null ? "–" : `${Math.round(x * 100)}%`);
