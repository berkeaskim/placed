import { readFileSync, writeFileSync } from "node:fs";
import YAML from "yaml";
import { fetchJobs, type CompanySeed } from "@/lib/ingest/providers";
import { passesTitleFilter } from "@/lib/ingest/filter";

const path = "seed/companies.yml";
const EU_GH = "boards-api.eu.greenhouse.io";
const EU_LEVER = "api.eu.lever.co";

function variants(c: CompanySeed): CompanySeed[] {
  const out: CompanySeed[] = [c];
  if (c.ats === "greenhouse") {
    // Try the other host: EU if default was given, default if EU was given.
    out.push(c.apiHost ? { ...c, apiHost: null } : { ...c, apiHost: EU_GH });
  } else if (c.ats === "lever") {
    if (!c.apiHost) out.push({ ...c, apiHost: EU_LEVER });
  } else {
    const lower = c.slug.toLowerCase();
    const cap = c.slug.charAt(0).toUpperCase() + c.slug.slice(1);
    for (const s of [lower, cap]) if (s !== c.slug) out.push({ ...c, slug: s });
  }
  return out;
}

async function tryFetch(c: CompanySeed) {
  let lastErr = "";
  for (const v of variants(c)) {
    try {
      return { ok: true as const, jobs: await fetchJobs(v), used: v };
    } catch (e) {
      if (!lastErr) lastErr = (e as Error).message;
    }
  }
  return { ok: false as const, error: lastErr };
}

async function main() {
  const doc = YAML.parseDocument(readFileSync(path, "utf8"));
  const items = (doc.contents as YAML.YAMLSeq).items as YAML.YAMLMap[];
  const report: string[] = [];
  let ok = 0;
  for (const item of items) {
    const c = item.toJSON() as CompanySeed;
    const r = await tryFetch(c);
    if (r.ok && r.jobs.length === 0) {
      item.set("enabled", false);
      item.comment = " EMPTY board (0 postings); slug unconfirmed or board unused";
      report.push(`FAIL ${c.ats.padEnd(10)} ${c.slug.padEnd(28)} empty board`);
    } else if (r.ok) {
      ok++;
      item.set("enabled", true);
      if (r.used.apiHost && r.used.apiHost !== c.apiHost) item.set("apiHost", r.used.apiHost);
      if (!r.used.apiHost && c.apiHost) item.delete("apiHost");
      if (r.used.slug !== c.slug) item.set("slug", r.used.slug);
      const early = r.jobs.filter((j) => passesTitleFilter(j.title)).length;
      report.push(`OK   ${c.ats.padEnd(10)} ${r.used.slug.padEnd(28)} host=${r.used.apiHost ?? "-"} jobs=${r.jobs.length} early=${early}`);
    } else {
      item.set("enabled", false);
      item.comment = ` DEAD: ${r.error}`;
      report.push(`FAIL ${c.ats.padEnd(10)} ${c.slug.padEnd(28)} ${r.error}`);
    }
    await new Promise((res) => setTimeout(res, 150));
  }
  writeFileSync(path, doc.toString({ lineWidth: 0 }).replace(/^/, `# validated ${new Date().toISOString()}\n`));
  console.log(report.join("\n"));
  console.log(`\nenabled ${ok}/${items.length}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
