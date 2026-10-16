import type { AppStatus } from "@/lib/types";
import { deadlineLabel } from "@/components/tracker/deadline-chip";

const DAY = 86_400_000;

export type SummaryCard = {
  id: string; jobId: string; title: string; company: string; status: AppStatus; updatedAt: string;
  deadline: { date: string; label: string } | null; nudge: { text: string } | null;
};

export type TrackerSummary = {
  counts: Record<AppStatus, number>;
  /** Everything still in play: not rejected. */
  active: number;
  /** Cards moved in the last 7 days. */
  movedThisWeek: number;
  /** Share of sent applications that got any answer (interview, offer or rejection); null before anything is sent. */
  heardBackRate: number | null;
};

export function summarize(cards: Pick<SummaryCard, "status" | "updatedAt">[], now: Date): TrackerSummary {
  const counts: Record<AppStatus, number> = { saved: 0, applied: 0, interview: 0, offer: 0, rejected: 0 };
  let movedThisWeek = 0;
  for (const c of cards) {
    counts[c.status]++;
    const t = Date.parse(c.updatedAt);
    if (!Number.isNaN(t) && now.getTime() - t <= 7 * DAY) movedThisWeek++;
  }
  const answered = counts.interview + counts.offer + counts.rejected;
  const sent = counts.applied + answered;
  return {
    counts,
    active: cards.length - counts.rejected,
    movedThisWeek,
    heardBackRate: sent === 0 ? null : Math.round((answered / sent) * 100),
  };
}

export type AttentionItem = { card: SummaryCard; reason: string; urgent: boolean };

/** What to do next, most urgent first: postings closing within 3 days, then networking nudges. At most `limit`. */
export function needsAttention(cards: SummaryCard[], today: string, limit = 4): AttentionItem[] {
  const closing: (AttentionItem & { days: number })[] = [];
  const nudges: AttentionItem[] = [];
  for (const c of cards) {
    if (c.deadline) {
      const days = Math.round((Date.parse(`${c.deadline.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
      if (days >= 0 && days <= 3) {
        const d = deadlineLabel(c.deadline.date, today);
        closing.push({ card: c, reason: `${c.deadline.label}: ${d.text}`, urgent: d.urgent, days });
        continue;
      }
    }
    if (c.nudge) nudges.push({ card: c, reason: c.nudge.text, urgent: false });
  }
  closing.sort((a, b) => a.days - b.days);
  return [...closing.map(({ card, reason, urgent }) => ({ card, reason, urgent })), ...nudges].slice(0, limit);
}

/** "just now", "5m ago", "3h ago", "yesterday", "4d ago", "3w ago", then a short date. */
export function relativeTime(iso: string, now: Date): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, (now.getTime() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < DAY / 1000) return `${Math.floor(s / 3600)}h ago`;
  const days = Math.floor(s / (DAY / 1000));
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 35) return `${Math.floor(days / 7)}w ago`;
  return new Date(t).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Europe/London" });
}
