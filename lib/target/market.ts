import { computeCoverage, type CoverageResult, type CvSkillSource, type JdSkill } from "@/lib/scoring/coverage";
import { isOpen } from "@/lib/scoring/dates";
import { ARCHETYPE_LABELS, type Archetype } from "@/lib/types";

/** `skills` is what `jdRequirementSkills(text_lines, requirements)` returns, so the feed and Target Role agree. */
export type DemandJob = { id: string; archetype: string | null; is_live: boolean; deadline: string | null; skills: JdSkill[] };
export type DemandItem = JdSkill & { jobs: number; share: number; mustShare: number };
export type MarketDemand = { archetype: Archetype; n: number; smallSample: boolean; items: DemandItem[] };

export const SMALL_SAMPLE = 5;
const MAX_ITEMS = 12;

const keyOf = (s: JdSkill) => (s.anyOf?.length ? [...s.anyOf].map((x) => x.toLowerCase()).sort().join("|") : s.skill.toLowerCase());

export function marketDemand(jobs: DemandJob[], archetype: Archetype, today: string): MarketDemand {
  const pool = jobs.filter((j) => j.archetype === archetype && j.is_live && isOpen(j.deadline, today));
  const tally = new Map<string, { item: JdSkill; jobs: number; must: number }>();
  for (const j of pool) {
    const perJob = new Map<string, { item: JdSkill; must: boolean }>();
    for (const s of j.skills) {
      const k = keyOf(s);
      perJob.set(k, { item: perJob.get(k)?.item ?? s, must: (perJob.get(k)?.must ?? false) || s.section === "must" });
    }
    for (const [k, { item, must }] of perJob) {
      const t = tally.get(k) ?? { item, jobs: 0, must: 0 };
      t.jobs += 1;
      if (must) t.must += 1;
      tally.set(k, t);
    }
  }
  const n = pool.length;
  const items = [...tally.values()]
    .map(({ item, jobs, must }) => ({
      skill: item.skill, ...(item.anyOf ? { anyOf: item.anyOf } : {}),
      jobs, share: jobs / n, mustShare: must / jobs,
      section: (must / jobs >= 0.5 ? "must" : "nice") as "must" | "nice",
    }))
    .sort((a, b) => b.jobs - a.jobs || a.skill.localeCompare(b.skill))
    .slice(0, MAX_ITEMS);
  return { archetype, n, smallSample: n < SMALL_SAMPLE, items };
}

export function readiness(d: MarketDemand, cv: CvSkillSource): { coverage: CoverageResult; pct: number | null; label: string } {
  const coverage = computeCoverage(d.items.map(({ skill, section, anyOf }) => ({ skill, section, ...(anyOf ? { anyOf } : {}) })), cv);
  const role = ARCHETYPE_LABELS[d.archetype];
  if (d.n === 0) return { coverage, pct: null, label: `No live ${role} roles right now` };
  if (d.smallSample || coverage.weighted === null) return { coverage, pct: null, label: `Small sample — ${d.n} live ${role} roles` };
  let pct = Math.round(coverage.weighted * 100);
  if (pct >= 100 && coverage.items.some((i) => i.status !== "existing")) pct = 99; // never display 100% with a gap
  return { coverage, pct, label: `Readiness vs ${d.n} live ${role} internships` };
}
