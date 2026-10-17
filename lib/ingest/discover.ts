import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { companies, profiles, type AtsKind } from "@/lib/db/schema";
import { getSetting, setSetting } from "@/lib/settings/store";
import { aiMode } from "@/lib/ai/config";
import { discoverCompanies as liveDiscover, type CompanySuggestion, type DiscoverInput } from "@/lib/ai/discoverCompanies";
import { ARCHETYPE_LABELS, type Archetype } from "@/lib/types";

/**
 * The AI company search: the AI suggests employers the student isn't watching yet, each suggestion is checked against
 * the live ATS board (a board must exist and have open postings), and the ones that pass become companies with
 * source "discovered", picked up by the next ingest run. The AI only proposes; nothing unverified is stored.
 */
export const DISCOVERY_EVERY_DAYS = 7;
const LAST_KEY = "discover.lastRun";
const DAY = 86_400_000;
const PROBE_TIMEOUT_MS = 8_000;

export type DiscoverySummary = { at: string; suggested: number; added: { name: string; ats: AtsKind }[] };
export type Board = { ats: AtsKind; slug: string; apiHost: string | null; postings: number };

export class DiscoveryUnavailableError extends Error {
  constructor() { super("Set up an AI provider first (Settings → AI)."); }
}

const norm = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/&/g, "and")
  .replace(/\b(ltd|limited|plc|llp|inc|group|holdings|uk)\b/g, "").replace(/[^a-z0-9]+/g, " ").trim();

/** Slugs to try for a company name: the AI's guess first, then "jane-street", "janestreet". */
export function candidateSlugs(name: string, guess: string | null): string[] {
  const words = norm(name).split(" ").filter(Boolean);
  const out = [guess?.trim(), words.join("-"), words.join("")].filter((s): s is string => !!s && /^[A-Za-z0-9._/-]+$/.test(s));
  return [...new Set(out)];
}

/** Greenhouse slugs can belong to a different company with the same word; its board name must match the suggestion. */
export function sameCompany(a: string, b: string): boolean {
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  return x === y || x.includes(y) || y.includes(x) || x.replace(/ /g, "") === y.replace(/ /g, "");
}

type Fetch = typeof fetch;

async function getJson(url: string, f: Fetch, init?: RequestInit): Promise<unknown> {
  const res = await f(url, { ...init, signal: AbortSignal.timeout(PROBE_TIMEOUT_MS), headers: { accept: "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) return null;
  return res.json().catch(() => null);
}

const len = (v: unknown) => (Array.isArray(v) ? v.length : 0);

/** One board lookup: open postings on (ats, slug), 0 when the board is missing, empty or someone else's. */
export async function probeBoard(name: string, ats: AtsKind, slug: string, apiHost: string | null, f: Fetch = fetch): Promise<Board | null> {
  try {
    if (ats === "greenhouse") {
      for (const host of ["boards-api.greenhouse.io", "boards-api.eu.greenhouse.io"]) {
        const board = (await getJson(`https://${host}/v1/boards/${slug}`, f)) as { name?: string } | null;
        if (!board?.name || !sameCompany(board.name, name)) continue;
        const n = len(((await getJson(`https://${host}/v1/boards/${slug}/jobs`, f)) as { jobs?: unknown } | null)?.jobs);
        if (n > 0) return { ats, slug, apiHost: host === "boards-api.greenhouse.io" ? null : host, postings: n };
      }
      return null;
    }
    if (ats === "lever") {
      for (const host of ["api.lever.co", "api.eu.lever.co"]) {
        const n = len(await getJson(`https://${host}/v0/postings/${slug}?mode=json`, f));
        if (n > 0) return { ats, slug, apiHost: host === "api.lever.co" ? null : host, postings: n };
      }
      return null;
    }
    if (ats === "ashby") {
      const n = len(((await getJson(`https://api.ashbyhq.com/posting-api/job-board/${slug}`, f)) as { jobs?: unknown } | null)?.jobs);
      return n > 0 ? { ats, slug, apiHost: null, postings: n } : null;
    }
    if (ats === "smartrecruiters") {
      // Any slug answers 200 here; only a board with postings counts.
      const r = (await getJson(`https://api.smartrecruiters.com/v1/companies/${slug}/postings?limit=1`, f)) as { totalFound?: number } | null;
      const n = r?.totalFound ?? 0;
      return n > 0 ? { ats, slug, apiHost: null, postings: n } : null;
    }
    // workday: slug "<tenant>/<site>" on "<tenant>.wdN.myworkdayjobs.com"
    if (!apiHost || !/^[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com$/i.test(apiHost) || !/^[\w-]+\/[\w-]+$/.test(slug)) return null;
    const [tenant, site] = slug.split("/");
    const r = (await getJson(`https://${apiHost}/wday/cxs/${tenant}/${site}/jobs`, f, {
      method: "POST", body: JSON.stringify({ limit: 1, offset: 0, searchText: "", appliedFacets: {} }), headers: { "content-type": "application/json" },
    })) as { total?: number } | null;
    const n = r?.total ?? 0;
    return n > 0 ? { ats, slug, apiHost, postings: n } : null;
  } catch {
    return null;
  }
}

const OPEN_ATS: AtsKind[] = ["greenhouse", "lever", "ashby", "smartrecruiters"];

/** Finds a suggestion's board: the AI's ATS and slug first, then every keyless ATS with slugs made from the name. */
export async function resolveBoard(s: CompanySuggestion, f: Fetch = fetch): Promise<Board | null> {
  if (s.ats === "workday") return s.slug ? probeBoard(s.name, "workday", s.slug, s.workday_host, f) : null;
  const slugs = candidateSlugs(s.name, s.slug);
  const order = s.ats !== "unknown" ? [s.ats, ...OPEN_ATS.filter((a) => a !== s.ats)] : OPEN_ATS;
  for (const ats of order) {
    for (const slug of slugs) {
      if (slug.includes("/")) continue;
      const b = await probeBoard(s.name, ats, slug, null, f);
      if (b) return b;
    }
  }
  return null;
}

function discoverInput(): DiscoverInput {
  const p = db.select().from(profiles).orderBy(desc(profiles.created_at)).limit(1).get();
  const target = p?.target_archetype as Archetype | null | undefined;
  const top = (p?.archetypes ?? []).slice().sort((a, b) => b.score - a.score).slice(0, 3).map((a) => a.key as Archetype);
  const areas = [...new Set([target, ...top].filter((a): a is Archetype => !!a))].map((a) => ARCHETYPE_LABELS[a]);
  if (p?.field) areas.push(`studies ${p.field}`);
  const known = db.select({ name: companies.name }).from(companies).all().map((c) => c.name);
  return { areas, regions: p?.location_pref ?? [], year: p?.year ?? null, known };
}

export function lastDiscovery(): DiscoverySummary | null {
  try {
    const raw = getSetting(LAST_KEY);
    return raw ? (JSON.parse(raw) as DiscoverySummary) : null;
  } catch {
    return null;
  }
}

export function discoveryDue(now = Date.now()): boolean {
  if (aiMode() !== "live") return false;
  const last = lastDiscovery();
  return !last || now - Date.parse(last.at) >= DISCOVERY_EVERY_DAYS * DAY;
}

export type RunDiscoveryOptions = { discover?: (i: DiscoverInput) => Promise<CompanySuggestion[]>; fetch?: Fetch; concurrency?: number };

/** Ask, verify, store. Throws DiscoveryUnavailableError without a live AI provider. */
export async function runDiscovery(o: RunDiscoveryOptions = {}): Promise<DiscoverySummary> {
  if (!o.discover && aiMode() !== "live") throw new DiscoveryUnavailableError();
  const input = discoverInput();
  const known = new Set(input.known.map(norm));
  const suggestions = (await (o.discover ?? liveDiscover)(input)).filter((s) => s.name.trim() && !known.has(norm(s.name)));
  const queue = [...new Map(suggestions.map((s) => [norm(s.name), s])).values()];
  const added: DiscoverySummary["added"] = [];
  const at = new Date().toISOString();
  const worker = async () => {
    for (let s = queue.shift(); s; s = queue.shift()) {
      const b = await resolveBoard(s, o.fetch ?? fetch);
      if (!b) continue;
      const exists = db.select({ id: companies.id }).from(companies).where(and(eq(companies.ats, b.ats), eq(companies.slug, b.slug))).get();
      if (exists) continue;
      db.insert(companies).values({ slug: b.slug, name: s.name.trim(), ats: b.ats, api_host: b.apiHost, enabled: true, source: "discovered", added_at: at }).run();
      added.push({ name: s.name.trim(), ats: b.ats });
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, o.concurrency ?? 4) }, worker));
  const summary: DiscoverySummary = { at, suggested: suggestions.length, added };
  setSetting(LAST_KEY, JSON.stringify(summary));
  return summary;
}

/** Companies the AI search added, newest first, for Settings → Job search. */
export function discoveredCompanies() {
  return db.select({ id: companies.id, name: companies.name, ats: companies.ats, enabled: companies.enabled, added_at: companies.added_at })
    .from(companies).where(eq(companies.source, "discovered")).orderBy(desc(companies.added_at), desc(companies.id)).all();
}

/** Stop watching a discovered company. The row stays (disabled) so the search never suggests it again. */
export function dropDiscovered(id: number): boolean {
  return db.update(companies).set({ enabled: false }).where(and(eq(companies.id, id), eq(companies.source, "discovered"))).run().changes > 0;
}

/** Before a scheduled run: the weekly company search, when due. Never throws (a failed search must not stop the ingest). */
export async function discoverIfDue(log: (line: string) => void = console.log): Promise<void> {
  if (!discoveryDue()) return;
  try {
    const s = await runDiscovery();
    log(`[discover] ${s.added.length} new companies from ${s.suggested} suggestions${s.added.length ? `: ${s.added.map((a) => a.name).join(", ")}` : ""}`);
  } catch (e) {
    console.error("[discover] failed", e instanceof Error ? e.message : e);
  }
}
