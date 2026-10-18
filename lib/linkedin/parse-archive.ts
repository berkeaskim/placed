import { unzipSync } from "fflate";
import type { LiEducation, LiExperience, LiProject, ParsedLinkedIn } from "./parse-export";
import { renderPublicText, type PublicProfile } from "./parse-public";

/**
 * Parser for LinkedIn's own "Download your data" archive (Settings → Data privacy → Get a copy of your data;
 * LinkedIn Help a1339364, accessed 2026-10-18). This is the sanctioned input (08 #11): first-party, no scraping, the
 * full skills list, and it works for non-English profiles.
 *
 * LinkedIn doesn't document the CSV columns. The names below are community-documented (TomeVault, grade C) and
 * LinkedIn has renamed files between export versions, so headers are matched case-insensitively with aliases and
 * any missing file just leaves its fields empty. Confirm against a real archive before relying on a new column.
 *
 * Only the profile CSVs are decompressed; messages, connections and everything else in the zip are never read.
 */

export class NotLinkedInArchiveError extends Error {}

const MAX_ENTRY_BYTES = 5 * 1024 * 1024;
const FILES = ["Profile.csv", "Positions.csv", "Education.csv", "Skills.csv", "Projects.csv", "Certifications.csv", "Honors.csv", "Languages.csv", "Publications.csv"] as const;
type FileName = (typeof FILES)[number];

/** RFC 4180-ish CSV: quoted fields may hold commas, newlines and doubled quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(field); field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

/** Rows as objects keyed by lower-cased header. Skips any preamble ("Notes: …") before the first header row holding a known column. */
function records(text: string | undefined, known: string[]): Record<string, string>[] {
  if (!text) return [];
  const rows = parseCsv(text);
  const h = rows.findIndex((r) => r.some((c) => known.includes(c.trim().toLowerCase())));
  if (h < 0) return [];
  const header = rows[h].map((c) => c.trim().toLowerCase());
  return rows.slice(h + 1).map((r) => Object.fromEntries(header.map((k, i) => [k, (r[i] ?? "").trim()])));
}
const pick = (rec: Record<string, string>, ...keys: string[]) => keys.map((k) => rec[k]).find((v) => v) ?? "";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
type Ym = { year: number; month: number | null };
/** "Jun 2023", "June 2023", "06/2023", "2023-06", "2023" → Ym. */
export function archiveDate(s: string): Ym | null {
  const t = s.trim();
  if (!t) return null;
  const y = t.match(/(19|20)\d{2}/);
  if (!y) return null;
  const name = t.match(/\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i);
  const num = t.match(/^(0?[1-9]|1[0-2])\/(19|20)\d{2}$/) ?? t.match(/^(?:19|20)\d{2}-(0?[1-9]|1[0-2])\b/);
  const month = name ? MONTHS.findIndex((m) => m.toLowerCase() === name[1].toLowerCase()) + 1 : num ? Number(num[1]) : null;
  return { year: Number(y[0]), month };
}
const fmt = (p: Ym) => (p.month ? `${MONTHS[p.month - 1]} ${p.year}` : String(p.year));

const URL_IN_TEXT = /https?:\/\/[^\s,\]]+/gi;

/** Zip bytes → ParsedLinkedIn + the plain-text rendering the judge quotes from. Throws NotLinkedInArchiveError. */
export function parseLinkedInArchive(bytes: Uint8Array): PublicProfile {
  let files: Record<string, Uint8Array>;
  try {
    const wanted = new Set<string>(FILES.map((f) => f.toLowerCase()));
    files = unzipSync(bytes, { filter: (f) => wanted.has(f.name.split("/").pop()!.toLowerCase()) && f.originalSize <= MAX_ENTRY_BYTES });
  } catch {
    throw new NotLinkedInArchiveError("not a zip");
  }
  const byName = new Map<string, string>();
  for (const [path, data] of Object.entries(files)) byName.set(path.split("/").pop()!.toLowerCase(), new TextDecoder().decode(data));
  const file = (f: FileName) => byName.get(f.toLowerCase());
  if (!file("Profile.csv") && !file("Positions.csv")) throw new NotLinkedInArchiveError("no Profile.csv or Positions.csv");
  return parseArchiveFiles((f) => file(f));
}

/** The CSV half, split out so tests can feed CSV text without building a zip. */
export function parseArchiveFiles(file: (f: FileName) => string | undefined): PublicProfile {
  const profile = records(file("Profile.csv"), ["first name", "headline", "summary"])[0] ?? {};
  const name = [pick(profile, "first name"), pick(profile, "last name")].filter(Boolean).join(" ") || null;
  const headline = pick(profile, "headline") || null;
  const about = pick(profile, "summary") || null;
  const location = pick(profile, "geo location", "location") || null;
  const links = [...new Set((pick(profile, "websites").match(URL_IN_TEXT) ?? []).filter((u) => !/linkedin\.com/i.test(u)))];

  const experience: LiExperience[] = records(file("Positions.csv"), ["company name", "title"]).map((r) => {
    const start = archiveDate(pick(r, "started on", "start date"));
    const endRaw = pick(r, "finished on", "end date");
    const end = endRaw ? archiveDate(endRaw) : null;
    return {
      company: pick(r, "company name", "company"), title: pick(r, "title"),
      dates: start ? `${fmt(start)} - ${end ? fmt(end) : "Present"}` : "",
      start, end, location: pick(r, "location") || null, description: pick(r, "description"),
    };
  });

  const education: LiEducation[] = records(file("Education.csv"), ["school name", "degree name"]).map((r) => {
    const s = archiveDate(pick(r, "start date", "started on"));
    const e = archiveDate(pick(r, "end date", "finished on"));
    return {
      school: pick(r, "school name", "school"), degree: pick(r, "degree name", "degree") || null,
      startYear: s?.year ?? null, endYear: e?.year ?? null,
      details: [pick(r, "notes"), pick(r, "activities")].filter(Boolean).join("\n"),
    };
  });

  const projects: LiProject[] = records(file("Projects.csv"), ["title", "description"]).map((r) => {
    const start = archiveDate(pick(r, "started on", "start date"));
    const endRaw = pick(r, "finished on", "end date");
    const end = endRaw ? archiveDate(endRaw) : null;
    const url = pick(r, "url");
    return {
      title: pick(r, "title"), dates: start ? `${fmt(start)} - ${end ? fmt(end) : "Present"}` : "", start, end,
      description: [pick(r, "description"), url].filter(Boolean).join("\n"),
    };
  }).filter((p) => p.title);
  for (const p of projects) for (const u of p.description.match(URL_IN_TEXT) ?? []) if (!links.includes(u) && !/linkedin\.com/i.test(u)) links.push(u);

  const skillsCsv = file("Skills.csv");
  const skills = [...new Set(records(skillsCsv, ["name"]).map((r) => pick(r, "name")).filter(Boolean))];
  const certifications = records(file("Certifications.csv"), ["name", "authority"]).map((r) => {
    const n = pick(r, "name"), a = pick(r, "authority");
    return a ? `${n} (${a})` : n;
  }).filter(Boolean);
  const honors = records(file("Honors.csv"), ["title"]).map((r) => [pick(r, "title"), pick(r, "description")].filter(Boolean).join(": ")).filter(Boolean);
  const languages = records(file("Languages.csv"), ["name", "proficiency"]).map((r) => {
    const n = pick(r, "name"), p = pick(r, "proficiency");
    return p ? `${n} (${p})` : n;
  }).filter(Boolean);
  const publications = records(file("Publications.csv"), ["name", "publisher"]).map((r) => [pick(r, "name"), pick(r, "publisher")].filter(Boolean).join(", ")).filter(Boolean);

  const warnings: string[] = [];
  if (!headline) warnings.push("no_headline");
  if (!experience.length) warnings.push("no_experience_section");
  if (!education.length) warnings.push("no_education_section");
  if (skillsCsv === undefined) warnings.push("archive_no_skills_file");

  const li: ParsedLinkedIn = {
    name, headline, location, profileUrl: null, links, email: null,
    topSkills: skills, languages, certifications, honors, publications, about, experience, projects, education,
    skillsScope: skillsCsv === undefined ? "none" : "all",
    sections: ([["Summary", about], ["Experience", experience.length], ["Projects", projects.length], ["Education", education.length], ["Skills", skills.length]] as const)
      .filter(([, v]) => v).map(([h]) => h),
    warnings,
  };
  return { li, text: renderPublicText(li) };
}
