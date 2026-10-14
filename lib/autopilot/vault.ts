import { z } from "zod";
import type { ParsedCV, Year } from "@/lib/types";
import { YEARS } from "@/lib/types";

const url = z.string().url().optional().or(z.literal("").transform(() => undefined));
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
}); // zod objects strip unknown keys by default: an EEO key can never be stored through this schema.
export type Core = z.infer<typeof CoreSchema>;

export const RTW_LABELS: Record<Core["rtw_uk"], string> = {
  citizen_or_settled: "I'm a UK/Irish citizen or have settled/pre-settled status",
  visa_permanent: "I have a visa with a permanent right to work",
  visa_temporary: "I have a visa with a temporary right to work (e.g. Student or Graduate visa)",
  needs_sponsorship: "I would need the employer to sponsor my visa",
};

export type VaultKey = keyof Core | "full_name" | "location" | "graduation";

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
    if (/linkedin\.com/i.test(l)) out.linkedin = l;
    else if (/github\.com/i.test(l)) out.github = l;
    else out.portfolio ??= l;
  }
  // needsVisa is a hint for the UI only: RTW and sponsorship are never prefilled (spec §2 rule 3).
  return out;
}
