import YAML from "yaml";
import type { RawJob } from "@/lib/types";
import { isValidDate } from "@/lib/scoring/dates";

export type ProgrammeKind = "spring-week" | "internship" | "graduate";

export type Programme = {
  employer: string;
  name: string;
  title: string;
  url: string;
  location: string;
  opens: string; // YYYY-MM
  closes?: string; // YYYY-MM-DD
  season: number;
  kind: ProgrammeKind;
  description: string;
};

const KINDS: readonly string[] = ["spring-week", "internship", "graduate"];
const OPENS_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const CLOSES_RE = /^\d{4}-\d{2}-\d{2}$/;

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);

function isHttpUrl(s: string): boolean {
  try {
    const p = new URL(s).protocol;
    return p === "http:" || p === "https:";
  } catch {
    return false;
  }
}

/** Returns a problem description, or the validated programme. */
function parseRow(raw: unknown): Programme | string {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return "row is not a mapping";
  const r = raw as Record<string, unknown>;
  for (const k of ["employer", "name", "title", "url", "location", "description"]) {
    if (!str(r[k])) return `missing or empty "${k}"`;
  }
  if (!isHttpUrl(str(r.url)!)) return `"url" is not an http(s) URL`;
  if (typeof r.opens !== "string" || !OPENS_RE.test(r.opens)) return `"opens" must be YYYY-MM`;
  if (r.closes !== undefined && r.closes !== null && (typeof r.closes !== "string" || !CLOSES_RE.test(r.closes) || !isValidDate(r.closes))) {
    return `"closes" must be a real YYYY-MM-DD date`;
  }
  if (!Number.isInteger(r.season)) return `"season" must be an integer`;
  if (typeof r.kind !== "string" || !KINDS.includes(r.kind)) return `"kind" must be one of ${KINDS.join(", ")}`;
  const p: Programme = {
    employer: str(r.employer)!,
    name: str(r.name)!,
    title: str(r.title)!,
    url: str(r.url)!,
    location: str(r.location)!,
    opens: r.opens,
    season: r.season as number,
    kind: r.kind as ProgrammeKind,
    description: str(r.description)!,
  };
  if (typeof r.closes === "string") p.closes = r.closes;
  return p;
}

/** Parse programmes.yml; invalid rows are dropped with a warning. */
export function loadProgrammes(yml: string, warn: (msg: string) => void = console.warn): Programme[] {
  let doc: unknown;
  try {
    doc = YAML.parse(yml);
  } catch (e) {
    warn(`programmes: YAML parse error: ${e instanceof Error ? e.message : String(e)}`);
    return [];
  }
  if (!Array.isArray(doc)) {
    warn("programmes: top level must be a list; ignoring file");
    return [];
  }
  const out: Programme[] = [];
  doc.forEach((raw, i) => {
    const p = parseRow(raw);
    if (typeof p === "string") warn(`programmes: skipping row ${i + 1}: ${p}`);
    else out.push(p);
  });
  return out;
}

/** today is YYYY-MM-DD (London day). Closes is inclusive; without closes the card hides from ${season}-06-01. */
export function visibleProgrammes(ps: Programme[], today: string): Programme[] {
  return ps.filter((p) => (p.closes ? today <= p.closes : today < `${p.season}-06-01`));
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const KIND_TYPE: Record<ProgrammeKind, NonNullable<RawJob["employmentType"]>> = {
  "spring-week": "spring_week", internship: "internship", graduate: "graduate",
};

export function programmeToRawJob(p: Programme): RawJob {
  return {
    extId: `${p.employer}:${p.season}:${p.kind}:${slugify(p.title)}`,
    title: p.title,
    url: p.url,
    location: p.location,
    remote: false,
    html: `<p>${escapeHtml(p.description)}</p>`,
    postedAt: null,
    deadline: p.closes ?? null,
    opensOn: `${p.opens}-01`,
    employmentType: KIND_TYPE[p.kind],
  };
}

export function curatedEmployers(ps: Programme[]): { slug: string; name: string }[] {
  const seen = new Map<string, string>();
  for (const p of ps) if (!seen.has(p.employer)) seen.set(p.employer, p.name);
  return [...seen].map(([slug, name]) => ({ slug, name }));
}
