"use client";
import { useState, useTransition } from "react";
import { setJobSearchInterval } from "./job-search-actions";

const LABEL: Record<number, string> = { 0: "Off", 3: "Every 3 hours", 6: "Every 6 hours", 12: "Every 12 hours", 24: "Once a day" };

export function JobSearchSelect({ value, choices }: { value: number; choices: readonly number[] }) {
  const [v, setV] = useState(value);
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const opts = choices.includes(value) ? choices : [...choices, value].sort((a, b) => a - b);
  return (
    <label className="flex flex-wrap items-center gap-3 text-sm font-semibold">
      Look for new postings
      <select value={v} disabled={pending} className="h-11 rounded-[14px] border-2 border-border bg-white px-3 font-semibold"
        onChange={(e) => {
          const next = Number(e.target.value);
          setV(next);
          setMsg(null);
          start(async () => setMsg((await setJobSearchInterval(next)).ok ? "Saved." : "Couldn't save that."));
        }}>
        {opts.map((h) => <option key={h} value={h}>{LABEL[h] ?? `Every ${h} hours`}</option>)}
      </select>
      <span role="status" className="font-normal text-muted-foreground">{msg}</span>
    </label>
  );
}
