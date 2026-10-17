"use client";
import { useState, useTransition } from "react";
import { setJobSearchDailyAt, setJobSearchInterval } from "./job-search-actions";

const LABEL: Record<number, string> = { 0: "Off", 3: "Every 3 hours", 6: "Every 6 hours", 12: "Every 12 hours", 24: "Once a day" };
const field = "h-11 rounded-[14px] border-2 border-border bg-white px-3 font-semibold";

/** `dailyAt` set → "Every morning at …" is selected; otherwise `value` hours (0 = off). */
export function JobSearchSelect({ value, dailyAt, defaultAt, choices }: {
  value: number; dailyAt: string | null; defaultAt: string; choices: readonly number[];
}) {
  const [v, setV] = useState<string>(dailyAt ? "daily" : String(value));
  const [at, setAt] = useState(dailyAt ?? defaultAt);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const opts = choices.includes(value) ? choices : [...choices, value].sort((a, b) => a - b);
  const save = (fn: () => Promise<{ ok: boolean }>) => {
    setMsg(null);
    start(async () => setMsg((await fn()).ok ? "Saved." : "Couldn't save that."));
  };
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm font-semibold">
      <label className="flex flex-wrap items-center gap-3">
        Look for new postings
        <select value={v} disabled={pending} className={field}
          onChange={(e) => {
            const next = e.target.value;
            setV(next);
            save(() => (next === "daily" ? setJobSearchDailyAt(at) : setJobSearchInterval(Number(next))));
          }}>
          <option value="daily">Every morning</option>
          {opts.map((h) => <option key={h} value={h}>{LABEL[h] ?? `Every ${h} hours`}</option>)}
        </select>
      </label>
      {v === "daily" && (
        <label className="flex items-center gap-2">
          at
          <input type="time" value={at} disabled={pending} className={field} aria-label="Time of the daily refresh"
            onChange={(e) => setAt(e.target.value)}
            onBlur={() => { if (at !== (dailyAt ?? "")) save(() => setJobSearchDailyAt(at)); }} />
        </label>
      )}
      <span role="status" className="font-normal text-muted-foreground">{msg}</span>
    </div>
  );
}
