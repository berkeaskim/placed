"use client";
import { useState, useTransition } from "react";
import type { Extra } from "@/lib/autopilot/vault";
import type { LongAnswerRow } from "@/lib/autopilot/server";
import { forgetAnswer, forgetLongAnswer } from "./actions";

const FORGET = "min-h-11 shrink-0 rounded-[14px] px-3 text-xs font-bold text-[#7A4100] disabled:opacity-50";

/** The answers Autopilot learned from earlier forms. Shown so the student can see what it reuses and drop a wrong one. */
export function RememberedAnswers({ extra, long }: { extra: Extra; long: LongAnswerRow[] }) {
  const [rows, setRows] = useState(() => Object.entries(extra));
  const [longRows, setLongRows] = useState(long);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  if (!rows.length && !longRows.length) return null;
  const forget = (act: () => Promise<{ ok: boolean }>, done: () => void) => start(async () => {
    setFailed(false);
    try {
      if ((await act()).ok) done(); else setFailed(true);
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
            <button type="button" onClick={() => forget(() => forgetAnswer(q), () => setRows((all) => all.filter(([k]) => k !== q)))} disabled={pending} className={FORGET}>
              Forget
            </button>
          </li>
        ))}
      </ul>
      {longRows.length > 0 && (
        <>
          <h3 className="mt-2 text-base font-extrabold">Long answers ({longRows.length})</h3>
          <p className="text-sm text-muted-foreground">Answers you approved for longer questions. A later form with a matching question offers them again.</p>
          <ul className="flex flex-col gap-1.5">
            {longRows.map((r) => (
              <li key={r.id} className="flex items-start justify-between gap-3 rounded-lg bg-[#F6F6FA] px-3 py-2 text-sm">
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">{r.label}</span>
                  {r.company && <span className="text-xs text-muted-foreground">{r.company}</span>}
                  <span className="break-words">{r.preview}{r.preview.length >= 140 ? "…" : ""}</span>
                </span>
                <button type="button" onClick={() => forget(() => forgetLongAnswer(r.id), () => setLongRows((all) => all.filter((x) => x.id !== r.id)))} disabled={pending} className={FORGET}>
                  Forget
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {failed && <p role="alert" className="text-xs font-semibold text-[#7A4100]">Couldn&apos;t forget that one. Try again.</p>}
    </section>
  );
}
