import { readFileSync, existsSync } from "node:fs";
import YAML from "yaml";
import { scriptClient } from "./db";

async function main() {
  const db = scriptClient();
  const rows = (YAML.parse(readFileSync("seed/companies.yml", "utf8")) as { slug: string; name: string; ats: string; apiHost?: string; enabled?: boolean }[])
    .map((r) => ({ slug: r.slug, name: r.name, ats: r.ats, api_host: r.apiHost ?? null, enabled: r.enabled !== false }));
  // Upsert per ATS: a new ATS whose check-constraint migration isn't applied yet (e.g. 0010 smartrecruiters)
  // fails on its own instead of blocking every other company.
  let seeded = 0;
  for (const ats of [...new Set(rows.map((r) => r.ats))]) {
    const group = rows.filter((r) => r.ats === ats);
    const { error } = await db.from("companies").upsert(group, { onConflict: "ats,slug" });
    if (!error) { seeded += group.length; continue; }
    // 23514 = check_violation: companies_ats_check doesn't allow this ATS yet. Anything else is a real failure.
    if (error.code !== "23514") throw error;
    console.error(`companies/${ats}: skipped ${group.length}; apply the migration that allows this ATS (e.g. 0010_smartrecruiters)`);
    process.exitCode = 1;
  }
  console.log(`companies: ${seeded}/${rows.length}`);

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
