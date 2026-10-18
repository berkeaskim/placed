/** Everything /profile/target shows, computed in one pure step from loaded rows (spec §15.4, §15.6). */
import { ARCHETYPES, YEARS, type Archetype, type ParsedCV, type Requirement, type Year } from "@/lib/types";
import { PLAYBOOKS, type Action } from "@/lib/playbooks";
import { cvSkillSource, jdRequirementSkills, profileSkillSource, type CoverageStatus } from "@/lib/scoring/coverage";
import { marketDemand, readiness, type DemandJob, type MarketDemand } from "./market";
import { activeGuidance, cycleStage, pickActions, SET_GRAD_YEAR_NOTE, SET_YEAR_NOTE, type Guidance, type PickedAction } from "./actions";
import { strengthenPlan, type StrengthenPlan } from "./strengthen";

export type JobRow = { id: string; archetype: string | null; is_live: boolean; deadline: string | null; requirements: Requirement[] | null; text_lines: string[] | null };
export type ProgressRow = { action_id: string; status: "planned" | "done"; evidence_note: string | null; evidence_url: string | null };

export type TargetView = {
  sector: Archetype; year: Year; source: "cv" | "profile";
  /** The stage eligibility and guidance use (graduation year wins over the year label). */
  stage: Year; yearKnown: boolean;
  demand: MarketDemand; pct: number | null; readinessLabel: string;
  /** Coverage status of each market item, keyed by its display skill. */
  status: Record<string, CoverageStatus>;
  existing: string[];
  plan: StrengthenPlan;
  actions: PickedAction[]; topUp: PickedAction[]; fallback: boolean;
  /** Selective programmes to apply to, soonest deadline first. Never shown as a way to get a skill. */
  opportunities: PickedAction[];
  /** Gap skills no playbook step builds yet. */
  uncovered: string[];
  /** Gap skill → ids of picked actions that build it. */
  actionsFor: Record<string, string[]>;
  planned: string[];
  done: (Action & { note: string | null; evidenceUrl: string | null })[];
  guidance: Guidance & { setYear: string | null };
  signals: (typeof PLAYBOOKS)[Archetype]["signals"];
};

const isArchetype = (s: unknown): s is Archetype => typeof s === "string" && (ARCHETYPES as readonly string[]).includes(s);

/**
 * The role and year Target Role works with: the saved target, else the top quiz/CV role, else Consulting.
 * An unknown year is treated as 2nd for picking steps (widest window), but `yearKnown: false` turns off
 * year-specific guidance (06#6).
 */
export function targetFor(p: { target_archetype?: unknown; archetypes?: unknown; year?: unknown; grad_year?: unknown }): { sector: Archetype; year: Year; yearKnown: boolean; gradYear: number | null } {
  const ranked = Array.isArray(p.archetypes) ? [...p.archetypes as { key?: unknown; score?: number }[]].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : [];
  const top = ranked.find((a) => isArchetype(a.key))?.key as Archetype | undefined;
  const sector = isArchetype(p.target_archetype) ? p.target_archetype : top ?? "consulting";
  const yearKnown = typeof p.year === "string" && (YEARS as readonly string[]).includes(p.year);
  const year = yearKnown ? (p.year as Year) : "2nd";
  const gradYear = typeof p.grad_year === "number" && Number.isInteger(p.grad_year) ? p.grad_year : null;
  return { sector, year, yearKnown, gradYear };
}

export function toDemandJobs(rows: JobRow[]): DemandJob[] {
  return rows.map((r) => ({
    id: r.id, archetype: r.archetype, is_live: r.is_live, deadline: r.deadline,
    skills: jdRequirementSkills(r.text_lines ?? [], r.requirements ?? []),
  }));
}

export function buildTargetView(i: {
  /** Raw rows, or jobs whose skills are already parsed (the cached feed jobs). */
  sector: Archetype; year: Year; today: string; jobs: JobRow[] | DemandJob[]; cv: ParsedCV | null; profileSkills: string[];
  gradYear?: number | null; yearKnown?: boolean;
  progress: ProgressRow[]; confirmedClaims: string[];
}): TargetView {
  const pb = PLAYBOOKS[i.sector];
  const src = i.cv ? cvSkillSource(i.cv) : profileSkillSource(i.profileSkills);
  const demand = marketDemand(i.jobs.length && "skills" in i.jobs[0] ? i.jobs as DemandJob[] : toDemandJobs(i.jobs as JobRow[]), i.sector, i.today);
  const r = readiness(demand, src);
  const plan = strengthenPlan({ cv: i.cv, cvSource: src, coverage: r.coverage, demand, confirmedClaims: i.confirmedClaims, pct: r.pct });

  const doneRows = i.progress.filter((p) => p.status === "done");
  const doneIds = new Set(doneRows.map((p) => p.action_id));
  const gaps = r.coverage.items.filter((c) => c.status === "gap").map((c) => ({ skill: c.skill, anyOf: c.anyOf }));
  const student = { year: i.year, gradYear: i.gradYear ?? null };
  const pick = pickActions(pb, gaps, student, i.today, doneIds);
  const yearKnown = i.yearKnown ?? true;

  const actionsFor: Record<string, string[]> = {};
  for (const a of pick.actions) for (const g of a.covers) (actionsFor[g] ??= []).push(a.id);

  const byId = new Map(pb.actions.map((a) => [a.id, a]));
  return {
    sector: i.sector, year: i.year, source: i.cv ? "cv" : "profile",
    stage: cycleStage(student, i.today), yearKnown,
    demand, pct: r.pct, readinessLabel: r.label,
    status: Object.fromEntries(r.coverage.items.map((c) => [c.skill, c.status])),
    existing: r.coverage.items.filter((c) => c.status === "existing").map((c) => c.skill),
    plan, actions: pick.actions, topUp: pick.topUp, fallback: pick.fallback, actionsFor,
    opportunities: pick.opportunities, uncovered: pick.uncovered,
    planned: i.progress.filter((p) => p.status === "planned").map((p) => p.action_id),
    done: doneRows.flatMap((p) => {
      const a = byId.get(p.action_id);
      return a ? [{ ...a, note: p.evidence_note, evidenceUrl: p.evidence_url }] : [];
    }),
    guidance: yearKnown
      ? { ...activeGuidance(pb, student, i.today), setYear: i.gradYear == null ? SET_GRAD_YEAR_NOTE : null }
      : { line: null, dated: [], note: null, setYear: SET_YEAR_NOTE },
    signals: pb.signals,
  };
}
