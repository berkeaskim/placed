import type { ParsedCV } from "@/lib/types";
import { redactCv, PLACEHOLDER, type Replacement } from "@/lib/cv/redact";
import { EMAIL_RE, PHONE_RE } from "@/lib/text/regex";

/**
 * What the CV judge may see of the structured CV (fairness, spec §11 / amendments A5).
 * Built from NAMED content fields only — never a spread of parsed_json, which also carries
 * `safety` (the injected text itself), archetype guesses and identity fields.
 */
export type JudgeCvContent = {
  name: "[Candidate]";
  email: null;
  phone: null;
  location: null;
  links: string[];
  summary: string | null;
  education: ParsedCV["education"];
  experience: ParsedCV["experience"];
  projects: ParsedCV["projects"];
  leadership: ParsedCV["leadership"];
  skills: ParsedCV["skills"];
  interests: string | null;
};

const EMAIL_G = new RegExp(EMAIL_RE.source, "g");
const PHONE_G = new RegExp(PHONE_RE.source, "g");

/** Email/phone scrub for free-text fields. Phones need 10+ digits so "2019 - 2021 2022" survives. */
function scrub(s: string): string {
  return s
    .replace(EMAIL_G, PLACEHOLDER.email)
    .replace(PHONE_G, (m) => (m.replace(/\D/g, "").length >= 10 ? PLACEHOLDER.phone : m));
}
const scrubN = (s: string | null) => (s == null ? null : scrub(s));

const PLATFORM = /(github\.com|gitlab\.com|linkedin\.com|kaggle\.com|behance\.net|dribbble\.com|medium\.com|huggingface\.co)/i;
/** "LinkedIn present" survives; the slug and any personal domain do not. */
function linkLabel(l: string): string {
  return `[link: ${l.match(PLATFORM)?.[1].toLowerCase() ?? "personal website"}]`;
}

export function stripPii(cv: ParsedCV): JudgeCvContent {
  const entry = (e: ParsedCV["experience"][number]) => ({
    id: e.id, org: scrub(e.org), title: scrub(e.title), dates: e.dates, location: scrub(e.location),
    bullets: e.bullets.map((b) => ({ id: b.id, text: scrub(b.text) })),
  });
  return {
    name: "[Candidate]", email: null, phone: null, location: null,
    links: (cv.links ?? []).map(linkLabel),
    summary: scrubN(cv.summary),
    education: (cv.education ?? []).map((e) => ({
      id: e.id, institution: scrub(e.institution), degree: scrub(e.degree), dates: e.dates, grade: e.grade,
      details: e.details.map((d) => ({ id: d.id, text: scrub(d.text) })),
    })),
    experience: (cv.experience ?? []).map(entry),
    projects: (cv.projects ?? []).map(entry),
    leadership: (cv.leadership ?? []).map(entry),
    skills: (cv.skills ?? []).map((g) => ({ group: scrub(g.group), items: g.items.map(scrub) })),
    interests: scrubN(cv.interests),
  };
}

/**
 * Plain-text rendering of the structured content. Line 0 is "CV" and line 1 a section heading, so
 * redactCv neither guesses a name from it nor treats a section as the contact header. Every section
 * heading is always present, so the layout carries no information beyond the content.
 */
export function renderCvContent(c: JudgeCvContent): string {
  const out: string[] = ["CV"];
  const entries = (heading: string, list: JudgeCvContent["experience"]) => {
    out.push(heading);
    if (!list.length) out.push("(none)");
    for (const e of list) {
      out.push(`- ${[e.title, e.org, e.dates].filter(Boolean).join(" | ")}`);
      for (const b of e.bullets) out.push(`  - ${b.text}`);
    }
  };
  out.push("SUMMARY", c.summary?.trim() || "(none)");
  out.push("EDUCATION");
  if (!c.education.length) out.push("(none)");
  for (const e of c.education) {
    out.push(`- ${[e.institution, e.degree, e.dates, e.grade].filter(Boolean).join(" | ")}`);
    for (const d of e.details) out.push(`  - ${d.text}`);
  }
  entries("EXPERIENCE", c.experience);
  entries("PROJECTS", c.projects);
  entries("LEADERSHIP", c.leadership);
  out.push("SKILLS");
  if (!c.skills.length) out.push("(none)");
  for (const g of c.skills) out.push(`- ${g.group}: ${g.items.join(", ")}`);
  out.push("INTERESTS", c.interests?.trim() || "(none)");
  out.push("LINKS", c.links.length ? c.links.join(", ") : "(none)");
  return out.join("\n");
}

export type JudgeInputText = { redactedText: string; structuredText: string; replacements: Replacement[] };

/**
 * Everything the judge sees, redacted with redactCv (A5: name, contact, profile slugs, work
 * authorisation, special-category terms, language labels; universities are kept by design).
 * knownName/knownEmail always come from the parsed CV: the heuristic alone can leak "J. Brown".
 */
export function prepareJudgeInput(cv: ParsedCV, rawText: string): JudgeInputText {
  const opts = { knownName: cv.name?.trim() || undefined, knownEmail: cv.email?.trim() || undefined };
  const raw = redactCv(rawText, opts);
  const structured = redactCv(renderCvContent(stripPii(cv)), opts);
  return { redactedText: raw.redacted, structuredText: structured.redacted, replacements: raw.replacements };
}
