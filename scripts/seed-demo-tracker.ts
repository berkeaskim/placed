// scripts/seed-demo-tracker.ts
/**
 * Puts the demo persona's tracker in the state the demo inbox expects (lib/gmail/fixtures.ts):
 * Lendable saved, Monzo/IMC/Palantir applied, Jump Trading interview. Celonis stays out (the "add it?" case).
 * Clears the demo user's inbox_events so Sync replays all 8 emails. Only with Berke's OK:
 *   PLACED_ALLOW_LIVE_DEMO_WRITE=1 npm run demo:tracker
 */
import { createClient } from "@supabase/supabase-js";
import { DEMO_JOB_EXT_ID } from "@/lib/demo/constants";
import { assertLiveDemoWriteAllowed } from "@/lib/demo/guard";

const PLAN: { slug: string; status: "saved" | "applied" | "interview" }[] = [
  { slug: "monzo", status: "applied" }, { slug: "imc", status: "applied" }, { slug: "palantir", status: "applied" }, { slug: "jumptrading", status: "interview" },
];

async function main() {
  assertLiveDemoWriteAllowed(process.env, "demo:tracker");
  const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const email = process.env.DEMO_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error("DEMO_EMAIL is not set");
  const { data: users, error } = await db.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const user = users.users.find((u) => u.email?.toLowerCase() === email);
  if (!user) throw new Error(`No user ${email}: run npm run demo:user first`);

  const rows: { job_id: string; status: string; label: string }[] = [];
  const { data: lend } = await db.from("jobs").select("id, title").eq("ext_id", DEMO_JOB_EXT_ID).single();
  if (!lend) throw new Error("Demo Lendable job missing: run npm run seed");
  rows.push({ job_id: lend.id, status: "saved", label: `Lendable: ${lend.title}` });
  for (const p of PLAN) {
    const { data: job } = await db.from("jobs").select("id, title, companies!inner(slug, name)").eq("companies.slug", p.slug)
      .eq("is_live", true).order("posted_at", { ascending: false }).limit(1).maybeSingle();
    if (!job) { console.warn(`skip ${p.slug}: no live job`); continue; }
    rows.push({ job_id: job.id, status: p.status, label: `${(job.companies as unknown as { name: string }).name}: ${job.title}` });
  }
  // Wipe the demo user's whole tracker (not just the plan's rows) so a rehearsal's "add it" doesn't leave Celonis behind.
  for (const table of ["inbox_events", "outreach", "applications"] as const) {
    const { error: delErr } = await db.from(table).delete().eq("user_id", user.id);
    if (delErr) throw new Error(`clearing ${table}: ${delErr.message}`);
  }
  for (const r of rows) {
    const { error: e } = await db.from("applications").insert({ user_id: user.id, job_id: r.job_id, status: r.status });
    if (e) throw e;
    console.log(`${r.status.padEnd(9)} ${r.label}`);
  }
}

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
