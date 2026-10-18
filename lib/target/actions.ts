import type { Action, Playbook } from "@/lib/playbooks";
import type { SignalValue } from "@/lib/playbooks/schema";
import type { CoverageResult } from "@/lib/scoring/coverage";
import { YEARS, type Year } from "@/lib/types";

const EFFORT = { weekend: 0, "2-4 weeks": 1, term: 2 } as const;
const TYPE = { project: 0, experience: 1, course: 2 } as const;
/** Evidence strength, strongest first (06#5): what a recruiter can verify beats what is quick to do. */
export const SIGNAL_RANK: Record<SignalValue, number> = { cv_high: 4, cv_medium: 3, cv_low: 2, interview_prep: 1, test_prep: 0 };
const MAX_PER_GAP = 2;
const MAX_TOTAL = 6;
const FALLBACK = 3;
const MAX_OPPORTUNITIES = 4;
/** Courses, practice and low-signal items: at most one in a fallback or top-up list (06#5). */
const MAX_LIGHT = 1;

export type Gap = string | { skill: string; anyOf?: string[] };
export type PickedAction = Action & { covers: string[]; stale: boolean };
/** Who the student is for eligibility: year of study, plus graduation year when they have given one. */
export type Student = { year: Year; gradYear?: number | null };

export function isActive(x: { expiresOn?: string; reviewBy?: string }, today: string) {
  return { show: !x.expiresOn || x.expiresOn >= today, stale: !!x.reviewBy && x.reviewBy < today };
}

/** Days a dated item stays visible (flagged) after its reviewBy date. */
const REVIEW_GRACE_DAYS = 30;
const STALE_NOTE = " (Dates may have changed: check the official page.)";

/**
 * Shown to every final-year and masters student: the rule affects 2027 graduate-scheme plans.
 * GOV.UK, Graduate visa (accessed 2026-10-18): "2 years if you apply on or before 31 December 2026";
 * "18 months if you apply on or after 1 January 2027"; doctoral qualifications get 3 years.
 */
export const GRADUATE_VISA_NOTE =
  "International students: the Graduate visa lasts 2 years if you apply on or before 31 December 2026, and 18 months from 1 January 2027 (3 years after a PhD). Ask each employer whether they sponsor a Skilled Worker visa after that.";

/**
 * Shown from penultimate year on, in every archetype (07#30). ISE, "Graduate jobs stabilise but AI use disrupts
 * recruitment" (14 Oct 2026): "The most common forms of misconduct were the unauthorised use of AI during interviews
 * and online assessments." Bain London: "For the online assessment or virtual interviews, use of AI is not permitted."
 */
export const AI_INTEGRITY_NOTE =
  "Don't use AI in online tests or live interviews unless the employer says you can. Employers report catching it, and many firms allow one application a year.";

/** Shown when the student hasn't told us their year: we don't guess year-specific advice (06#6). */
export const SET_YEAR_NOTE = "Tell us your year of study and graduation year in your profile to see advice and deadlines for your stage.";
/** Year known but not graduation year: employers key on graduation year, so stage advice is a best guess. */
export const SET_GRAD_YEAR_NOTE = "Add your graduation year in your profile: many programmes are for one graduating class, and course length changes which advice fits you.";

const yearOf = (today: string) => Number(today.slice(0, 4));
const monthOf = (today: string) => Number(today.slice(5, 7));

/** Years from now (this academic year) to graduation: 0 = graduating this academic year. */
export function yearsToGraduation(gradYear: number, today: string): number {
  const academicStart = monthOf(today) >= 9 ? yearOf(today) : yearOf(today) - 1;
  return gradYear - (academicStart + 1);
}

/**
 * The stage the playbook should treat the student as. Employers key on graduation year, so when we have it,
 * it wins over the year label: a 2nd year graduating next summer is a finalist, a 2nd year on a three-year
 * degree is penultimate, and a 2nd year two years from graduating (four-year course) is in the spring-week year,
 * which keeps the "2nd" label. Master's students stay "masters".
 */
export function cycleStage(s: Student, today: string): Year {
  if (s.year === "masters" || s.gradYear == null) return s.year;
  const left = yearsToGraduation(s.gradYear, today);
  if (left <= 0) return "final";
  if (left === 1) return "penultimate";
  if (left === 2) return s.year === "1st" ? "1st" : "2nd";
  return "1st";
}

/** True when the action's year window (minYear..maxYear) includes the student's year. */
export function openToYear(a: { minYear: Year; maxYear?: Year }, year: Year) {
  const yi = YEARS.indexOf(year);
  return YEARS.indexOf(a.minYear) <= yi && (!a.maxYear || yi <= YEARS.indexOf(a.maxYear));
}

/**
 * Whether the student can do or apply for this action. Graduation-year programmes ("graduating in 2029") use
 * the graduation year when we have it. Without one, a "2nd year" may be penultimate on a three-year degree, so
 * penultimate-year steps stay visible to them (07#5) — the heuristics job tagger maps the two the same way.
 */
export function eligibleFor(a: Pick<Action, "minYear" | "maxYear" | "eligibleGradYears">, s: Student, today: string): boolean {
  if (a.eligibleGradYears?.length && s.gradYear != null) return a.eligibleGradYears.includes(s.gradYear);
  const stage = cycleStage(s, today);
  if (openToYear(a, stage)) return true;
  return s.gradYear == null && stage === "2nd" && a.minYear === "penultimate" && openToYear(a, "penultimate");
}

const addDays = (day: string, n: number) => new Date(Date.parse(`${day}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
const light = (a: Action) => a.type === "course" || SIGNAL_RANK[a.signalValue] <= SIGNAL_RANK.cv_low;

const rank = (a: PickedAction, b: PickedAction) =>
  b.covers.length - a.covers.length || SIGNAL_RANK[b.signalValue] - SIGNAL_RANK[a.signalValue]
  || EFFORT[a.effort] - EFFORT[b.effort] || TYPE[a.type] - TYPE[b.type] || a.id.localeCompare(b.id);

/** Soonest deadline first (undated last), then evidence strength. */
const byDeadline = (a: PickedAction, b: PickedAction) =>
  (a.expiresOn ?? "9999") .localeCompare(b.expiresOn ?? "9999") || SIGNAL_RANK[b.signalValue] - SIGNAL_RANK[a.signalValue] || a.id.localeCompare(b.id);

/** Top n by `rank`, with at most MAX_LIGHT courses or practice items. */
function takeRanked(list: PickedAction[], n: number) {
  const out: PickedAction[] = [];
  let lightCount = 0;
  for (const a of [...list].sort(rank)) {
    if (out.length === n) break;
    if (light(a)) { if (lightCount >= MAX_LIGHT) continue; lightCount++; }
    out.push(a);
  }
  return out;
}

const toStudent = (s: Year | Student): Student => (typeof s === "string" ? { year: s } : s);

/**
 * Playbook steps for the student's gaps and stage, never expired or already done.
 * - actions: build steps that close a gap ("Builds X"), or the best general steps when none match (fallback).
 * - topUp: general steps added when only a few gaps match.
 * - opportunities: selective programmes to apply to, by deadline. Never counted as closing a gap (06#4).
 * - uncovered: gaps no step builds yet, so the page can say so instead of silently falling back (07#4).
 */
export function pickActions(pb: Playbook, gaps: Gap[], student: Year | Student, today: string, done: Set<string>) {
  const s = toStudent(student);
  const wanted = gaps.map((g) => (typeof g === "string" ? { skill: g, alts: [g] } : { skill: g.skill, alts: g.anyOf?.length ? g.anyOf : [g.skill] }))
    .map((g) => ({ skill: g.skill, alts: new Set(g.alts.map((x) => x.toLowerCase())) }));
  const coversOf = (a: Action) => {
    const have = new Set(a.skills.map((x) => x.toLowerCase()));
    return wanted.filter((g) => [...g.alts].some((x) => have.has(x))).map((g) => g.skill);
  };
  const open = pb.actions.filter((a) => eligibleFor(a, s, today) && isActive(a, today).show);
  const pool: PickedAction[] = open.filter((a) => !done.has(a.id))
    .map((a) => ({ ...a, covers: a.kind === "build" ? coversOf(a) : [], stale: isActive(a, today).stale }));
  const build = pool.filter((a) => a.kind === "build");
  const opportunities = pool.filter((a) => a.kind === "opportunity").sort(byDeadline).slice(0, MAX_OPPORTUNITIES);

  // gaps that no open build step lists (done ones count: the student has a step for it)
  const reachable = new Set(open.filter((a) => a.kind === "build").flatMap(coversOf));
  const uncovered = wanted.map((g) => g.skill).filter((g) => !reachable.has(g));

  const matched = build.filter((a) => a.covers.length > 0).sort(rank);
  if (matched.length === 0) {
    return { actions: takeRanked(build.filter((a) => a.signals.length > 0), FALLBACK), topUp: [], opportunities, uncovered, fallback: true };
  }

  const perGap = new Map<string, number>();
  const out: PickedAction[] = [];
  for (const a of matched) {
    if (out.length === MAX_TOTAL) break;
    if (a.covers.every((g) => (perGap.get(g) ?? 0) >= MAX_PER_GAP)) continue;
    out.push(a);
    for (const g of a.covers) perGap.set(g, (perGap.get(g) ?? 0) + 1);
  }
  // few gaps map to the playbook (e.g. C++ for a data role): top up with signal-linked steps, shown as "also worth doing"
  const topUp = out.length < FALLBACK
    ? takeRanked(build.filter((a) => a.covers.length === 0 && a.signals.length > 0), FALLBACK - out.length)
    : [];
  return { actions: out, topUp, opportunities, uncovered, fallback: false };
}

/**
 * Whether finishing this step becomes a confirmed fact that tailoring may cite. Courses, job simulations and
 * interview/test practice never do: a certificate isn't evidence of using a skill (07#19), and BCG asks that its
 * Forage simulation is not listed as experience (06#9). The student's note is still kept on the step.
 */
export function becomesFact(a: Pick<Action, "type" | "signalValue" | "simulation">): boolean {
  return a.type !== "course" && !a.simulation && a.signalValue !== "interview_prep" && a.signalValue !== "test_prep";
}

/** Skills the CV backs up only outside the skills list and bullets — a fixed template, no generated text. */
export function visibleHints(c: CoverageResult) {
  return c.items.filter((i) => i.status === "supportedByResume").map((i) => ({
    skill: i.skill,
    text: `Your CV mentions ${i.skill} but not in your skills list or bullets — add a bullet about what you did with it.`,
  }));
}

export type Guidance = { line: string | null; dated: string[]; note: string | null };

/**
 * Year guidance for the student's stage. Dated lines for one graduating class match on graduation year when the
 * student has one. The playbook's course-length note is shown to 2nd and penultimate years without a graduation
 * year, since their stage is ambiguous (06#6).
 */
export function activeGuidance(pb: Playbook, student: Year | Student, today: string): Guidance {
  const s = toStudent(student);
  const stage = cycleStage(s, today);
  const forStudent = (d: Playbook["yearGuidanceDated"][number]) =>
    d.gradYears?.length && s.gradYear != null ? d.gradYears.includes(s.gradYear) : d.year === stage;
  const seen = new Set<string>();
  const dated = pb.yearGuidanceDated
    .filter((d) => forStudent(d) && isActive(d, today).show && !(d.reviewBy && addDays(d.reviewBy, REVIEW_GRACE_DAYS) < today))
    .map((d) => (isActive(d, today).stale ? d.text + STALE_NOTE : d.text))
    .filter((t) => (seen.has(t) ? false : (seen.add(t), true)));
  if (stage === "penultimate" || stage === "final" || stage === "masters") dated.push(AI_INTEGRITY_NOTE);
  if (stage === "final" || stage === "masters") dated.push(GRADUATE_VISA_NOTE);
  const note = pb.note && s.gradYear == null && (stage === "2nd" || stage === "penultimate") ? pb.note : null;
  return { line: pb.yearGuidance[stage] ?? null, dated, note };
}
