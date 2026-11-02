"use client";
import { useState, useTransition } from "react";
import { setJobSearchDailyAt, setJobSearchInterval } from "./job-search-actions";
import { FieldRow, Note, field as appleField, select } from "@/components/ui/apple";

const LABEL: Record<number, string> = { 0: "Off", 3: "Every 3 hours", 6: "Every 6 hours", 12: "Every 12 hours", 24: "Once a day" };

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
    <FieldRow label="Look for new postings" htmlFor="ingest-every" hint={msg ? <Note tone={msg === "Saved." ? "ok" : "error"}>{msg}</Note> : undefined}>
      <select id="ingest-every" value={v} disabled={pending} className={`${select} sm:w-48`}
        onChange={(e) => {
          const next = e.target.value;
          setV(next);
          save(() => (next === "daily" ? setJobSearchDailyAt(at) : setJobSearchInterval(Number(next))));
        }}>
        <option value="daily">Every morning</option>
        {opts.map((h) => <option key={h} value={h}>{LABEL[h] ?? `Every ${h} hours`}</option>)}
      </select>
      {v === "daily" && (
        <input type="time" value={at} disabled={pending} className={`${appleField} w-28 shrink-0`} aria-label="Time of the daily refresh"
          onChange={(e) => setAt(e.target.value)}
          onBlur={() => { if (at !== (dailyAt ?? "")) save(() => setJobSearchDailyAt(at)); }} />
      )}
    </FieldRow>
  );
}
