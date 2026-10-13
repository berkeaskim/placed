import { readFileSync, existsSync } from "node:fs";
import YAML from "yaml";
import { scriptClient } from "./db";

async function main() {
  const db = scriptClient();
  const rows = (YAML.parse(readFileSync("seed/companies.yml", "utf8")) as { slug: string; name: string; ats: string; apiHost?: string; enabled?: boolean }[])
    .map((r) => ({ slug: r.slug, name: r.name, ats: r.ats, api_host: r.apiHost ?? null, enabled: r.enabled !== false }));
  const { error } = await db.from("companies").upsert(rows, { onConflict: "ats,slug" });
  if (error) throw error;
  console.log(`companies: ${rows.length}`);

  const { count } = await db.from("jobs").select("id", { count: "exact", head: true });
  if ((count ?? 0) === 0 && existsSync("seed/jobs.json")) {
    const snap = JSON.parse(readFileSync("seed/jobs.json", "utf8")) as ({ company_slug: string; company_ats: string } & Record<string, unknown>)[];
    const { data: comps } = await db.from("companies").select("id, slug, ats");
    const idOf = new Map((comps ?? []).map((c) => [`${c.ats}/${c.slug}`, c.id as number]));
    const jobs = snap
      .map(({ company_slug, company_ats, ...j }) => ({ ...j, company_id: idOf.get(`${company_ats}/${company_slug}`) }))
      .filter((j) => j.company_id);
    const { error: e2 } = await db.from("jobs").upsert(jobs, { onConflict: "company_id,ext_id" });
    if (e2) throw e2;
    console.log(`jobs from snapshot: ${jobs.length}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
