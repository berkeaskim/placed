import { safeNamePart } from "@/lib/autopilot/handoff";

/** `First-Last_Cover-Letter_Company_YYYY-MM.pdf`, each name part through the same sanitiser Autopilot's handoff uses. */
export function letterFilename(first: string, last: string, company: string, date: Date): string {
  const ym = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return `${safeNamePart(first, "Name")}-${safeNamePart(last, "Name")}_Cover-Letter_${safeNamePart(company, "Company")}_${ym}.pdf`;
}

/** First name and the rest, from one full name ("Alex Morgan" → ["Alex", "Morgan"]). */
export function splitName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  return [parts[0] ?? "", parts.slice(1).join(" ")];
}
