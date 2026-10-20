/**
 * Builds lib/playbooks/data.json from the verified research files
 * (docs/research/role-playbooks-*.json). Never edit data.json by hand.
 * Exits non-zero on any integrity failure — fix the data, never relax a check.
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Playbook, type Playbook as PlaybookT } from "@/lib/playbooks/schema";
import { RULES_BY_ID } from "@/lib/cv-rules";
import { SKILLS } from "@/lib/skills/vocab";
import { jdRequirementSkills } from "@/lib/scoring/coverage";
import { ARCHETYPES, YEARS, type Archetype, type Requirement, type Year } from "@/lib/types";

type Raw = Record<string, unknown>;
type TechSource = { id: string; title?: string; publisher?: string; url?: string };

const YEAR_KEYS: Record<string, Year[]> = {
  "1st": ["1st"], "2nd": ["2nd"], penultimate: ["penultimate"], final: ["final"], masters: ["masters"],
  year1: ["1st"], year2_penultimate: ["2nd", "penultimate"], postgrad: ["masters"],
};
const NUM_YEARS: Record<number, Year> = { 1: "1st", 2: "2nd", 3: "penultimate", 4: "final", 5: "masters" };
const DROP = ["hours", "free", "timing", "check", "archetypes"];
/** Relative time words go stale the day after they are written; they never belong in data (06#17). */
export const FROZEN_WORDS = /\b(open now|now open|currently|this year|next month|this month|this autumn|this spring|right now)\b/i;
/** Shared items (access programmes) are copied into several archetypes under the same id. */
const SHARED_PREFIX = "PB-ALL-";

function toYear(v: unknown, where: string): Year {
  if (typeof v === "number" && NUM_YEARS[v]) return NUM_YEARS[v];
  if (typeof v === "string" && (YEARS as readonly string[]).includes(v)) return v as Year;
  if (typeof v === "string" && YEAR_KEYS[v]?.length === 1) return YEAR_KEYS[v][0];
  throw new Error(`${where}: unknown year ${JSON.stringify(v)}`);
}

function inlineSources(list: unknown, techSources: TechSource[], where: string) {
  return ((list as Raw[] | undefined) ?? []).map((s) => {
    if (typeof s.ref !== "string") return s;
    const src = techSources.find((t) => t.id === s.ref);
    if (!src) throw new Error(`${where}: unknown source ref ${s.ref}`);
    const rest = { ...s };
    delete rest.ref;
    return { title: src.title, publisher: src.publisher, url: src.url, ...rest };
  });
}

export function normalise(raw: Raw, techSources: TechSource[]): Record<string, PlaybookT> {
  const out: Record<string, PlaybookT> = {};
  for (const [arch, value] of Object.entries(raw)) {
    const pb = value as Raw;
    if (!pb || !Array.isArray(pb.signals)) continue; // _meta, sources
    const yearGuidance: Partial<Record<Year, string>> = {};
    let note: string | undefined;
    for (const [k, text] of Object.entries((pb.yearGuidance as Raw) ?? {})) {
      if (k === "note") { note = String(text); continue; }
      const years = YEAR_KEYS[k];
      if (!years) throw new Error(`${arch}: unknown year-guidance key ${k}`);
      for (const y of years) yearGuidance[y] = String(text);
    }
    const parsed = Playbook.safeParse({
      signals: (pb.signals as Raw[]).map((s) => ({ ...s, sources: inlineSources(s.sources, techSources, `${arch}/${s.id}`) })),
      actions: ((pb.actions as Raw[]) ?? []).map((a) => {
        const clean: Raw = { ...a };
        for (const k of DROP) delete clean[k];
        return {
          ...clean,
          ...(clean.cost === undefined && a.free === true ? { cost: "Free" } : {}),
          ...(typeof clean.cost === "string" ? { cost: clean.cost.charAt(0).toUpperCase() + clean.cost.slice(1) } : {}),
          description: a.timing ? `${a.description} ${a.timing}` : a.description,
          minYear: toYear(a.minYear, `${arch}/${a.id}`),
          ...(a.maxYear === undefined ? {} : { maxYear: toYear(a.maxYear, `${arch}/${a.id} maxYear`) }),
          sources: inlineSources(a.sources, techSources, `${arch}/${a.id}`),
        };
      }),
      yearGuidance,
      yearGuidanceDated: ((pb.yearGuidanceDated as Raw[]) ?? []).flatMap((d) => {
        const years = typeof d.year === "string" && YEAR_KEYS[d.year] ? YEAR_KEYS[d.year] : [toYear(d.year, `${arch}/dated`)];
        return years.map((year) => ({ ...d, year }));
      }),
      note,
    });
    if (!parsed.success) throw new Error(`${arch}: ${parsed.error.message}`);
    out[arch] = parsed.data;
  }
  return out;
}

/**
 * `shared.actions` (access programmes) carry `archetypes: [...]`; each is appended to those archetypes' actions,
 * after going through the same schema as everything else. Signal links that the target archetype lacks are dropped.
 */
export function addShared(out: Record<string, PlaybookT>, sharedRaw: unknown): Record<string, PlaybookT> {
  const shared = ((sharedRaw as Raw | undefined)?.actions as Raw[] | undefined) ?? [];
  for (const a of shared) {
    const targets = a.archetypes;
    if (!Array.isArray(targets) || targets.length === 0) throw new Error(`shared/${String(a.id)}: needs archetypes`);
    if (typeof a.id !== "string" || !a.id.startsWith(SHARED_PREFIX)) throw new Error(`shared/${String(a.id)}: id must start ${SHARED_PREFIX}`);
    for (const t of targets as string[]) {
      if (!(ARCHETYPES as readonly string[]).includes(t)) throw new Error(`shared/${a.id}: unknown archetype ${t}`);
      const pb = out[t];
      if (!pb) throw new Error(`shared/${a.id}: archetype ${t} not built`);
      const one = normalise({ [t]: { signals: [], actions: [a], yearGuidance: {} } }, [])[t].actions[0];
      pb.actions.push({ ...one, signals: one.signals.filter((id) => pb.signals.some((s) => s.id === id)) });
    }
  }
  return out;
}

export function crossCheck(pbs: Record<string, PlaybookT>, opts: { requireAll: boolean }): string[] {
  const errs: string[] = [];
  const canon = new Set(SKILLS.map((s) => s.canonical));
  const seen = new Set<string>();
  if (opts.requireAll) for (const a of ARCHETYPES) if (!pbs[a]) errs.push(`missing archetype ${a}`);
  for (const [arch, pb] of Object.entries(pbs)) {
    const signalIds = new Set(pb.signals.map((s) => s.id));
    const local = new Set<string>();
    for (const item of [...pb.signals, ...pb.actions]) {
      if (local.has(item.id) || (seen.has(item.id) && !item.id.startsWith(SHARED_PREFIX))) errs.push(`${arch}: duplicate id ${item.id}`);
      local.add(item.id);
      seen.add(item.id);
    }
    for (const [y, text] of Object.entries(pb.yearGuidance)) if (text && FROZEN_WORDS.test(text)) errs.push(`${arch}/${y}: relative time word in year guidance: ${text.match(FROZEN_WORDS)?.[0]}`);
    for (const d of pb.yearGuidanceDated) if (FROZEN_WORDS.test(d.text)) errs.push(`${arch}: relative time word in dated guidance: ${d.text.slice(0, 50)}`);
    for (const s of pb.signals) for (const r of s.ruleIds) {
      const base = r.match(/^([A-Z]+-\d+)[a-z]?$/)?.[1];
      if (!RULES_BY_ID.has(r) && !(base && RULES_BY_ID.has(base))) errs.push(`${arch}/${s.id}: unknown rule ${r}`);
    }
    for (const a of pb.actions) {
      if (a.maxYear && YEARS.indexOf(a.maxYear) < YEARS.indexOf(a.minYear)) errs.push(`${arch}/${a.id}: maxYear before minYear`);
      if (a.url && a.verified !== true) errs.push(`${arch}/${a.id}: link not verified`);
      for (const sk of a.skills) if (!canon.has(sk)) errs.push(`${arch}/${a.id}: non-canonical skill ${sk}`);
      for (const sig of a.signals) if (!signalIds.has(sig)) errs.push(`${arch}/${a.id}: dangling signal ${sig}`);
      if (FROZEN_WORDS.test(a.description)) errs.push(`${arch}/${a.id}: relative time word in description: ${a.description.match(FROZEN_WORDS)?.[0]}`);
      // a linked programme must say when it stops being true (06#30)
      if (a.type === "experience" && a.url && !a.expiresOn && !a.reviewBy && !a.evergreen) errs.push(`${arch}/${a.id}: linked experience needs expiresOn, reviewBy or evergreen`);
      if (a.kind === "opportunity" && a.type !== "experience") errs.push(`${arch}/${a.id}: only experiences can be opportunities`);
      if (a.eligibleGradYears && a.kind !== "opportunity") errs.push(`${arch}/${a.id}: eligibleGradYears is for opportunities`);
    }
    for (const d of pb.yearGuidanceDated) if (!d.expiresOn && !d.reviewBy) errs.push(`${arch}: dated guidance needs expiresOn or reviewBy: ${d.text.slice(0, 50)}`);
  }
  return errs;
}

export type CoverageReport = { archetype: Archetype; vocab: number; uncovered: string[]; demandedUncovered: { skill: string; jobs: number }[] };

/**
 * Which skills the matcher can do something with (07#4). Per archetype: vocab skills tagged with it that no
 * build action lists, and the most-demanded skills in seed jobs that no build action lists. Report only.
 */
export function vocabCoverage(pbs: Record<string, PlaybookT>, jobs: { archetype: string | null; text_lines?: string[] | null; requirements?: Requirement[] | null }[] = []): CoverageReport[] {
  return ARCHETYPES.filter((a) => pbs[a]).map((arch) => {
    const have = new Set(pbs[arch].actions.filter((a) => a.kind === "build").flatMap((a) => a.skills.map((s) => s.toLowerCase())));
    const vocab = SKILLS.filter((s) => s.archetypes.includes(arch));
    const counts = new Map<string, number>();
    for (const j of jobs.filter((x) => x.archetype === arch)) {
      const skills = new Set(jdRequirementSkills(j.text_lines ?? [], j.requirements ?? []).flatMap((k) => k.anyOf ?? [k.skill]));
      for (const k of skills) counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const demandedUncovered = [...counts].filter(([k]) => !have.has(k.toLowerCase()))
      .sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, 20).map(([skill, n]) => ({ skill, jobs: n }));
    return { archetype: arch, vocab: vocab.length, uncovered: vocab.filter((s) => !have.has(s.canonical.toLowerCase())).map((s) => s.canonical), demandedUncovered };
  });
}

function main() {
  const root = path.resolve(import.meta.dirname, "..");
  const read = (f: string) => JSON.parse(readFileSync(path.join(root, "docs/research", f), "utf8")) as Raw;
  const tech = read("role-playbooks-tech-product.json");
  const fin = read("role-playbooks-finance-consulting.json");
  const stem = read("role-playbooks-stem.json");
  const pbs = addShared({ ...normalise(tech, tech.sources as TechSource[]), ...normalise(fin, []), ...normalise(stem, []) }, fin.shared);
  const errs = crossCheck(pbs, { requireAll: true });
  if (errs.length) {
    console.error(`build-playbooks: ${errs.length} integrity error(s)\n${errs.join("\n")}`);
    process.exit(1);
  }
  const ordered = Object.fromEntries(ARCHETYPES.map((a) => [a, pbs[a]]));
  writeFileSync(path.join(root, "lib/playbooks/data.json"), JSON.stringify(ordered, null, 2) + "\n");
  const n = ARCHETYPES.map((a) => `${a}: ${pbs[a].signals.length}S/${pbs[a].actions.length}A`).join(", ");
  console.log(`build-playbooks: wrote lib/playbooks/data.json (${n})`);
  const jobs = JSON.parse(readFileSync(path.join(root, "seed/jobs.json"), "utf8")) as Parameters<typeof vocabCoverage>[1];
  console.log("\nvocab coverage (skills a build action can close; report only):");
  for (const r of vocabCoverage(pbs, jobs)) {
    const top = r.demandedUncovered.slice(0, 8).map((d) => `${d.skill} (${d.jobs})`).join(", ") || "none";
    console.log(`  ${r.archetype}: ${r.vocab - r.uncovered.length}/${r.vocab} vocab skills have an action; most-demanded in seed jobs without one: ${top}`);
  }
  const today = new Date().toISOString().slice(0, 10);
  const old = ARCHETYPES.flatMap((a) => [...pbs[a].actions, ...pbs[a].yearGuidanceDated].filter((x) => x.reviewBy && x.reviewBy < today)
    .map((x) => `${a}: ${"id" in x ? x.id : x.text.slice(0, 40)} (reviewBy ${x.reviewBy})`));
  if (old.length) console.log(`\nreview due (re-check the official page, then move reviewBy):\n  ${old.join("\n  ")}`);
}

if (process.argv[1]?.endsWith("build-playbooks.ts")) main();
