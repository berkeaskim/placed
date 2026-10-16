import Link from "next/link";
import { COLUMNS } from "@/lib/tracker/status";
import type { AttentionItem, TrackerSummary } from "@/lib/tracker/summary";
import { STATUS_COLOR } from "./status-style";

function Stat({ value, label, hint }: { value: string; label: string; hint: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="num-quest text-[28px] leading-none tracking-tight tabular-nums">{value}</span>
      <span className="text-sm font-bold">{label}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  );
}

/** The pipeline at a glance: one segmented bar (Saved → Offer, Rejected last) and three numbers that matter. */
export function TrackerSummaryPanel({ summary }: { summary: TrackerSummary }) {
  const total = Object.values(summary.counts).reduce((a, b) => a + b, 0);
  return (
    <section aria-label="Your pipeline" className="card-quest flex flex-col gap-5 p-5">
      <div className="flex flex-col gap-2">
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-[#EFEFF5]" role="img"
          aria-label={COLUMNS.map((c) => `${summary.counts[c.key]} ${c.label.toLowerCase()}`).join(", ")}>
          {COLUMNS.map((c) => summary.counts[c.key] > 0 && (
            <span key={c.key} className="h-full transition-[width] duration-500 ease-out first:rounded-l-full last:rounded-r-full"
              style={{ width: `${(summary.counts[c.key] / total) * 100}%`, background: STATUS_COLOR[c.key] }} />
          ))}
        </div>
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {COLUMNS.map((c) => (
            <li key={c.key} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[c.key] }} />
              {c.label} <span className="tabular-nums text-foreground">{summary.counts[c.key]}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid grid-cols-3 gap-4">
        <Stat value={String(summary.active)} label="In play" hint="Everything not rejected" />
        <Stat value={String(summary.movedThisWeek)} label="This week" hint="Cards you moved" />
        <Stat value={summary.heardBackRate === null ? "–" : `${summary.heardBackRate}%`} label="Heard back" hint="Of applications sent" />
      </div>
    </section>
  );
}

/** The few things worth doing today, most urgent first. Each opens the job where the action lives. */
export function NeedsAttention({ items }: { items: AttentionItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="attention-h" className="flex flex-col gap-2">
      <h2 id="attention-h" className="text-sm font-bold">Needs your attention</h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map(({ card, reason, urgent }) => (
          <li key={card.id} className="min-w-0">
            <Link
              href={card.nudge && !card.deadline ? `/jobs/${card.jobId}#people` : `/jobs/${card.jobId}`}
              className="group flex h-full items-start gap-3 rounded-2xl border bg-white p-3 no-underline transition-transform duration-100 ease-out active:scale-[0.98]"
            >
              <span aria-hidden className="mt-1 h-8 w-1 shrink-0 rounded-full" style={{ background: urgent ? STATUS_COLOR.rejected : STATUS_COLOR[card.status] }} />
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-bold text-foreground">{card.title}</span>
                <span className="text-xs text-muted-foreground">{card.company}</span>
                <span className={`text-xs font-semibold ${urgent ? "text-[#B42318]" : "text-foreground"}`}>{reason}</span>
              </span>
              <span aria-hidden className="ml-auto self-center text-muted-foreground transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
