import type { Action, Playbook } from "@/lib/playbooks";
import type { CoverageResult } from "@/lib/scoring/coverage";
import { YEARS, type Year } from "@/lib/types";

const EFFORT = { weekend: 0, "2-4 weeks": 1, term: 2 } as const;
const TYPE = { project: 0, experience: 1, course: 2 } as const;
const MAX_PER_GAP = 2;
const MAX_TOTAL = 6;
const FALLBACK = 3;

export type Gap = string | { skill: string; anyOf?: string[] };
export type PickedAction = Action & { covers: string[]; stale: boolean };

export function isActive(x: { expiresOn?: string; reviewBy?: string }, today: string) {
  return { show: !x.expiresOn || x.expiresOn >= today, stale: !!x.reviewBy && x.reviewBy < today };
}

const rank = (a: PickedAction, b: PickedAction) =>
  b.covers.length - a.covers.length || EFFORT[a.effort] - EFFORT[b.effort] || TYPE[a.type] - TYPE[b.type] || a.id.localeCompare(b.id);

/** Playbook actions that close the student's gaps, for their year, never expired or already done. */
export function pickActions(pb: Playbook, gaps: Gap[], year: Year, today: string, done: Set<string>) {
  const yi = YEARS.indexOf(year);
  const wanted = gaps.map((g) => (typeof g === "string" ? { skill: g, alts: [g] } : { skill: g.skill, alts: g.anyOf?.length ? g.anyOf : [g.skill] }))
    .map((g) => ({ skill: g.skill, alts: new Set(g.alts.map((s) => s.toLowerCase())) }));
  const pool: PickedAction[] = pb.actions
    .filter((a) => YEARS.indexOf(a.minYear) <= yi && !done.has(a.id) && isActive(a, today).show)
    .map((a) => {
      const have = new Set(a.skills.map((s) => s.toLowerCase()));
      return { ...a, covers: wanted.filter((g) => [...g.alts].some((s) => have.has(s))).map((g) => g.skill), stale: isActive(a, today).stale };
    });

  const matched = pool.filter((a) => a.covers.length > 0).sort(rank);
  if (matched.length === 0) return { actions: pool.filter((a) => a.signals.length > 0).sort(rank).slice(0, FALLBACK), topUp: [], fallback: true };

  const perGap = new Map<string, number>();
  const out: PickedAction[] = [];
  for (const a of matched) {
    if (out.length === MAX_TOTAL) break;
    if (a.covers.every((g) => (perGap.get(g) ?? 0) >= MAX_PER_GAP)) continue;
    out.push(a);
    for (const g of a.covers) perGap.set(g, (perGap.get(g) ?? 0) + 1);
  }
  // few gaps map to the playbook (e.g. C++ for a data role): top up with signal-linked actions, shown as "also worth doing"
  const topUp = out.length < FALLBACK
    ? pool.filter((a) => a.covers.length === 0 && a.signals.length > 0).sort(rank).slice(0, FALLBACK - out.length)
    : [];
  return { actions: out, topUp, fallback: false };
}

/** Skills the CV backs up only outside the skills list and bullets — a fixed template, no generated text. */
export function visibleHints(c: CoverageResult) {
  return c.items.filter((i) => i.status === "supportedByResume").map((i) => ({
    skill: i.skill,
    text: `Your CV mentions ${i.skill} but not in your skills list or bullets — add a bullet about what you did with it.`,
  }));
}

export function activeGuidance(pb: Playbook, year: Year, today: string) {
  return {
    line: pb.yearGuidance[year] ?? null,
    dated: pb.yearGuidanceDated.filter((d) => d.year === year && isActive(d, today).show).map((d) => d.text),
  };
}
