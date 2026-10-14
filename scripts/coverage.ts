// Recall benchmark for the ingest seed list. No DB access, no writes.
//   npm run coverage                       offline: which benchmark employers have an enabled board
//   npm run coverage -- --live             also fetch every referenced board and count kept UK/EU early-career postings
//   npm run coverage -- --companies <yml>  measure another seed list (e.g. `git show main:seed/companies.yml > /tmp/old.yml`)
//   npm run coverage -- --live --json <out.json>   save per-board counts so later runs can reuse them with --counts
import { readFileSync, writeFileSync } from "node:fs";
import YAML from "yaml";
import { fetchJobs, type CompanySeed } from "@/lib/ingest/providers";
import { classifyRegion, passesLocationFilter, passesTitleFilter } from "@/lib/ingest/filter";
import { htmlToLines } from "@/lib/text/jd";
import {
  employerCoverage, enabledSources, sourceKey, summarize, unknownSources,
  type BenchmarkEmployer, type BoardCount,
} from "@/lib/ingest/coverage";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};

type SeedRow = { slug: string; name: string; ats: CompanySeed["ats"]; apiHost?: string; enabled?: boolean };

async function countBoard(c: SeedRow): Promise<BoardCount> {
  try {
    const raw = await fetchJobs({ slug: c.slug, name: c.name, ats: c.ats, apiHost: c.apiHost ?? null });
    // Same inclusion rules as ingestCompany (title, then location against the JD text).
    const kept = raw.filter((j) => passesTitleFilter(j.title) && passesLocationFilter(j.location, j.remote, htmlToLines(j.html).join("\n")).pass);
    return { kept: kept.length, uk: kept.filter((j) => ["london", "uk"].includes(classifyRegion(j.location, j.remote))).length };
  } catch (e) {
    return { error: (e as Error).message };
  }
}

async function main() {
  const bench = YAML.parse(readFileSync("seed/coverage-benchmark.yml", "utf8")) as BenchmarkEmployer[];
  const companies = YAML.parse(readFileSync(arg("--companies") ?? "seed/companies.yml", "utf8")) as SeedRow[];
  const unknown = unknownSources(bench, companies);
  if (unknown.length) console.log(`note: benchmark sources not in this companies file: ${unknown.join(", ")}\n`);

  let live: Map<string, BoardCount> | undefined;
  const countsFile = arg("--counts");
  if (countsFile) live = new Map(Object.entries(JSON.parse(readFileSync(countsFile, "utf8")) as Record<string, BoardCount>));
  else if (process.argv.includes("--live")) {
    const wanted = new Set(bench.flatMap((e) => enabledSources(e, companies)));
    const queue = companies.filter((c) => wanted.has(sourceKey(c)));
    live = new Map();
    const worker = async () => {
      for (let c = queue.shift(); c; c = queue.shift()) {
        const r = await countBoard(c);
        live!.set(sourceKey(c), r);
        console.error(`${sourceKey(c).padEnd(55)} ${"error" in r ? `ERROR ${r.error}` : `kept=${r.kept} uk=${r.uk}`}`);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    const out = arg("--json");
    if (out) writeFileSync(out, JSON.stringify(Object.fromEntries(live), null, 1));
  }

  const rows = employerCoverage(bench, companies, live);
  console.log("sector       employers  configured" + (live ? "  live(UK/EU)  live(UK)" : ""));
  for (const s of summarize(rows)) {
    const pct = (n: number) => `${n}`.padStart(3) + ` (${Math.round((100 * n) / s.total)}%)`.padEnd(7);
    console.log(`${s.sector.padEnd(12)} ${String(s.total).padStart(9)}  ${pct(s.configured)}` +
      (s.live !== undefined ? `  ${pct(s.live)}     ${pct(s.liveUk!)}` : ""));
  }
  if (process.argv.includes("--gaps")) {
    console.log("\nnot covered:");
    for (const r of rows.filter((x) => !x.configured)) console.log(`  [${r.employer.sector}] ${r.employer.name} (${r.employer.ats}): ${r.employer.why ?? ""}`);
    if (live) {
      console.log("\nconfigured, 0 live UK/EU early-career postings today:");
      for (const r of rows.filter((x) => x.configured && !x.kept)) console.log(`  [${r.employer.sector}] ${r.employer.name}${r.errors?.length ? ` ERRORS: ${r.errors.join("; ")}` : ""}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
