import { writeFileSync } from "node:fs";
import { scriptClient } from "./db";

async function main() {
  const db = scriptClient();
  const { data, error } = await db.from("jobs").select("*, companies!inner(slug, ats)").eq("is_live", true);
  if (error) throw error;
  const snap = (data ?? []).map((row) => {
    const { companies, ...j } = row as Record<string, unknown> & { companies: { slug: string; ats: string } };
    for (const k of ["id", "first_seen", "company_id"]) delete j[k];
    return { ...j, company_slug: companies.slug, company_ats: companies.ats };
  });
  writeFileSync("seed/jobs.json", JSON.stringify(snap, null, 1));
  console.log(`snapshot: ${snap.length} jobs -> seed/jobs.json`);
}

main().catch((e) => { console.error(e); process.exit(1); });
