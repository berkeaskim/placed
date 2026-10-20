import { z } from "zod";
import type { ParsedCV, Year } from "@/lib/types";
import { YEARS } from "@/lib/types";

/** CVs and students often write "linkedin.com/in/name" with no scheme: add https:// so it is a usable link. Anything else is returned trimmed, unchanged. */
export function normaliseUrl(raw: string): string {
  const t = raw.trim();
  if (!t || /^[a-z][a-z\d+.-]*:/i.test(t)) return t; // empty, or already has a scheme (http:, https:, mailto:...)
  if (t.startsWith("//")) return `https:${t}`;
  return /^[^\s/]+\.[^\s/]+/.test(t) ? `https://${t}` : t; // looks like host.tld[/...]
}
const url = z.preprocess(
  (v) => (typeof v === "string" ? normaliseUrl(v) : v),
  z.string().url().refine((s) => /^https?:\/\//i.test(s), "Must be a web link").optional().or(z.literal("").transform(() => undefined)),
);
export const CoreSchema = z.object({
  first_name: z.string().trim().min(1), last_name: z.string().trim().min(1), preferred_name: z.string().trim().optional(),
  email: z.string().trim().email(), phone: z.string().trim().min(5),
  university: z.string().trim().min(1), degree: z.string().trim().min(1), year_of_study: z.enum(YEARS),
  grad_month: z.string().trim().min(3), grad_year: z.string().regex(/^20\d\d$/), grades: z.string().trim().optional(),
  country: z.string().trim().min(1), city: z.string().trim().min(1),
  rtw_uk: z.enum(["citizen_or_settled", "visa_permanent", "visa_temporary", "needs_sponsorship"]),
  needs_sponsorship: z.enum(["yes", "no"]),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), internship_length: z.string().trim().optional(),
  outstanding_offers: z.string().trim().optional(),
  linkedin: url, github: url, portfolio: url,
  heard_about: z.string().trim().min(1), languages: z.string().trim().optional(), pronouns: z.string().trim().optional(),
  // Placement year (placement 05 §4d): optional, so they never block unlocking Autopilot. Residency, nationality and
  // security-vetting answers are deliberately not here: the student answers those on the form.
  placement_included: z.enum(["yes", "no"]).optional(),
  placement_academic_year: z.string().trim().regex(/^20\d\d\s*[–/-]\s*(?:20)?\d\d$/).optional(),
  available_from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  available_to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  placement_duration: z.string().trim().optional(),
  placement_min_weeks: z.string().trim().regex(/^\d{1,2}$/).optional(),
  returning_to_study: z.enum(["yes", "no"]).optional(),
  year1_result: z.string().trim().optional(),
  predicted_class: z.string().trim().optional(),
  relocation: z.string().trim().optional(),
  placement_office: z.string().trim().optional(),
}); // zod objects strip unknown keys by default: an EEO key can never be stored through this schema.
export type Core = z.infer<typeof CoreSchema>;

export const RTW_LABELS: Record<Core["rtw_uk"], string> = {
  citizen_or_settled: "I'm a UK/Irish citizen or have settled/pre-settled status",
  visa_permanent: "I have a visa with a permanent right to work",
  visa_temporary: "I have a visa with a temporary right to work (e.g. Student or Graduate visa)",
  needs_sponsorship: "I would need the employer to sponsor my visa",
};

export type VaultKey = keyof Core | "full_name" | "location" | "graduation" | "placement_window";

/** The vault keys that only placement forms ask for. */
export const PLACEMENT_KEYS = [
  "placement_included", "placement_academic_year", "available_from", "available_to", "placement_duration", "placement_min_weeks",
  "returning_to_study", "year1_result", "predicted_class", "relocation", "placement_office",
] as const satisfies readonly (keyof Core)[];

const longDate = (iso: string) => {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
};

/** "1 Jun 2027 to 31 Aug 2028" from the placement window, for tailoring's AVAILABILITY line; null when either end is missing. */
export function placementWindow(core: Partial<Core>): string | null {
  return core.available_from && core.available_to ? `${longDate(core.available_from)} to ${longDate(core.available_to)}` : null;
}

export function isComplete(core: unknown): boolean {
  return CoreSchema.safeParse(core).success;
}

const EEO_RE = /\b(gender|sex\b|sexual|orientation|ethnic|race|racial|disab|neurodiver|veteran|armed forces|religio|belief|socio-?economic|free school meals|first[- ]generation|parents? (attend|went)|caring|carer|pregnan|marital|age range|date of birth|transgender|lgbt|first (of|in) (your|the|my) family|first[- ]gen|family to (attend|go)|diverse and inclusive|diversity|equal opportunit|self-describe|household earner|type of school|military|nationality|choose to share)/i;
export const isEeoLabel = (label: string) => EEO_RE.test(label);
export const isEeoKey = (key: string) => EEO_RE.test(key.replace(/_/g, " "));

export function normLabel(label: string): string {
  return label.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N} ]+/gu, "").replace(/\s+/g, " ").trim();
}

export function vaultValue(core: Partial<Core>, key: VaultKey): string | null {
  const v = (s: string | undefined | null) => (s && s.trim() ? s.trim() : null);
  switch (key) {
    case "full_name": return core.first_name && core.last_name ? `${core.first_name} ${core.last_name}` : null;
    case "location": return core.city && core.country ? `${core.city}, ${core.country}` : null;
    case "graduation": return core.grad_month && core.grad_year ? `${core.grad_month} ${core.grad_year}` : null;
    case "needs_sponsorship": return core.needs_sponsorship ? (core.needs_sponsorship === "yes" ? "Yes" : "No") : null;
    case "placement_included": return core.placement_included ? (core.placement_included === "yes" ? "Yes" : "No") : null;
    case "returning_to_study": return core.returning_to_study ? (core.returning_to_study === "yes" ? "Yes" : "No") : null;
    case "placement_window": return placementWindow(core);
    case "placement_min_weeks": return core.placement_min_weeks ? `${core.placement_min_weeks} weeks` : null;
    case "rtw_uk": return core.rtw_uk ? RTW_LABELS[core.rtw_uk] : null;
    default: return v(core[key] as string | undefined);
  }
}

export function prefillCore(i: { email: string | null; year: Year | null; cv: ParsedCV | null; needsVisa: boolean }): Partial<Core> {
  const out: Partial<Core> = {};
  const name = i.cv?.name?.trim().split(/\s+/) ?? [];
  if (name.length >= 2) { out.first_name = name.slice(0, -1).join(" "); out.last_name = name[name.length - 1]; }
  if (i.email ?? i.cv?.email) out.email = (i.email ?? i.cv?.email)!;
  if (i.cv?.phone) out.phone = i.cv.phone;
  if (i.year) out.year_of_study = i.year;
  const edu = i.cv?.education?.[0];
  if (edu) {
    out.university = edu.institution; out.degree = edu.degree;
    const years = edu.dates.match(/20\d\d/g);
    if (years?.length) out.grad_year = years[years.length - 1];
  }
  if (i.cv?.location) out.city = i.cv.location.split(",")[0].trim();
  for (const l of i.cv?.links ?? []) {
    const u = normaliseUrl(l);
    if (/linkedin\.com/i.test(u)) out.linkedin = u;
    else if (/github\.com/i.test(u)) out.github = u;
    else out.portfolio ??= u;
  }
  // needsVisa is a hint for the UI only: RTW and sponsorship are never prefilled (spec §2 rule 3).
  return out;
}

/** Answers the student gave on earlier packs, keyed by normLabel(question). Option answers are stored as their LABEL(s), never ids. */
export type Extra = Record<string, string | string[]>;
export type Remembered = { value: string | string[]; exact: boolean };

const STOP = new Set("a an the do does did you your yours are is be been will would can could have has of to in on at for from with and or this that what which any please if we us our currently current".split(" "));
const NEGATION = /\b(not|no|without|never|dont|doesnt|cannot|cant)\b/;
const tokens = (k: string) => new Set(k.split(" ").filter((t) => t && !STOP.has(t)));

/**
 * Finds what the student answered before for this question: an exact (normalised) label first, else the closest
 * earlier label when the wording is nearly the same (token Jaccard >= 0.75, same negation, same numbers). A near
 * match is only ever a suggestion the student confirms; it never fills silently.
 */
export function findRemembered(extra: Extra, label: string): Remembered | null {
  const k = normLabel(label);
  if (!k) return null;
  if (Object.hasOwn(extra, k)) return { value: extra[k], exact: true };
  const a = tokens(k);
  if (a.size < 2) return null;
  const nums = (s: string) => (s.match(/\d+/g) ?? []).join(",");
  let best: { key: string; score: number } | null = null;
  for (const key of Object.keys(extra)) {
    if (NEGATION.test(key) !== NEGATION.test(k) || nums(key) !== nums(k)) continue;
    const b = tokens(key);
    if (b.size < 2) continue;
    let inter = 0;
    for (const t of a) if (b.has(t)) inter++;
    const score = inter / (a.size + b.size - inter);
    if (score >= 0.75 && (!best || score > best.score)) best = { key, score };
  }
  return best ? { value: extra[best.key], exact: false } : null;
}
