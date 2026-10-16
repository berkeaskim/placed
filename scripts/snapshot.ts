import { writeFileSync } from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../lib/db/client";
import { companies, jobs } from "../lib/db/schema";

/** Writes the live jobs to seed/jobs.json (what `npm run setup` seeds a fresh install with). */
function main() {
  const rows = db.select({ j: jobs, slug: companies.slug, ats: companies.ats }).from(jobs)
    .innerJoin(companies, eq(companies.id, jobs.company_id)).where(eq(jobs.is_live, true)).all();
  const snap = rows.map(({ j, slug, ats }) => {
    const { id: _id, first_seen: _f, company_id: _c, ...rest } = j;
    return { ...rest, company_slug: slug, company_ats: ats };
  });
  writeFileSync("seed/jobs.json", JSON.stringify(snap, null, 1));
  console.log(`snapshot: ${snap.length} jobs -> seed/jobs.json`);
}

main();
