export function todayLondon(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

/** A real YYYY-MM-DD calendar date. Anything else ("", "TBC", 2026-13-45) is treated as no deadline. */
export function isValidDate(d: string | null | undefined): d is string {
  if (!d || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(`${d}T00:00:00Z`);
  return !Number.isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

export function isOpen(deadline: string | null, today: string): boolean {
  return !isValidDate(deadline) || daysUntil(deadline, today) >= 0;
}

export function deadlineLabel(deadline: string | null, today: string): string {
  if (!isValidDate(deadline)) return "Rolling deadline";
  const d = daysUntil(deadline, today);
  if (d < 0) return "Closed";
  if (d === 0) return "Closes today";
  if (d === 1) return "Closes tomorrow";
  return `${d} days left`;
}

/**
 * Honest close-date label using deadline provenance. "No closing date published" is the common case
 * (~90% of Greenhouse/Lever/Ashby postings) and must not be presented as a rolling deadline.
 */
export function closingLabel(job: { deadline: string | null; rolling?: boolean; opensOn?: string | null }, today: string): string {
  if (isValidDate(job.deadline)) return deadlineLabel(job.deadline, today);
  if (isValidDate(job.opensOn) && job.opensOn > today) return `Opens ${opensLabel(job.opensOn)}`;
  return job.rolling ? "Rolling: apply early" : "No closing date published";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function opensLabel(d: string): string {
  return `${MONTHS[Number(d.slice(5, 7)) - 1]} ${d.slice(0, 4)}`;
}
