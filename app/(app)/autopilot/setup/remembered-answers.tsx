"use client";
import { useState, useTransition } from "react";
import type { Extra } from "@/lib/autopilot/vault";
import { forgetAnswer } from "./actions";

/** The answers Autopilot learned from earlier forms. Shown so the student can see what it reuses and drop a wrong one. */
export function RememberedAnswers({ extra }: { extra: Extra }) {
  const [rows, setRows] = useState(() => Object.entries(extra));
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  if (!rows.length) return null;
  const forget = (key: string) => start(async () => {
    setFailed(false);
    try {
      const r = await forgetAnswer(key);
      if (r.ok) setRows((all) => all.filter(([k]) => k !== key)); else setFailed(true);
    } catch { setFailed(true); }
  });
  return (
    <section aria-label="Remembered answers" className="flex flex-col gap-2 rounded-[20px] border bg-white p-5">
      <h2 className="text-lg font-extrabold">Remembered answers ({rows.length})</h2>
      <p className="text-sm text-muted-foreground">Answers you gave on earlier forms. Autopilot reuses them, so you only answer each question once.</p>
      <ul className="flex flex-col gap-1.5">
        {rows.map(([q, v]) => (
          <li key={q} className="flex items-start justify-between gap-3 rounded-lg bg-[#F6F6FA] px-3 py-2 text-sm">
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold first-letter:uppercase">{q}</span>
              <span className="break-words">{Array.isArray(v) ? v.join(", ") : v}</span>
            </span>
            <button type="button" onClick={() => forget(q)} disabled={pending} className="min-h-11 shrink-0 rounded-[14px] px-3 text-xs font-bold text-[#7A4100] disabled:opacity-50">
              Forget
            </button>
          </li>
        ))}
      </ul>
      {failed && <p role="alert" className="text-xs font-semibold text-[#7A4100]">Couldn&apos;t forget that one. Try again.</p>}
    </section>
  );
}
