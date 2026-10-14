/**
 * Static RLS / privilege audit of supabase/migrations/*.sql. Reads files only — never connects to a database.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

const DIR = path.resolve(__dirname, "../../../supabase/migrations");
const files = readdirSync(DIR).filter((f) => f.endsWith(".sql")).sort();
const raw = files.map((f) => readFileSync(path.join(DIR, f), "utf8")).join("\n");
const sql = raw.replace(/--[^\n]*/g, "");

type Table = { name: string; columns: string[] };
type Policy = { name: string; table: string; op: string; roles: string[]; using: string; check: string };
type Fn = { name: string; header: string; body: string };

const norm = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

function parseTables(): Table[] {
  const out: Table[] = [];
  for (const m of sql.matchAll(/create table (?:if not exists )?public\.(\w+)\s*\(([\s\S]*?)\n\);/gi)) {
    const columns = m[2].split("\n").map((l) => l.trim()).filter((l) => /^[a-z_]+\s/.test(l) && !/^(unique|primary|check|constraint|foreign)\b/i.test(l)).map((l) => l.split(/\s+/)[0]);
    out.push({ name: m[1], columns });
  }
  return out;
}

function parsePolicyStmt(stmt: string): Policy | null {
  const m = /create policy "([^"]+)" on public\.(\w+)\s+(?:as \w+\s+)?(?:for (\w+)\s+)?(?:to ([\w\s,]+?)\s+)?(?:using \(([\s\S]*?)\))?\s*(?:with check \(([\s\S]*?)\))?\s*$/i.exec(norm(stmt));
  if (!m) return null;
  return { name: m[1], table: m[2], op: (m[3] ?? "all").toLowerCase(), roles: (m[4] ?? "public").split(",").map((r) => r.trim()), using: m[5] ?? "", check: m[6] ?? "" };
}

function parsePolicies(): Policy[] {
  // Statements are replayed in file order, so the idempotent `drop policy if exists X; create policy X` idiom works.
  const events: { pos: number; drop?: string; create?: Policy }[] = [];
  // direct statements
  for (const m of sql.matchAll(/^\s*(create policy[\s\S]*?);/gim)) {
    const p = parsePolicyStmt(m[1]);
    if (p) events.push({ pos: m.index!, create: p });
  }
  // DO-block loops: foreach t in array array['a','b'] loop execute format('create policy ... %I ...', t); end loop;
  for (const m of sql.matchAll(/foreach (\w+) in array array\[([^\]]*)\] loop([\s\S]*?)end loop;/gi)) {
    const tables = [...m[2].matchAll(/'(\w+)'/g)].map((x) => x[1]);
    for (const f of m[3].matchAll(/execute format\('((?:[^']|'')*)'\s*,\s*\w+\)/gi)) {
      const tmpl = f[1].replace(/''/g, "'");
      for (const t of tables) {
        const p = parsePolicyStmt(tmpl.replace(/%I/g, t));
        if (p) events.push({ pos: m.index!, create: p });
      }
    }
  }
  // later statements drop some of them
  for (const m of sql.matchAll(/drop policy (?:if exists )?"([^"]+)" on public\.(\w+)/gi)) events.push({ pos: m.index!, drop: `${m[2]}.${m[1]}` });
  const live = new Map<string, Policy>();
  for (const e of events.sort((a, b) => a.pos - b.pos)) {
    if (e.drop) live.delete(e.drop);
    else if (e.create) live.set(`${e.create.table}.${e.create.name}`, e.create);
  }
  return [...live.values()];
}

function parseFunctions(): Fn[] {
  const dropped = new Set([...sql.matchAll(/drop function (?:if exists )?([\w.]+)/gi)].map((m) => m[1]));
  return [...sql.matchAll(/create (?:or replace )?function ([\w.]+)\s*\(([^)]*)\)([\s\S]*?)\$\$([\s\S]*?)\$\$/gi)]
    .map((m) => ({ name: m[1], header: norm(m[3]), body: norm(m[4]) }))
    .filter((f) => !dropped.has(f.name));
}

const tables = parseTables();
const policies = parsePolicies();
const functions = parseFunctions();
const rlsEnabled = new Set([...sql.matchAll(/alter table (?:only )?public\.(\w+) enable row level security/gi)].map((m) => m[1]));
const userOwned = tables.filter((t) => t.columns.includes("user_id")).map((t) => t.name);
const PUBLIC_READ = new Set(["companies", "jobs"]);
const OWNS = /auth\.uid\(\)\s*=\s*user_id|user_id\s*=\s*auth\.uid\(\)|\(select auth\.uid\(\)\)\s*=\s*user_id/;

describe("migration parser sanity", () => {
  it("finds the expected tables, policies and functions", () => {
    expect(files.length).toBeGreaterThanOrEqual(2);
    expect(tables.map((t) => t.name).sort()).toEqual(
      ["applications", "badges", "companies", "confirmed_facts", "cv_feedback", "cv_scores", "cvs", "gmail_connections", "inbox_events", "ingest_state", "jobs", "linkedin_scores", "matches", "outreach", "playbook_progress", "profiles", "xp_events"]);
    expect(userOwned.sort()).toEqual(["applications", "badges", "confirmed_facts", "cv_feedback", "cv_scores", "cvs", "gmail_connections", "inbox_events", "linkedin_scores", "matches", "outreach", "playbook_progress", "profiles", "xp_events"]);
    // 9 user-owned tables × 4 ops + 2 public reads, minus profiles.own_insert and xp_events/badges writes (0003),
    // plus cv_feedback select/insert (0007), linkedin_scores select/insert/delete (0013, rescoring inserts a row),
    // gmail_connections no policies (0013), inbox_events select only (0013), outreach select/insert/update (0013)
    expect(policies.length).toBe(9 * 4 + 2 - 7 + 2 + 3 + 0 + 1 + 3);
    expect(functions.map((f) => f.name).sort()).toEqual(["public.activate_cv", "public.award_xp", "public.handle_new_user"]);
  });
});

describe("RLS coverage", () => {
  it("every public table has row level security enabled", () => {
    const missing = tables.map((t) => t.name).filter((t) => !rlsEnabled.has(t));
    expect(missing).toEqual([]);
  });
  it("RLS is never disabled or bypassed later", () => {
    expect(sql).not.toMatch(/disable row level security/i);
    expect(sql).not.toMatch(/no force row level security/i);
    expect(sql).not.toMatch(/bypassrls/i);
  });
  // Gamify tables are written by the service role only; profiles rows come from the signup trigger.
  // inbox_events/outreach/gmail_connections added in 0013: gmail_connections is service-role-only (no policies),
  // inbox_events allows authenticated select only (service role writes), outreach allows authenticated select/insert/update.
  const OPS: Record<string, string[]> = { xp_events: ["select"], badges: ["select"], profiles: ["select", "update", "delete"], cv_feedback: ["select", "insert"], linkedin_scores: ["select", "insert", "delete"], gmail_connections: [], inbox_events: ["select"], outreach: ["select", "insert", "update"] };
  it("user-owned tables have exactly the expected policies, each restricted to auth.uid() = user_id", () => {
    for (const t of userOwned) {
      const expected = OPS[t] ?? ["select", "insert", "update", "delete"];
      const actual = [...new Set(policies.filter((p) => p.table === t).map((p) => p.op))].sort();
      expect(actual, t).toEqual([...expected].sort());
      for (const op of expected) {
        const ps = policies.filter((p) => p.table === t && (p.op === op || p.op === "all"));
        expect(ps.length, `${t}.${op}`).toBeGreaterThan(0);
        for (const p of ps) {
          expect(p.roles, `${t}.${op} roles`).toEqual(["authenticated"]);
          if (op !== "insert") expect(p.using, `${t}.${op} using`).toMatch(OWNS);
          if (op === "insert" || op === "update") expect(p.check, `${t}.${op} with check`).toMatch(OWNS);
        }
      }
    }
  });
  it("no user-owned table has a permissive using(true) policy", () => {
    const bad = policies.filter((p) => userOwned.includes(p.table) && (/^true$/.test(p.using.trim()) || /^true$/.test(p.check.trim())));
    expect(bad).toEqual([]);
  });
  it("only companies/jobs are readable by anon, and only via SELECT", () => {
    const anon = policies.filter((p) => p.roles.includes("anon") || p.roles.includes("public"));
    expect(anon.every((p) => p.op === "select" && PUBLIC_READ.has(p.table))).toBe(true);
    expect(anon.map((p) => p.table).sort()).toEqual(["companies", "jobs"]);
  });
  it("no client role can write companies, jobs or ingest_state (service role only)", () => {
    const writes = policies.filter((p) => ["companies", "jobs", "ingest_state"].includes(p.table) && p.op !== "select");
    expect(writes).toEqual([]);
    expect(policies.filter((p) => p.table === "ingest_state")).toEqual([]);
  });
});

describe("privileges and functions", () => {
  it("no explicit grants to anon or public", () => {
    const grants = [...sql.matchAll(/grant ([\s\S]*?) to ([^;]+);/gi)].map((m) => ({ what: norm(m[1]), to: norm(m[2]) }));
    expect(grants.filter((g) => /\b(anon|public)\b/.test(g.to))).toEqual([]);
  });
  it("every SECURITY DEFINER function pins search_path", () => {
    const definers = functions.filter((f) => /security definer/.test(f.header));
    expect(definers.map((f) => f.name)).toEqual(["public.handle_new_user"]);
    for (const f of definers) expect(f.header, f.name).toMatch(/set search_path\s*=\s*('|")?(''|pg_catalog|public|""|)/);
  });
  it("every function pins search_path and fully qualifies table names", () => {
    for (const f of functions) {
      expect(f.header, f.name).toMatch(/set search_path/);
      for (const m of f.body.matchAll(/\b(?:from|into|update|join)\s+([\w.]+)/g)) expect(m[1], `${f.name} → ${m[1]}`).toMatch(/^(public|auth|storage)\./);
    }
  });
  it("award_xp runs as invoker and is executable by the service role only", () => {
    const f = functions.find((x) => x.name === "public.award_xp")!;
    expect(f.header).toMatch(/security invoker/);
    const n = norm(sql);
    expect(n).toMatch(/revoke execute on function public\.award_xp\(uuid, int\) from public, anon, authenticated/);
    expect(n).toMatch(/grant execute on function public\.award_xp\(uuid, int\) to service_role/);
    expect(n).not.toMatch(/grant execute on function public\.award_xp[^;]*to (anon|authenticated|public)/);
  });
  it("activate_cv swaps the caller's own CVs only, serialised, behind a one-active-CV unique index", () => {
    const f = functions.find((x) => x.name === "public.activate_cv")!;
    expect(f.header).toMatch(/security invoker/);
    expect(f.body).toMatch(/pg_advisory_xact_lock/);
    for (const m of f.body.matchAll(/update public\.cvs [^;]*;/g)) expect(m[0]).toMatch(/user_id = auth\.uid\(\)/);
    expect(norm(sql)).toMatch(/create unique index if not exists cvs_one_active_per_user on public\.cvs \(user_id\) where is_active/);
  });
  it("storage buckets are private", () => {
    const m = /insert into storage\.buckets[^;]*values([^;]*);/i.exec(sql)!;
    const rows = [...m[1].matchAll(/\(([^)]*)\)/g)].map((r) => r[1].split(",").map((x) => x.trim()));
    expect(rows.length).toBeGreaterThan(0);
    for (const r of rows) expect(r[2], r[0]).toBe("false");
    expect(sql).not.toMatch(/create policy[^;]*on storage\.objects[^;]*to (anon|public)/i);
  });
  it("gamify idempotency indexes exist for per-job and once-per-user events", () => {
    expect(norm(sql)).toMatch(/create unique index if not exists xp_events_once_per_job on public\.xp_events \(user_id, type, job_id\) where job_id is not null/);
    expect(norm(sql)).toMatch(/xp_events_once_per_user on public\.xp_events \(user_id, type\) where type in \('onboarding_complete','cv_uploaded','quiz_done'\)/);
  });
});

describe("security findings", () => {
  // Fixed in 0003_gamify_server_only.sql.
  it("xp/level/streak columns are not client-writable", () => {
    const n = norm(sql);
    expect(n).toMatch(/revoke insert, update on public\.profiles from anon, authenticated/);
    const grant = /grant update \(([^)]*)\) on public\.profiles to authenticated/.exec(n);
    expect(grant).not.toBeNull();
    const cols = grant![1].split(",").map((c) => c.trim());
    for (const c of ["xp", "level", "streak_days", "last_active_date", "user_id"]) expect(cols).not.toContain(c);
  });
  it("xp_events and badges are server-authoritative (no client insert/update/delete)", () => {
    const writes = policies.filter((p) => ["xp_events", "badges"].includes(p.table) && p.op !== "select");
    expect(writes.map((p) => `${p.table}.${p.op}`)).toEqual([]);
    expect(norm(sql)).toMatch(/revoke insert, update, delete on public\.xp_events, public\.badges from anon, authenticated/);
  });
  it("increment_xp (client-callable, unbounded delta) no longer exists", () => {
    expect(functions.find((x) => x.name === "public.increment_xp")).toBeUndefined();
  });
  // Fixed in 0008_rls_tightening.sql: cv_scores insert/update also require the referenced CV to be the caller's.
  it("cv_scores insert/update verifies the referenced CV belongs to the caller", () => {
    for (const op of ["insert", "update"]) {
      const ps = policies.filter((x) => x.table === "cv_scores" && x.op === op);
      expect(ps.length, op).toBe(1);
      expect(ps[0].check, op).toMatch(/exists\s*\(\s*select[\s\S]*public\.cvs[\s\S]*user_id = auth\.uid\(\)/);
    }
  });
  // BUG (security, latent IDOR): cvs.storage_path and applications.tailored_cv_path are client-updatable via
  // own_update. Any future server code that signs/downloads these paths with the service-role client would serve
  // another user's file. Paths should be immutable to clients (column REVOKE) or always re-derived from user_id.
  // Fixed in 0008_rls_tightening.sql: table-level UPDATE revoked, column UPDATE re-granted without the path columns,
  // and INSERT policies pin paths under the caller's own prefix.
  it("cv_feedback insert verifies the referenced CV (if any) belongs to the caller", () => {
    const ps = policies.filter((x) => x.table === "cv_feedback" && x.op === "insert");
    expect(ps.length).toBe(1);
    expect(ps[0].check).toMatch(/cv_id is null or exists\s*\(\s*select[\s\S]*public\.cvs[\s\S]*user_id = auth\.uid\(\)/);
  });
  it("storage path columns are not client-updatable", () => {
    const n = norm(sql);
    expect(/revoke update[^;]*storage_path[^;]*on (table )?public\.cvs/.test(n)).toBe(true);
    expect(/revoke update[^;]*tailored_cv_path[^;]*on (table )?public\.applications/.test(n)).toBe(true);
    const cols = (t: string) => {
      expect(n).toMatch(new RegExp(`revoke update on public\\.${t} from anon, authenticated`));
      const g = new RegExp(`grant update \\(([^)]*)\\) on public\\.${t} to authenticated`).exec(n);
      expect(g, t).not.toBeNull();
      return g![1].split(",").map((c) => c.trim());
    };
    const cvCols = cols("cvs");
    expect(cvCols).not.toContain("storage_path");
    expect(cvCols).toContain("is_active"); // activate_cv() is SECURITY INVOKER
    const appCols = cols("applications");
    expect(appCols).not.toContain("tailored_cv_path");
    expect(appCols).toContain("status");
    for (const t of ["cvs", "applications"]) {
      const ins = policies.filter((p) => p.table === t && p.op === "insert");
      expect(ins.length, t).toBe(1);
      expect(ins[0].check, t).toMatch(/like \(auth\.uid\(\)::text \|\| '\/%'\)/);
    }
  });
});
