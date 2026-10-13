export function todayLondon(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function daysUntil(date: string, today: string): number {
  return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
}

export function isOpen(deadline: string | null, today: string): boolean {
  return deadline === null || daysUntil(deadline, today) >= 0;
}

export function deadlineLabel(deadline: string | null, today: string): string {
  if (!deadline) return "Rolling deadline";
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
export function closingLabel(job: { deadline: string | null; rolling?: boolean }, today: string): string {
  if (job.deadline) return deadlineLabel(job.deadline, today);
  return job.rolling ? "Rolling: apply early" : "No closing date published";
}
