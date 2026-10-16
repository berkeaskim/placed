/** Everything /profile/target shows, computed in one pure step from loaded rows (spec §15.4, §15.6). */
import { ARCHETYPES, YEARS, type Archetype, type ParsedCV, type Requirement, type Year } from "@/lib/types";
import { PLAYBOOKS, type Action } from "@/lib/playbooks";
import { cvSkillSource, jdRequirementSkills, profileSkillSource, type CoverageStatus } from "@/lib/scoring/coverage";
import { marketDemand, readiness, type DemandJob, type MarketDemand } from "./market";
import { activeGuidance, pickActions, type PickedAction } from "./actions";
import { strengthenPlan, type StrengthenPlan } from "./strengthen";

export type JobRow = { id: string; archetype: string | null; is_live: boolean; deadline: string | null; requirements: Requirement[] | null; text_lines: string[] | null };
export type ProgressRow = { action_id: string; status: "planned" | "done"; evidence_note: string | null; evidence_url: string | null };

export type TargetView = {
  sector: Archetype; year: Year; source: "cv" | "profile";
  demand: MarketDemand; pct: number | null; readinessLabel: string;
  /** Coverage status of each market item, keyed by its display skill. */
  status: Record<string, CoverageStatus>;
  existing: string[];
  plan: StrengthenPlan;
  actions: PickedAction[]; topUp: PickedAction[]; fallback: boolean;
  /** Gap skill → ids of picked actions that build it. */
  actionsFor: Record<string, string[]>;
  planned: string[];
  done: (Action & { note: string | null; evidenceUrl: string | null })[];
  guidance: { line: string | null; dated: string[] };
  signals: (typeof PLAYBOOKS)[Archetype]["signals"];
};

const isArchetype = (s: unknown): s is Archetype => typeof s === "string" && (ARCHETYPES as readonly string[]).includes(s);

/** The role and year Target Role works with: the saved target, else the top quiz/CV role, else Consulting; year defaults to 2nd. */
export function targetFor(p: { target_archetype?: unknown; archetypes?: unknown; year?: unknown }): { sector: Archetype; year: Year } {
  const ranked = Array.isArray(p.archetypes) ? [...p.archetypes as { key?: unknown; score?: number }[]].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)) : [];
  const top = ranked.find((a) => isArchetype(a.key))?.key as Archetype | undefined;
  const sector = isArchetype(p.target_archetype) ? p.target_archetype : top ?? "consulting";
  const year = typeof p.year === "string" && (YEARS as readonly string[]).includes(p.year) ? (p.year as Year) : "2nd";
  return { sector, year };
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
  const pick = pickActions(pb, gaps, i.year, i.today, doneIds);

  const actionsFor: Record<string, string[]> = {};
  for (const a of pick.actions) for (const g of a.covers) (actionsFor[g] ??= []).push(a.id);

  const byId = new Map(pb.actions.map((a) => [a.id, a]));
  return {
    sector: i.sector, year: i.year, source: i.cv ? "cv" : "profile",
    demand, pct: r.pct, readinessLabel: r.label,
    status: Object.fromEntries(r.coverage.items.map((c) => [c.skill, c.status])),
    existing: r.coverage.items.filter((c) => c.status === "existing").map((c) => c.skill),
    plan, actions: pick.actions, topUp: pick.topUp, fallback: pick.fallback, actionsFor,
    planned: i.progress.filter((p) => p.status === "planned").map((p) => p.action_id),
    done: doneRows.flatMap((p) => {
      const a = byId.get(p.action_id);
      return a ? [{ ...a, note: p.evidence_note, evidenceUrl: p.evidence_url }] : [];
    }),
    guidance: activeGuidance(pb, i.year, i.today),
    signals: pb.signals,
  };
}
