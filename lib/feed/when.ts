const MIN = 60_000, HOUR = 60 * MIN, DAY = 24 * HOUR;

function span(ms: number): string {
  if (ms < HOUR) return `${Math.max(1, Math.round(ms / MIN))} min`;
  if (ms < DAY) return `${Math.round(ms / HOUR)}h`;
  const d = Math.round(ms / DAY);
  return `${d} day${d === 1 ? "" : "s"}`;
}

/** "just now", "5 min ago", "3h ago", "2 days ago". */
export function ago(iso: string, now = Date.now()): string {
  const ms = now - Date.parse(iso);
  return ms < MIN ? "just now" : `${span(ms)} ago`;
}

/** "in 5 min", "in 3h", "soon" when due or overdue. */
export function inTime(iso: string, now = Date.now()): string {
  const ms = Date.parse(iso) - now;
  return ms < MIN ? "soon" : `in ${span(ms)}`;
}
