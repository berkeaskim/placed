import { scriptClient } from "./db";
import { fetchJobs } from "@/lib/ingest/providers";
import { ingestCompany, type CompanyRow } from "@/lib/ingest/run";
import { supabaseStore } from "@/lib/ingest/store";
import { tagJob } from "@/lib/ai/tagJob";

async function main() {
  const db = scriptClient();
  const store = supabaseStore(db);
  // Optional filter: `npm run ingest -- workday` ingests only that ATS.
  const ats = process.argv[2];
  let query = db.from("companies").select("*").eq("enabled", true).order("id");
  if (ats) query = query.eq("ats", ats);
  const { data, error } = await query;
  if (error) throw error;
  const queue = [...((data ?? []) as CompanyRow[])];
  let total = 0;
  async function worker() {
    for (let c = queue.shift(); c; c = queue.shift()) {
      try {
        const r = await ingestCompany(c, { fetchJobs, tagJob, store });
        total += r.kept;
        console.log(`${c.slug.padEnd(28)} fetched=${r.fetched} kept=${r.kept} tagged=${r.tagged} failed=${r.failed} dead=${r.dead}`);
      } catch (e) {
        console.log(`${c.slug.padEnd(28)} ERROR ${(e as Error).message}`);
      }
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  console.log(`\nlive early-career jobs kept this run: ${total}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
