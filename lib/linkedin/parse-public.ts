import type { LiEducation, LiExperience, ParsedLinkedIn } from "./parse-export";

/**
 * Parser for a PUBLIC LinkedIn profile page (what linkedin.com/in/<slug> serves to a logged-out visitor).
 * Reads the JSON-LD Person block first (name, About, location, employers and schools with years) and the
 * public HTML cards (experience-item, education__list-item) for titles, date ranges and descriptions.
 *
 * Markup observed 2026-10-14 on a live public profile; LinkedIn changes it without notice, so every field is
 * best-effort and `warnings` says what was missing. Top Skills, certifications and contact links other than
 * websites are usually not public: rules that need them become not_applicable.
 */

/** Attributes can contain ">" (LinkedIn's Tailwind classes: "[&>*]:mb-0"), so a tag ends at the first ">" outside quotes. */
const ATTRS = `(?:[^>"']|"[^"]*"|'[^']*')*`;
const TAG_RE = new RegExp(`<${ATTRS}>`, "g");
const decode = (s: string) =>
  s.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))).replace(/&nbsp;/g, " ");
const text = (html: string) =>
  decode(html.replace(/<br\s*\/?>/gi, "\n").replace(/<\/(p|li|div)>/gi, "\n").replace(TAG_RE, " "))
    .split("\n").map((l) => l.replace(/[ \t]+/g, " ").trim()).filter(Boolean).join("\n");

/** Inner HTML of the first element whose class list contains `cls` (balanced on the same tag name). */
function byClass(html: string, cls: string, from = 0): { inner: string; end: number } | null {
  const re = new RegExp(`<(\\w+)(?:[^>"']|'[^']*'|"[^"]*")*?\\sclass="[^"]*(?<![\\w-])${cls.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])[^"]*"${ATTRS}>`, "g");
  re.lastIndex = from;
  const m = re.exec(html);
  if (!m) return null;
  const tag = m[1];
  const open = new RegExp(`<${tag}\\b`, "g"), close = new RegExp(`</${tag}>`, "g");
  let depth = 1, i = m.index + m[0].length;
  while (depth > 0) {
    open.lastIndex = i; close.lastIndex = i;
    const o = open.exec(html), c = close.exec(html);
    if (!c) return { inner: html.slice(m.index + m[0].length), end: html.length };
    if (o && o.index < c.index) { depth++; i = o.index + 1; } else { depth--; i = c.index + c[0].length; }
  }
  return { inner: html.slice(m.index + m[0].length, i - `</${tag}>`.length), end: i };
}
function allByClass(html: string, cls: string): string[] {
  const out: string[] = [];
  let from = 0;
  for (let r = byClass(html, cls, from); r; r = byClass(html, cls, from)) { out.push(r.inner); from = r.end; }
  return out;
}
/** Text of the first <tag> element (cards put the school/title in <h3> and the degree/company in <h4>). */
const firstTag = (html: string, tag: string) => { const m = html.match(new RegExp(`<${tag}\\b${ATTRS}>([\\s\\S]*?)</${tag}>`)); return m ? text(m[1]).replace(/\n/g, " ") || null : null; };
const firstText = (html: string, cls: string) => { const r = byClass(html, cls); return r ? text(r.inner).replace(/\n/g, " ") || null : null; };
function section(html: string, name: string): string | null {
  const i = html.indexOf(`data-section="${name}"`);
  if (i < 0) return null;
  const start = html.lastIndexOf("<", i);
  const tag = html.slice(start + 1).match(/^\w+/)?.[0] ?? "section";
  const end = html.indexOf(`</${tag}>`, i);
  // Sections nest lists; take up to the next top-level data-section as a safe bound.
  const next = html.indexOf("data-section=", i + 20);
  return html.slice(start, Math.max(end, next > 0 ? next : end));
}

const MONTH = "(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)[a-z]*";
export function point(s: string): { year: number; month: number | null } | null {
  const y = s.match(/(19|20)\d{2}/);
  if (!y) return null;
  const m = s.match(new RegExp(MONTH, "i"));
  const months = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  return { year: Number(y[0]), month: m ? months.indexOf(m[0].slice(0, 3).toLowerCase()) + 1 : null };
}
/** "Jun 2025 - Aug 2025 3 months" → ["Jun 2025", "Aug 2025"|"Present"]. */
export function range(s: string): [string, string] | null {
  const m = s.replace(/\s+/g, " ").match(new RegExp(`((?:${MONTH} )?(?:19|20)\\d{2})\\s*[-–—]\\s*((?:${MONTH} )?(?:19|20)\\d{2}|Present)`, "i"));
  return m ? [m[1], m[2]] : null;
}

type LdPerson = {
  name?: string; description?: string; address?: { addressLocality?: string };
  worksFor?: { name?: string; member?: { startDate?: number | string; endDate?: number | string } }[];
  alumniOf?: { name?: string; member?: { startDate?: number | string; endDate?: number | string } }[];
  awards?: string[]; knowsLanguage?: string[];
};
function ldPerson(html: string): LdPerson | null {
  for (const m of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      const d = JSON.parse(m[1]);
      const p = (d["@graph"] ?? [d]).find((n: { "@type"?: string }) => n["@type"] === "Person");
      if (p) return p as LdPerson;
    } catch { /* not JSON: skip */ }
  }
  return null;
}

export type PublicProfile = { li: ParsedLinkedIn; text: string };

/**
 * Public profile HTML → ParsedLinkedIn plus a plain-text rendering (the text LLM evidence lines must quote).
 * `profileUrl` is the canonical URL the page was fetched from.
 */
export function parsePublicProfile(html: string, profileUrl: string): PublicProfile {
  const ld = ldPerson(html);
  const warnings: string[] = [];

  const name = firstText(html, "top-card-layout__title") ?? ld?.name?.trim() ?? null;
  const headline = firstText(html, "top-card-layout__headline");
  const location = ld?.address?.addressLocality?.trim() || firstText(html, "top-card__subline-item") || null;
  const sum = section(html, "summary");
  const about = (sum && text(byClass(sum, "core-section-container__content")?.inner ?? sum.replace(/^[\s\S]*?About/, "")).split("\n").filter((l) => !/^Articles by /.test(l)).slice(0, 40).join("\n")) || ld?.description?.trim() || null;

  const experience: LiExperience[] = allByClass(html, "experience-item").map((it) => {
    const dates = firstText(it, "date-range") ?? "";
    const r = range(dates);
    const desc = byClass(it, "show-more-less-text__text--less") ?? byClass(it, "show-more-less-text__text--more") ?? byClass(it, "experience-item__description");
    const loc = allByClass(it, "experience-item__meta-item").map((x) => text(x)).find((t) => !/\d{4}/.test(t)) ?? null;
    return {
      company: firstText(it, "experience-item__subtitle") ?? firstTag(it, "h4") ?? "", title: firstText(it, "experience-item__title") ?? firstTag(it, "h3") ?? "",
      dates: r ? `${r[0]} - ${r[1]}` : dates, start: r ? point(r[0]) : null, end: r && !/present/i.test(r[1]) ? point(r[1]) : null,
      location: loc, description: desc ? text(desc.inner) : "",
    };
  });
  // Fallback: JSON-LD employers when the cards are missing (years only, no titles or descriptions).
  if (!experience.length && ld?.worksFor?.length) {
    for (const w of ld.worksFor) {
      const s = w.member?.startDate ? String(w.member.startDate) : "";
      const e = w.member?.endDate ? String(w.member.endDate) : "Present";
      experience.push({ company: (w.name ?? "").trim(), title: "", dates: s ? `${s} - ${e}` : "", start: s ? point(s) : null, end: e === "Present" ? null : point(e), location: null, description: "" });
    }
    warnings.push("experience_from_structured_data");
  }

  const education: LiEducation[] = allByClass(html, "education__list-item").map((it) => {
    const r = range(firstText(it, "date-range") ?? "");
    const h4 = byClass(it, "education__item--degree-info") ?? byClass(it, "profile-section-card__subtitle");
    const degree = h4 ? text(h4.inner).replace(/\n/g, ", ") : firstTag(it, "h4");
    const det = byClass(it, "education__item--details") ?? byClass(it, "show-more-less-text__text--less");
    return {
      school: firstText(it, "profile-section-card__title") ?? firstTag(it, "h3") ?? "",
      degree: degree && degree !== "-" ? degree : null,
      startYear: r ? point(r[0])?.year ?? null : null, endYear: r && !/present/i.test(r[1]) ? point(r[1])?.year ?? null : null,
      details: det ? text(det.inner) : "",
    };
  });
  if (!education.length && ld?.alumniOf?.length) {
    for (const a of ld.alumniOf) {
      education.push({ school: (a.name ?? "").trim(), degree: null, startYear: a.member?.startDate ? Number(a.member.startDate) : null, endYear: a.member?.endDate ? Number(a.member.endDate) : null, details: "" });
    }
    warnings.push("education_from_structured_data");
  }

  const links = [...(section(html, "websites") ?? "").matchAll(/redirect\?url=([^&"]+)/g)].map((m) => decodeURIComponent(decode(m[1])));
  const certSec = section(html, "certifications");
  const certifications = certSec ? allByClass(certSec, "profile-section-card__title").map((x) => text(x).replace(/\n/g, " ")) : [];
  const honors = ld?.awards ?? [];
  const languages = ld?.knowsLanguage ?? [];

  if (!headline) warnings.push("no_headline");
  if (!experience.length) warnings.push("no_experience_section");
  if (!education.length) warnings.push("no_education_section");
  warnings.push("public_view_no_skills");

  const li: ParsedLinkedIn = {
    name, headline, location, profileUrl, links: [...new Set(links)], email: null,
    topSkills: [], languages, certifications, honors, publications: [], about, experience, projects: [], education,
    skillsScope: "none",
    sections: ["Summary", "Experience", "Education"].filter((_, k) => [about, experience.length, education.length][k]),
    warnings,
  };
  return { li, text: renderPublicText(li) };
}

/** Plain text in the export's order: what the judge quotes from and what code checks scan. */
export function renderPublicText(li: ParsedLinkedIn): string {
  const out: string[] = [];
  if (li.profileUrl || li.links.length) out.push("Contact", ...(li.profileUrl ? [li.profileUrl] : []), ...li.links);
  if (li.topSkills.length) out.push("Top Skills", ...li.topSkills);
  if (li.languages.length) out.push("Languages", ...li.languages);
  if (li.certifications.length) out.push("Certifications", ...li.certifications);
  if (li.honors.length) out.push("Honors-Awards", ...li.honors);
  out.push(li.name ?? "", li.headline ?? "", li.location ?? "");
  if (li.about) out.push("Summary", li.about);
  if (li.experience.length) {
    out.push("Experience");
    for (const e of li.experience) out.push(e.company, e.title, e.dates, ...(e.location ? [e.location] : []), ...(e.description ? [e.description] : []));
  }
  if (li.projects.length) {
    out.push("Projects");
    for (const p of li.projects) out.push(p.title, ...(p.dates ? [p.dates] : []), ...(p.description ? [p.description] : []));
  }
  if (li.education.length) {
    out.push("Education");
    for (const e of li.education) out.push(e.school, [e.degree, e.startYear && e.endYear ? `(${e.startYear} - ${e.endYear})` : ""].filter(Boolean).join(" · "), ...(e.details ? [e.details] : []));
  }
  return out.filter((l) => l !== "").join("\n");
}
