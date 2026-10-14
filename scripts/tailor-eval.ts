/**
 * Live tailoring eval: runs the real pipeline (tailorCV + the verify gate) for a few CVs × roles and prints how many
 * changes survive, what the gate blocked or reverted, and how different the result is per role.
 *   npx tsx --env-file=.env.local scripts/tailor-eval.ts [cv=ayse|rich|all] [jobs=extId,extId]
 * Costs live AI calls. Writes nothing to the DB.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { runTailoring } from "@/lib/tailor/run";
import { tailorCV as liveTailor } from "@/lib/ai/tailorCV";
import type { JobListItem } from "@/lib/db/queries";
import type { ParsedCV } from "@/lib/types";
import { GEMINI_MODELS } from "@/lib/ai/models";

// EVAL_SMART_MODEL=gemini-3.8-flash swaps the smart tier for this run only (Pro preview can take minutes per call).
if (process.env.EVAL_SMART_MODEL) (GEMINI_MODELS as { smart: string }).smart = process.env.EVAL_SMART_MODEL;

type SeedJob = Record<string, unknown> & { ext_id: string; title: string; company_slug: string; text_lines: string[] };

const ROOT = path.resolve(__dirname, "..");
const DEFAULT_JOBS = ["8232726", "8143729", "5924769003", "8156261"]; // Monzo data, Datadog PM, Nova consulting, Monzo SWE

function toJob(j: SeedJob): JobListItem {
  return {
    id: j.ext_id, extId: j.ext_id, title: j.title, url: String(j.url ?? ""), location: String(j.location ?? ""), remote: Boolean(j.remote),
    deadline: (j.deadline as string) ?? null, postedAt: (j.posted_at as string) ?? null, archetype: j.archetype as JobListItem["archetype"],
    yearEligibility: (j.year_eligibility as JobListItem["yearEligibility"]) ?? [], sponsorsVisa: j.sponsors_visa as JobListItem["sponsorsVisa"],
    employmentType: j.employment_type as JobListItem["employmentType"], firstYearFriendly: Boolean(j.first_year_friendly), cohortClash: false,
    requirements: (j.requirements as JobListItem["requirements"]) ?? [], textLines: j.text_lines ?? [], summary: String(j.summary ?? ""),
    company: j.company_slug,
  };
}

function rawTextOf(cv: ParsedCV): string {
  const lines: string[] = [cv.name ?? "", cv.summary ?? ""];
  for (const e of cv.education) lines.push(`${e.institution} ${e.degree} ${e.dates ?? ""} ${e.grade ?? ""}`, ...e.details.map((d) => d.text));
  for (const s of ["experience", "projects", "leadership"] as const) for (const e of cv[s]) lines.push(`${e.title} ${e.org} ${e.dates ?? ""}`, ...e.bullets.map((b) => b.text));
  lines.push(...cv.skills.map((g) => `${g.group}: ${g.items.join(", ")}`), cv.interests ?? "");
  return lines.filter(Boolean).join("\n");
}

/** The live tailor, timed per call (attempt 1 and the re-prompt, if any). */
const callTimes: number[] = [];
const feedbacks: string[] = [];
const tailorCV: typeof liveTailor = async (i) => {
  const t0 = Date.now();
  if (i.feedback) feedbacks.push(...i.feedback);
  try { return await liveTailor(i); } finally { callTimes.push(Math.round((Date.now() - t0) / 1000)); }
};

const CVS: Record<string, string> = { ayse: "seed/demo/ayse.json", rich: "scripts/fixtures/eval-cv-rich.json" };

async function main() {
  const cvArg = process.argv[2] ?? "all";
  const jobIds = process.argv[3]?.split(",") ?? DEFAULT_JOBS;
  const jobs = (JSON.parse(readFileSync(path.join(ROOT, "seed/jobs.json"), "utf8")) as SeedJob[]).filter((j) => jobIds.includes(j.ext_id));
  const cvNames = cvArg === "all" ? Object.keys(CVS) : [cvArg];
  const out: Record<string, unknown>[] = [];
  console.log(`smart model: ${GEMINI_MODELS.smart}`);
  for (const name of cvNames) {
    const cv = JSON.parse(readFileSync(path.join(ROOT, CVS[name]), "utf8")) as ParsedCV;
    const bullets = (["experience", "projects", "leadership"] as const).reduce((n, s) => n + cv[s].reduce((m, e) => m + e.bullets.length, 0), 0);
    for (const j of jobs) {
      const job = toJob(j);
      const t0 = Date.now();
      callTimes.length = 0; feedbacks.length = 0;
      const r = await Promise.race([
        runTailoring({ cv, rawText: rawTextOf(cv), job, confirmedFacts: [], tailor: tailorCV }).then((o) => ({ job, o, ms: Date.now() - t0 })),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout after 300s")), 300_000).unref()),
      ]).catch((e: unknown) => ({ job, err: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 }));
      if ("err" in r) { console.log(`\n### ${name} × ${r.job.title}: ERROR ${r.err} (calls so far ${callTimes.join("+") || "none"}s)`); continue; }
      const { o } = r;
      const by = o.changes.reduce<Record<string, number>>((m, c) => ({ ...m, [c.changeType]: (m[c.changeType] ?? 0) + 1 }), {});
      const blocks = o.report.issues.filter((x) => x.severity === "block");
      console.log(`\n### ${name} (${bullets} bullets) × ${job.title} [${job.archetype}] ${Math.round(r.ms / 1000)}s (calls ${callTimes.join("+")}s)`);
      console.log(`changes=${o.changes.length} ${JSON.stringify(by)} reverted=${o.reverted.length} attempts=${o.attempts} fallback=${o.usedFallback} original=${o.fellBackToOriginal} verdict=${o.report.verdict}`);
      console.log(`must ${o.mustHaves.before.matched}/${o.mustHaves.before.total}→${o.mustHaves.after.matched}/${o.mustHaves.after.total}  coverage ${o.coverageBefore?.toFixed(2)}→${o.coverageAfter?.toFixed(2)}`);
      for (const c of o.changes) console.log(`  [${c.changeType}] ${c.section}/${c.bulletId}: ${c.before.slice(0, 90)}\n      → ${c.after.slice(0, 160)}`);
      for (const f of feedbacks) console.log(`  ATTEMPT1 BLOCK ${f.slice(0, 160)}`);
      for (const x of o.reverted) console.log(`  REVERTED ${x.bulletId}: ${x.reason} | tried: ${x.attempted.slice(0, 120)}`);
      for (const x of blocks) console.log(`  BLOCK ${x.type}/${x.check ?? ""} ${x.bulletId ?? x.entryId ?? ""}: ${x.claim}`);
      out.push({ cv: name, job: job.extId, title: job.title, archetype: job.archetype, changes: o.changes.length, by, reverted: o.reverted, after: o.tailored, report: o.report });
    }
  }
  mkdirSync(path.join(ROOT, ".eval"), { recursive: true });
  const file = path.join(ROOT, ".eval", `tailor-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  writeFileSync(file, JSON.stringify(out, null, 1));
  console.log(`\nwrote ${file}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
