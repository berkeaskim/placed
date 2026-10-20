/**
 * One-application-per-firm guard (placement 05 §4d, spring 05 §6d). Some employers only consider one application per
 * candidate per cycle (or one at a time), and most banks cap spring-week applicants at one or two divisions. Autopilot
 * warns before filling a second form for the same employer; it never blocks. Pure.
 */
import type { Track } from "@/lib/cv-rules/types";

export type FirmRule = { employer: string; aliases: string[]; rule: string; source: string };

/**
 * Employers whose own pages (or the placement research, research/placement-year/05 §4d) say one application at a time
 * or one per cycle. Re-check every September with the other cycle data.
 */
export const ONE_APPLICATION_FIRMS: FirmRule[] = [
  { employer: "Deloitte", aliases: ["deloitte"], rule: "Deloitte considers one application per candidate at a time.", source: "research/placement-year/05-application-content.md §4d" },
  { employer: "Bank of England", aliases: ["bank of england", "boe"], rule: "The Bank of England accepts one application per scheme cycle.", source: "research/placement-year/05-application-content.md §4d" },
  { employer: "AstraZeneca", aliases: ["astrazeneca", "astra zeneca"], rule: "AstraZeneca asks students to apply for one placement at a time.", source: "research/placement-year/05-application-content.md §4d" },
  { employer: "PwC", aliases: ["pwc", "pricewaterhousecoopers"], rule: "PwC considers one application at a time.", source: "research/placement-year/05-application-content.md §4d" },
];

export type OtherApplication = { company: string; title: string; status: string };

const norm = (s: string) => s.toLowerCase().replace(/[.,&]/g, " ").replace(/\b(?:plc|ltd|llp|limited|group|uk|the)\b/g, " ").replace(/\s+/g, " ").trim();
const sameFirm = (a: string, b: string) => {
  const x = norm(a), y = norm(b);
  return !!x && !!y && (x === y || x.startsWith(`${y} `) || y.startsWith(`${x} `));
};

export function firmRuleFor(company: string): FirmRule | null {
  const c = norm(company);
  return ONE_APPLICATION_FIRMS.find((f) => f.aliases.some((a) => c === a || c.startsWith(`${a} `) || c.endsWith(` ${a}`))) ?? null;
}

/** Statuses that mean the student has actually applied (a saved job is not an application). */
const APPLIED = new Set(["applied", "interview", "offer"]);

/**
 * A warning when the student has already applied to this employer this cycle, or null. `others` are their other
 * tracked applications (not this job).
 */
export function firmGuard(i: { company: string; track: Track; others: OtherApplication[] }): string | null {
  const prior = i.others.filter((o) => APPLIED.has(o.status) && sameFirm(o.company, i.company));
  if (prior.length === 0) return null;
  const titles = prior.map((o) => `"${o.title}"`).join(", ");
  const rule = firmRuleFor(i.company);
  if (rule) return `You've already applied to ${titles} at ${rule.employer}. ${rule.rule} A second application may be withdrawn or count against you, so check before you send it.`;
  if (i.track === "spring") return `You've already applied to ${titles} at ${i.company}. Many banks only let you apply to one or two spring-week divisions per cycle, so check ${i.company}'s rules before you send another.`;
  if (i.track === "placement") return `You've already applied to ${titles} at ${i.company}. Some employers only consider one placement application at a time, so check ${i.company}'s rules before you send another.`;
  return null;
}
