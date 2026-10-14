const DAY = 86_400_000;

export function deadlineLabel(date: string, today: string): { text: string; urgent: boolean } {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY);
  return { text: days <= 0 ? "due today" : days === 1 ? "1 day left" : `${days} days left`, urgent: days <= 1 };
}

export function DeadlineChip({ label, date, today, url }: { label: string; date: string; today: string; url: string | null }) {
  const d = deadlineLabel(date, today);
  const cls = `inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold ${d.urgent ? "bg-[#FEE4E2] text-[#B42318]" : "bg-[#FEF0C7] text-[#93370D]"}`;
  const text = `${label}: ${d.text}`;
  return url
    ? <a href={url} target="_blank" rel="noopener noreferrer" className={`${cls} no-underline`}>{text} ↗</a>
    : <span className={cls}>{text}</span>;
}
