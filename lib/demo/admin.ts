/**
 * Demo user + demo database checks (Task 25 Step 4). Pure helpers plus a preflight that only READS (and calls
 * activate_cv with a nil id, which matches no row). No server-only import: scripts/create-demo-user.ts and
 * scripts/reset-demo.ts use it under tsx, and tests/demo covers it with a fake client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { DEMO_JOB_EXT_ID } from "./constants";

export const DEMO_FULL_NAME = "Ayşe Demir";
const MIN_PASSWORD = 12;

export type DemoCredentials = { email: string; password: string };

/** DEMO_EMAIL / DEMO_PASSWORD from the environment (.env.local), validated. Never logs the password. */
export function demoCredentials(env: Record<string, string | undefined>): DemoCredentials {
  const email = env.DEMO_EMAIL?.trim() ?? "";
  const password = env.DEMO_PASSWORD ?? "";
  const problems: string[] = [];
  if (!email) problems.push("DEMO_EMAIL is empty");
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) problems.push("DEMO_EMAIL is not an email address");
  if (!password) problems.push("DEMO_PASSWORD is empty");
  else if (password.length < MIN_PASSWORD) problems.push(`DEMO_PASSWORD must be at least ${MIN_PASSWORD} characters`);
  if (problems.length) {
    throw new Error(
      `${problems.join("; ")}. Set both in .env.local (e.g. DEMO_EMAIL=demo@placed.test, and a DEMO_PASSWORD ` +
      `generated with \`openssl rand -base64 18\`), then run the script again.`,
    );
  }
  return { email, password };
}

/** Supabase admin createUser error for an existing account. */
export const isAlreadyRegistered = (message: string) => /already (been )?registered|already exists/i.test(message);

export type ExistingUser = { id: string; email?: string; user_metadata?: Record<string, unknown> };

/**
 * Guard for the "already registered" path: only an account this script created (user_metadata.demo === true) counts as
 * the demo account. A mistyped DEMO_EMAIL that belongs to a real user is refused unless the operator passes --force.
 */
export function canOverwriteExistingUser(u: ExistingUser, force: boolean): { ok: true } | { ok: false; reason: string } {
  if (u.user_metadata?.demo === true || force) return { ok: true };
  return {
    ok: false,
    reason: `${u.email ?? "This account"} already exists and is not marked as the demo account (user_metadata.demo !== true). ` +
      "Refusing to mark it as the demo account: check DEMO_EMAIL. If it really is the demo account, re-run with --force.",
  };
}

export const hasForceFlag = (argv: string[]) => argv.slice(2).includes("--force");

/** Finds an auth user by email (case-insensitive), paging through the admin list. */
export async function findUserByEmail(db: SupabaseClient, email: string): Promise<ExistingUser | null> {
  const want = email.toLowerCase();
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listing auth users failed: ${error.message}`);
    const hit = data.users.find((u) => u.email?.toLowerCase() === want);
    if (hit) return { id: hit.id, email: hit.email, user_metadata: hit.user_metadata };
    if (data.users.length < 200) return null;
  }
  return null;
}

type PgError = { code?: string; message: string } | null;

/** Postgres/PostgREST "this thing doesn't exist" codes: missing table, column or function. */
export function isMissingObject(e: PgError): boolean {
  return !!e && ["42P01", "42703", "42883", "PGRST202", "PGRST204", "PGRST205"].includes(e.code ?? "");
}

/**
 * What the demo flow needs from the live database. Returns human-readable problems (empty = ready):
 * - migration 0007 (cv_scores cache columns, cv_feedback) — resetUserData deletes cv_feedback rows;
 * - migration 0009 (activate_cv) — the CV upload swaps the active CV with it;
 * - the demo job (seed/jobs.json) — the tailoring fixtures are keyed by its ext_id.
 */
export async function demoPreflight(db: SupabaseClient): Promise<string[]> {
  const out: string[] = [];
  const cols = await db.from("cv_scores").select("text_hash, model_id, prompt_version, rules_version").limit(1);
  if (isMissingObject(cols.error)) out.push("cv_scores cache columns are missing: run supabase/migrations/0007_cv_score_cache.sql");
  else if (cols.error) out.push(`couldn't read cv_scores: ${cols.error.message}`);
  const fb = await db.from("cv_feedback").select("id").limit(1);
  if (isMissingObject(fb.error)) out.push("table cv_feedback is missing: run supabase/migrations/0007_cv_score_cache.sql");
  else if (fb.error) out.push(`couldn't read cv_feedback: ${fb.error.message}`);
  const rpc = await db.rpc("activate_cv", { p_cv: "00000000-0000-0000-0000-000000000000" });
  if (isMissingObject(rpc.error)) out.push("function activate_cv is missing: run supabase/migrations/0009_active_cv.sql");
  const job = await db.from("jobs").select("id").eq("ext_id", DEMO_JOB_EXT_ID).limit(1);
  if (job.error) out.push(`couldn't read jobs: ${job.error.message}`);
  else if (!job.data?.length) out.push(`the demo job (ext_id ${DEMO_JOB_EXT_ID}, Lendable Credit Analyst Intern) is not in the jobs table: run npm run seed (or npm run ingest)`);
  return out;
}
