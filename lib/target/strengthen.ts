/**
 * "How to make your CV stronger for this role" (spec §15.4 extension). Pure and deterministic: no LLM, no
 * generated wording. Every step either points at evidence the CV already has, or ASKS the student — it never
 * proposes a skill, tool or number the CV can't back. The checks are the CV Score's own (hasQuantity, clichés,
 * we/our, bullet length), so the steps and the score agree.
 */
import type { CvEntry, ParsedCV } from "@/lib/types";
import { ARCHETYPE_LABELS } from "@/lib/types";
import { canonicalize, extractSkills } from "@/lib/skills/extract";
import { hasQuantity } from "@/lib/cv-score/checkers";
import { clicheDensity } from "@/lib/cv/cliches";
import { computeCoverage, type CoverageResult, type CoverageStatus, type CvSkillSource } from "@/lib/scoring/coverage";
import type { MarketDemand } from "./market";

export type TipKind = "move_up" | "tool_question" | "number" | "we" | "long" | "cliche";
/** `ask`: the tip is a question for the student; nothing is added unless they say it's true. */
export type BulletTip = { kind: TipKind; text: string; ask: boolean };
export type BulletStep = {
  entryId: string; entryLabel: string; bulletId: string; text: string;
  /** Market skills this bullet already shows. */
  shows: string[]; tips: BulletTip[];
};
export type SkillStepStatus = "supportedByResume" | "gap" | "confirmed";
export type SkillStep = {
  skill: string; options: string[]; jobs: number; n: number; section: "must" | "nice";
  status: SkillStepStatus; where: string | null; text: string;
};
export type StrengthenPlan = {
  /** Skills the CV already evidences outside the skills list and bullets: safe to make visible. */
  visible: SkillStep[];
  /** Skills nothing on the CV shows: a question first ("have you really used it?"), then how to get it. */
  gaps: SkillStep[];
  /** Bullet-level steps, most useful first. */
  bullets: BulletStep[];
  /** Readiness once the visible skills and the student's confirmed skills are on the CV; null when not shown. */
  projected: number | null;
};

export const MAX_BULLET_STEPS = 6;
/** Bullets whose only step is "add a number" repeat one message; show a few and let the CV Score cover the rest. */
export const MAX_NUMBER_ONLY = 3;
const LONG_BULLET_WORDS = 35; // same cut as the bullet_length checker
const MAX_TOOL_ASKS = 2;

/**
 * What a bullet's wording implies a tool was probably used for. Only used to ASK ("did you use X?"), and only
 * for tools the market wants that the CV doesn't show yet. Names must be vocab canonicals (tested).
 */
export const CONCEPT_TOOLS: { pattern: RegExp; tools: string[] }[] = [
  { pattern: /\b(dashboards?|visuali[sz]\w*|charts?|reporting)\b/i, tools: ["Tableau", "Power BI", "Looker", "Excel"] },
  { pattern: /\b(analy[sz]\w*|datasets?|data|surveys?|statistic\w*)\b/i, tools: ["SQL", "Python", "Excel", "R"] },
  { pattern: /\b(financial model\w*|forecast\w*|valuations?|dcf|budget\w*)\b/i, tools: ["Excel", "Python"] },
  { pattern: /\b(databases?|quer(y|ied|ies))\b/i, tools: ["SQL"] },
  { pattern: /\b(automat\w*|scripts?|scrap\w*)\b/i, tools: ["Python"] },
  { pattern: /\b(websites?|web apps?|front-?end|back-?end|apis?)\b/i, tools: ["JavaScript", "TypeScript", "React", "Python"] },
  { pattern: /\b(presentations?|pitch(ed|es)?|slides?)\b/i, tools: ["PowerPoint"] },
  { pattern: /\b(campaigns?|social media|newsletters?|traffic)\b/i, tools: ["Google Analytics", "SEO"] },
  { pattern: /\b(prototypes?|wireframes?|user research|ux)\b/i, tools: ["Figma"] },
];

const lc = (s: string) => s.toLowerCase();

/** First CV line outside the skills list and bullets that names `skill` (a module, a degree detail, the summary). */
function whereMentioned(cv: ParsedCV | null, options: string[]): string | null {
  if (!cv) return null;
  const want = new Set(options.map(lc));
  const lines = [
    ...cv.education.flatMap((e) => [e.degree, ...e.details.map((d) => d.text)]),
    cv.summary ?? "", cv.interests ?? "",
  ];
  return lines.find((l) => l && extractSkills(l).some((s) => want.has(lc(s)))) ?? null;
}

function entryLabel(e: CvEntry) {
  return [e.title, e.org].filter((s) => s && s.trim()).join(" · ") || "an entry";
}

/** Skills the student has stated themselves (confirmed_facts), as vocab canonicals. */
export function confirmedSkills(claims: string[]): Set<string> {
  return new Set(claims.flatMap((c) => extractSkills(c)).map(lc));
}

export function strengthenPlan(i: {
  cv: ParsedCV | null; cvSource: CvSkillSource; coverage: CoverageResult; demand: MarketDemand;
  confirmedClaims: string[]; pct: number | null;
}): StrengthenPlan {
  const { cv, coverage, demand } = i;
  const role = ARCHETYPE_LABELS[demand.archetype];
  const confirmed = confirmedSkills(i.confirmedClaims);
  const byKey = new Map(demand.items.map((d) => [lc(d.skill), d]));
  const statusOf = new Map(coverage.items.map((c) => [lc(c.skill), c.status]));

  const visible: SkillStep[] = [];
  const gaps: SkillStep[] = [];
  for (const c of coverage.items) {
    const d = byKey.get(lc(c.skill));
    if (!d || c.status === "existing") continue;
    const options = c.anyOf?.length ? c.anyOf : [c.skill];
    const base = { skill: c.skill, options, jobs: d.jobs, n: demand.n, section: d.section };
    if (c.status === "supportedByResume") {
      const where = whereMentioned(cv, options);
      visible.push({
        ...base, status: "supportedByResume", where,
        text: `Add ${c.skill} to your Skills list. Your CV already shows it${where ? ` in “${where}”` : ""}. If you used it in a job, project or society role, add a bullet saying what you did with it.`,
      });
    } else if (options.some((o) => confirmed.has(lc(o)))) {
      gaps.push({
        ...base, status: "confirmed", where: null,
        text: `You told us you've used ${c.skill}, so tailoring can use it now. Add it to your CV too: put it in your Skills list and in the bullet where you used it.`,
      });
    } else {
      gaps.push({
        ...base, status: "gap", where: null,
        text: `Nothing on your CV shows ${c.skill} yet. If you have really used it, tell us where and we'll let tailoring use it. If you haven't, the steps below show how to get it.`,
      });
    }
  }
  const byDemand = (a: SkillStep, b: SkillStep) =>
    (a.section === b.section ? 0 : a.section === "must" ? -1 : 1) || b.jobs - a.jobs || a.skill.localeCompare(b.skill);
  visible.sort(byDemand);
  gaps.sort((a, b) => (a.status === b.status ? 0 : a.status === "gap" ? -1 : 1) || byDemand(a, b));

  // Market skills the CV doesn't evidence yet: the only tools worth asking about.
  const askable = new Map<string, number>();
  for (const d of demand.items) {
    for (const o of d.anyOf?.length ? d.anyOf : [d.skill]) {
      const s: CoverageStatus | undefined = statusOf.get(lc(d.skill));
      if (s !== "existing" && !confirmed.has(lc(o))) askable.set(lc(o), Math.max(askable.get(lc(o)) ?? 0, d.jobs));
    }
  }
  const marketSkill = (s: string) => demand.items.find((d) => [d.skill, ...(d.anyOf ?? [])].some((x) => lc(x) === lc(s)));

  const steps: (BulletStep & { score: number })[] = [];
  if (cv) {
    for (const e of [...cv.experience, ...cv.projects, ...cv.leadership]) {
      const label = entryLabel(e);
      const shows = e.bullets.map((b) => extractSkills(b.text).filter((s) => marketSkill(s)));
      e.bullets.forEach((b, idx) => {
        const tips: BulletTip[] = [];
        const own = new Set(extractSkills(b.text).map(lc));
        if (shows[idx].length && idx > 0 && shows.slice(0, idx).every((x) => x.length === 0)) {
          tips.push({ kind: "move_up", ask: false, text: `Make this the first bullet under ${label}. It shows ${shows[idx].join(", ")}, which ${role} roles ask for.` });
        }
        const tools = [...new Set(CONCEPT_TOOLS.filter((c) => c.pattern.test(b.text)).flatMap((c) => c.tools))]
          .map((t) => canonicalize(t) ?? t)
          .filter((t) => askable.has(lc(t)) && !own.has(lc(t)))
          .sort((x, y) => askable.get(lc(y))! - askable.get(lc(x))! || x.localeCompare(y))
          .slice(0, MAX_TOOL_ASKS);
        if (tools.length) {
          const top = tools[0];
          tips.push({
            kind: "tool_question", ask: true,
            text: `Did you use ${tools.join(" or ")} for this? Only if you really did, name it in this bullet. ${top} is asked for in ${askable.get(lc(top))} of ${demand.n} ${role} roles.`,
          });
        }
        if (!hasQuantity(b.text)) {
          tips.push({ kind: "number", ask: true, text: "What changed because of this? Add the real number: how many, how much, how often, or by how much." });
        }
        if (/\b(we|our)\b/i.test(b.text)) {
          tips.push({ kind: "we", ask: false, text: "Say what you did, not what the team did. Start with your own action verb." });
        }
        if (b.text.split(/\s+/).length > LONG_BULLET_WORDS) {
          tips.push({ kind: "long", ask: false, text: "Cut this to one or two lines: the action, the tool and the result." });
        }
        const hits = [...new Set(clicheDensity(b.text, { minWords: 1 }).hits.filter((h) => h.category !== "structural").map((h) => h.match.trim().toLowerCase()))];
        if (hits.length) {
          tips.push({ kind: "cliche", ask: false, text: `Replace “${hits.slice(0, 2).join("”, “")}” with what you actually did and what happened.` });
        }
        if (!tips.length) return;
        const score = shows[idx].length * 3 + tips.filter((t) => t.kind === "move_up" || t.kind === "tool_question").length * 2 + tips.length;
        steps.push({ entryId: e.id, entryLabel: label, bulletId: b.id, text: b.text, shows: shows[idx], tips, score });
      });
    }
  }
  let numberOnly = 0;
  const bullets = steps
    .sort((a, b) => b.score - a.score || a.bulletId.localeCompare(b.bulletId))
    .filter((s) => !(s.tips.length === 1 && s.tips[0].kind === "number") || ++numberOnly <= MAX_NUMBER_ONLY)
    .slice(0, MAX_BULLET_STEPS)
    .map(({ entryId, entryLabel, bulletId, text, shows, tips }) => ({ entryId, entryLabel, bulletId, text, shows, tips }));

  // Projected readiness: the same coverage maths with the visible and confirmed skills added to the skills list.
  let projected: number | null = null;
  if (i.pct !== null && (visible.length || gaps.some((g) => g.status === "confirmed"))) {
    const extra = [...visible, ...gaps.filter((g) => g.status === "confirmed")].flatMap((s) => s.options);
    const after = computeCoverage(coverage.items.map(({ skill, section, anyOf }) => ({ skill, section, ...(anyOf ? { anyOf } : {}) })),
      { ...i.cvSource, skillsList: [...i.cvSource.skillsList, ...extra] });
    if (after.weighted !== null) {
      let p = Math.round(after.weighted * 100);
      if (p >= 100 && after.items.some((x) => x.status !== "existing")) p = 99;
      projected = p > i.pct ? p : null;
    }
  }
  return { visible, gaps, bullets, projected };
}
