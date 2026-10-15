import { z } from "zod";
import type { LiEducation, LiExperience, ParsedLinkedIn } from "./parse-export";
import { point, range, renderPublicText, type PublicProfile } from "./parse-public";

/**
 * Parser for what the Placed extension reads from the student's OWN profile in their logged-in LinkedIn tab.
 *
 * LinkedIn's logged-in profile (the "SDUI" layout, observed 2026-10-15) has obfuscated class names and no <li>
 * lists, so the extension stays dumb: it finds each card by its heading, splits it into items, and sends each item
 * as its visible text lines. Everything that interprets those lines lives here, where it is typed and tested.
 *
 * Observed item shapes:
 *   experience  ["Software Developer", "Acme · Part-time", "Sep 2024 - Apr 2025 · 8 mos", "London, UK · Hybrid", "<description>", "SQL and +2 skills"]
 *   grouped     ["Acme", "Full-time · 2 yrs", "Analyst", "Jan 2024 - Present · 10 mos", "<description>", "Intern", "Jun 2023 - Aug 2023 · 3 mos"]
 *   education   ["UCL", "BSc Computer Science", "2025 – 2028", "Grade: First", "<details>"]
 *   cert        ["AWS Cloud Practitioner", "Amazon Web Services (AWS)", "Issued Jul 2024", ...]
 *   language    ["English", "Full professional proficiency"]
 */

const line = z.string().max(3000);
const lines = z.array(line).max(40);
const items = z.array(lines).max(40);
export const CapturePayloadSchema = z.object({
  profileUrl: z.string().max(300),
  name: z.string().max(200),
  /** Top card lines after the name, in page order (pronouns, headline, school, location, "Contact info", …). */
  top: z.array(line).max(30),
  about: z.string().max(5000).default(""),
  experience: items.default([]),
  education: items.default([]),
  certifications: items.default([]),
  honors: items.default([]),
  languages: items.default([]),
  projects: items.default([]),
  skills: z.array(z.string().max(200)).max(150).default([]),
  /** false when only the profile page's 2-3 skills were read (the full list didn't load). */
  skillsComplete: z.boolean().default(false),
  /** External links found on the profile (top card website, About). */
  links: z.array(z.string().max(500)).max(20).default([]),
});
export type CapturePayload = z.infer<typeof CapturePayloadSchema>;

// LinkedIn chrome inside cards: "… more" (already expanded by the extension) and "Show all 3 educations" footers.
const MORE = /^(…?\s*(see )?more|show all \d+ [\w &]+)$/i;
const clean = (s: string) => (MORE.test(s.trim()) ? "" : s.replace(/\s+/g, " ").trim());
const PRONOUNS = /^(he|she|they|ze|xe)\s*\/\s*\w+$/i;
const NOISE = /^(·|contact info|\d+\+? (connections|followers)|open to|show details|see more|…see more|verified)$/i;
const EMPLOYMENT = /^(full-time|part-time|internship|self-employed|freelance|contract|apprenticeship|seasonal|temporary)\b/i;
const SKILLS_LINE = /(\band \+\d+ skills?$|^skills:)/i;
const WORK_MODE = /\b(on-site|onsite|remote|hybrid)$/i;
const isDate = (s: string) => range(s) !== null;
const isLocation = (s: string) => s.length < 90 && (WORK_MODE.test(s) || /,\s*\S/.test(s) || /\b(area|united kingdom|united states)\b/i.test(s)) && !/[.!?]$/.test(s);

function headlineAndLocation(top: string[]): { headline: string | null; location: string | null } {
  const ls = top.map(clean).filter((l) => l && !PRONOUNS.test(l) && !NOISE.test(l));
  const headline = ls.find((l) => l.length > 3) ?? null;
  const after = headline ? ls.slice(ls.indexOf(headline) + 1) : ls;
  return { headline, location: after.find((l) => l !== headline && isLocation(l)) ?? null };
}

function role(title: string, company: string, dateLine: string, rest: string[]): LiExperience {
  const r = range(dateLine);
  let location: string | null = null;
  if (rest.length && isLocation(rest[0])) location = rest.shift()!.replace(/\s*·\s*(on-site|onsite|remote|hybrid)$/i, "").replace(/^(on-site|onsite|remote|hybrid)$/i, "") || null;
  return {
    company, title,
    dates: r ? `${r[0]} - ${r[1]}` : clean(dateLine),
    start: r ? point(r[0]) : null, end: r && !/present/i.test(r[1]) ? point(r[1]) : null,
    location, description: rest.filter((l) => !SKILLS_LINE.test(l)).join("\n").trim(),
  };
}

function parseExperience(item: string[]): LiExperience[] {
  const ls = item.map(clean).filter(Boolean);
  const dates = ls.map((l, k) => (isDate(l) ? k : -1)).filter((k) => k >= 0);
  if (!dates.length) return ls.length ? [{ company: (ls[1] ?? "").split(" · ")[0], title: ls[0], dates: "", start: null, end: null, location: null, description: ls.slice(2).join("\n") }] : [];
  // One role: title, "Company · type", dates, …
  if (dates.length === 1 && dates[0] <= 2) {
    const d = dates[0];
    return [role(ls[0], d >= 2 ? ls[1].split(" · ")[0] : "", ls[d], ls.slice(d + 1))];
  }
  // Several roles at one company: company, "type · total", then (title, [type], dates, …) per role.
  const company = ls[0];
  // A role's title is the line above its dates, skipping an employment-type line ("Part-time") in between.
  const titleAt = (d: number) => { let t = d - 1; while (t > 0 && EMPLOYMENT.test(ls[t])) t--; return t; };
  return dates.map((d, k) => {
    const t = titleAt(d);
    const stop = k + 1 < dates.length ? titleAt(dates[k + 1]) : ls.length;
    return role(ls[t], company, ls[d], ls.slice(d + 1, stop));
  });
}

function parseEducation(item: string[]): LiEducation | null {
  const ls = item.map(clean).filter(Boolean);
  if (!ls.length) return null;
  const d = ls.findIndex(isDate);
  const r = d >= 0 ? range(ls[d]) : null;
  const degree = ls[1] && ls[1] !== ls[d] ? ls[1] : null;
  const detailFrom = d >= 0 ? d + 1 : degree ? 2 : 1;
  return {
    school: ls[0], degree,
    startYear: r ? point(r[0])?.year ?? null : null, endYear: r && !/present/i.test(r[1]) ? point(r[1])?.year ?? null : null,
    details: ls.slice(detailFrom).filter((l) => !SKILLS_LINE.test(l)).join("\n"),
  };
}

/** "linkedin.com/redir/redirect?url=https%3A%2F%2Fgithub.com%2Fx" → "https://github.com/x"; LinkedIn's own links dropped. */
export function externalLink(href: string): string | null {
  try {
    const u = new URL(href);
    if (/(^|\.)linkedin\.com$/i.test(u.hostname)) {
      const target = u.searchParams.get("url");
      return target && /^https?:\/\//i.test(target) && !/linkedin\.com/i.test(new URL(target).hostname) ? target : null;
    }
    return /^https?:$/.test(u.protocol) ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * The extension splits a card into items by the children of the lowest element holding all its lines. With a single
 * item that element sits INSIDE the item, so its lines arrive split into several "items". Every real item carries its
 * own date line, so when at most one group has a date and some group is nothing but dates, it was one item.
 */
export function rejoinSingleItem(its: string[][], isAnchor: (l: string) => boolean): string[][] {
  if (its.length < 2) return its;
  const withAnchor = its.filter((it) => it.some(isAnchor)).length;
  const anchorOnly = its.some((it) => it.length > 0 && it.every(isAnchor));
  return withAnchor <= 1 && anchorOnly ? [its.flat()] : its;
}
const ISSUED = /^issued\b/i;

/** Captured payload → ParsedLinkedIn + the plain-text rendering the judge quotes from. */
export function parseCapturedProfile(p: CapturePayload, profileUrl: string): PublicProfile {
  const { headline, location } = headlineAndLocation(p.top);
  const about = clean(p.about) ? p.about.trim() : null;
  const experience = rejoinSingleItem(p.experience, isDate).flatMap(parseExperience);
  const education = rejoinSingleItem(p.education, isDate).map(parseEducation).filter((e): e is LiEducation => e !== null);
  const certifications = rejoinSingleItem(p.certifications, (l) => ISSUED.test(l.trim())).map((it) => it.map(clean).filter(Boolean)).filter((l) => l.length)
    .map((l) => (l[1] && !ISSUED.test(l[1]) ? `${l[0]} (${l[1]})` : l[0]));
  const firstLines = (its: string[][]) => its.map((it) => clean(it[0] ?? "")).filter(Boolean);
  const languages = p.languages.map((it) => it.map(clean).filter(Boolean)).filter((l) => l.length).map((l) => (l[1] ? `${l[0]} (${l[1]})` : l[0]));
  const skills = [...new Set(p.skills.map(clean).filter(Boolean))];
  const links = [...new Set(p.links.map(externalLink).filter((l): l is string => !!l))];

  // Projects have no slot in the export shape; they read like experience, so they join it as untitled roles.
  for (const it of p.projects) {
    const ls = it.map(clean).filter(Boolean);
    if (!ls.length) continue;
    const d = ls.findIndex(isDate);
    experience.push({ ...role(`Project: ${ls[0]}`, "", d >= 0 ? ls[d] : "", ls.slice(d >= 0 ? d + 1 : 1)), location: null });
  }

  const warnings: string[] = [];
  if (!headline) warnings.push("no_headline");
  if (!experience.length) warnings.push("no_experience_section");
  if (!education.length) warnings.push("no_education_section");
  if (!skills.length) warnings.push("public_view_no_skills");
  else if (!p.skillsComplete) warnings.push("skills_partial");

  const li: ParsedLinkedIn = {
    name: clean(p.name) || null, headline, location, profileUrl, links, email: null,
    topSkills: skills, languages, certifications, honors: firstLines(p.honors), publications: [], about, experience, education,
    sections: [["Summary", about], ["Experience", experience.length], ["Education", education.length], ["Top Skills", skills.length]].filter(([, v]) => v).map(([h]) => h as string),
    warnings,
  };
  return { li, text: renderPublicText(li) };
}
