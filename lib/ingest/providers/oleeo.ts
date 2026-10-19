import type { RawJob } from "@/lib/types";
import { defaultSleep } from "./http";

/**
 * Oleeo (`<tenant>.tal.net`) campus job boards: Nomura, Rothschild & Co, Jefferies, BlackRock campus, Morgan Stanley,
 * Bank of America campus, Evercore. Spring weeks and placements for several of them are only posted here
 * (research/spring-weeks/02-employer-ats.md §2, research/placement-year/02-employer-ats.md).
 *
 * No JSON API: the public board is server-rendered HTML. Every tenant marks a posting the same way
 * (`data-oppid`, `data-title`, `a.subject` link), in a table or in tiles; columns differ, so the list is read by
 * content (a date is the deadline) and the detail page's labelled fields fill in the rest. Seed slug: `tenant/list`.
 */

const SLUG = /^([a-z0-9-]+)\/(\d+)$/;
const PAGE_LIMIT = 20; // 50 postings a page: 1,000 is far beyond any campus board
const DETAIL_CONCURRENCY = 4;
const DELAY_MS = 400;

export function oleeoBoardUrl(slug: string, start = 0): string {
  const m = SLUG.exec(slug);
  if (!m) throw new Error(`oleeo slug must be "tenant/list" (e.g. nomuracampus/1), got "${slug}"`);
  return `https://${m[1]}.tal.net/vx/candidate/jobboard/vacancy/${m[2]}/adv/${start ? `?start=${start}` : ""}`;
}

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", rsquo: "’", lsquo: "‘", ndash: "–", mdash: "—" };
export function decode(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => ENTITIES[n.toLowerCase()] ?? m);
}
const stripBlocks = (html: string) => html.replace(/<(style|script)\b[\s\S]*?<\/\1>/gi, " ");
const text = (html: string) => decode(stripBlocks(html).replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
/** "10 Jan 2027" / "25 October 2026" → YYYY-MM-DD; anything else (or an impossible date) → null. */
export function parseUkDate(s: string): string | null {
  const m = /\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]{3,9})\.?\s+(20\d{2})\b/.exec(s);
  if (!m) return null;
  const mon = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
  if (mon < 0) return null;
  const d = new Date(Date.UTC(Number(m[3]), mon, Number(m[1])));
  if (d.getUTCDate() !== Number(m[1])) return null;
  return d.toISOString().slice(0, 10);
}

export type OleeoRow = { id: string; title: string; url: string; location: string; deadline: string | null };

/** Every posting on one board page, in either layout, de-duplicated by id. */
export function parseOleeoList(html: string): OleeoRow[] {
  const rows: OleeoRow[] = [];
  const seen = new Set<string>();
  const block = /<(tr|li)\b[^>]*data-oppid="(\d+)"[^>]*>([\s\S]*?)<\/\1>/g;
  for (const m of html.matchAll(block)) {
    const id = m[2];
    if (seen.has(id)) continue;
    const inner = m[0];
    const title = decode(/data-title="([^"]*)"/.exec(inner)?.[1] ?? "").replace(/\s+/g, " ").trim();
    const href = /<a[^>]*class="subject"[^>]*href="([^"]+)"/.exec(inner)?.[1];
    if (!title || !href) continue;
    seen.add(id);
    // Table cells after the title, or labelled tile fields ("Application Deadline: 25 Oct 2026").
    const cells = [...inner.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)].slice(1).map((c) => text(c[1]))
      .concat([...inner.matchAll(/candidate-opp-field-label">([^<]*)<\/span>([^<]*)/g)].map((c) => `${text(c[1])} ${text(c[2])}`));
    const dates = cells.map(parseUkDate).filter((d): d is string => d !== null);
    const place = cells.find((c) => c && !parseUkDate(c) && !/^(20\d{2}|ID:.*|\d+)$/.test(c) && !/:\s*$/.test(c));
    rows.push({ id, title, url: decode(href), location: place?.replace(/^[A-Za-z ]+:\s*/, "") ?? "", deadline: dates.at(-1) ?? null });
  }
  return rows;
}

/** The detail page's labelled fields (Location, Program type, …) and its description, as HTML for the tagger. */
export function parseOleeoDetail(html: string): { fields: Record<string, string>; html: string } {
  const fields: Record<string, string> = {};
  let description = "";
  const field = /<div\b[^>]*class="form-group[^"]*\btype_(\w+)[^"]*"[^>]*>([\s\S]*?)(?=<div\b[^>]*class="form-group|<\/form>|$)/g;
  for (const m of html.matchAll(field)) {
    const label = text(/hform_lbl_text"\s*>([\s\S]*?)<\/span>/.exec(m[2])?.[1] ?? "");
    const valueHtml = /class="form-control-static"[^>]*>([\s\S]*)/.exec(m[2])?.[1] ?? "";
    if (!label) continue;
    if (m[1] === "richtext") { description += stripBlocks(valueHtml).replace(/<\/div>\s*<\/div>\s*<\/div>\s*$/, ""); continue; }
    const value = text(valueHtml);
    if (value) fields[label] = value;
  }
  const meta = Object.entries(fields).map(([k, v]) => `<p>${k}: ${v}</p>`).join("");
  return { fields, html: meta + description };
}

async function getText(url: string, fetchImpl: typeof fetch): Promise<string> {
  const res = await fetchImpl(url, { headers: { "user-agent": "Mozilla/5.0 (Placed; local)", accept: "text/html" }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function mapLimit<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}

const LOCATION_FIELDS = ["Location", "City", "Office", "Office Location", "Region"];
const PROGRAMME_FIELDS = ["Program type", "Programme type", "Program Type", "Programme Type", "Opportunity type", "Program", "Programme"];

/** A closing date among the detail fields ("Application Deadline", "Closing Date"), when the list had none. */
function detailDeadline(fields: Record<string, string>): string | null {
  for (const [k, v] of Object.entries(fields)) if (/deadline|closing/i.test(k)) { const d = parseUkDate(v); if (d) return d; }
  return null;
}

/** All postings on a board; details only for titles `keepTitle` accepts (the same pre-filter as Workday). */
export async function fetchOleeo(
  slug: string, keepTitle: (t: string) => boolean, fetchImpl: typeof fetch = fetch, sleep: (ms: number) => Promise<void> = defaultSleep,
): Promise<RawJob[]> {
  const rows: OleeoRow[] = [];
  const seen = new Set<string>();
  for (let page = 0, start = 0; page < PAGE_LIMIT; page++) {
    const html = await getText(oleeoBoardUrl(slug, start), fetchImpl);
    const fresh = parseOleeoList(html).filter((r) => !seen.has(r.id));
    fresh.forEach((r) => seen.add(r.id));
    rows.push(...fresh);
    const next = /href="\?start=(\d+)"/.exec(html);
    if (!fresh.length || !next || Number(next[1]) <= start) break;
    start = Number(next[1]);
    await sleep(DELAY_MS);
  }
  // A board that lists nothing at all is a broken page (maintenance, layout change), not "no jobs": never close them.
  if (!rows.length) throw new Error(`oleeo/${slug}: no postings found on the board page`);
  const kept = rows.filter((r) => keepTitle(r.title));
  return mapLimit(kept, DETAIL_CONCURRENCY, async (r) => {
    const d = parseOleeoDetail(await getText(r.url, fetchImpl));
    const pick = (keys: string[]) => keys.map((k) => d.fields[k]).find(Boolean) ?? null;
    return {
      extId: r.id, title: r.title, url: r.url, location: pick(LOCATION_FIELDS) ?? r.location, remote: false,
      html: d.html, postedAt: null, deadline: r.deadline ?? detailDeadline(d.fields), programme: pick(PROGRAMME_FIELDS),
    } satisfies RawJob;
  });
}
