import { daysUntil, isValidDate } from "./dates";

/**
 * How soon to act, kept OUT of the fit score (10#4): about 90% of ATS postings publish no closing date, and ISE 2026
 * reports employers closing campaigns early, so an unknown date means "apply early", not "worse fit". Urgency only
 * orders jobs within a fit label and labels the card.
 */
export type Urgency = { days: number | null; rolling: boolean; chip: string | null; rank: 0 | 1 | 2 | 3 };

export const URGENT_DAYS = 7;
const SOON_DAYS = 14;

export function urgencyOf(job: { deadline: string | null; rolling?: boolean; opensOn?: string | null }, today: string): Urgency {
  const rolling = job.rolling === true;
  if (isValidDate(job.opensOn) && job.opensOn > today) return { days: null, rolling, chip: null, rank: 3 };
  if (isValidDate(job.deadline)) {
    const d = daysUntil(job.deadline, today);
    const chip = d < 0 ? null : d === 0 ? "Closes today" : d === 1 ? "Closes tomorrow" : d <= SOON_DAYS ? `Closes in ${d} days` : null;
    return { days: d, rolling, chip, rank: d <= URGENT_DAYS ? 0 : d <= SOON_DAYS || rolling ? 1 : 2 };
  }
  return rolling ? { days: null, rolling, chip: "Rolling: apply early", rank: 1 } : { days: null, rolling, chip: null, rank: 2 };
}
