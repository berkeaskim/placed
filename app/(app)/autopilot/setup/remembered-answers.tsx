"use client";
import { useState, useTransition } from "react";
import type { Extra } from "@/lib/autopilot/vault";
import type { LongAnswerRow } from "@/lib/autopilot/server";
import { forgetAnswer, forgetLongAnswer } from "./actions";
import { Group, Row, btn } from "@/components/ui/apple";

const FORGET = `${btn} text-[#D70015]`;

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
  const failNote = failed ? <span role="alert" className="font-medium text-[#D70015]">Couldn&apos;t forget that one. Try again.</span> : null;
  return (
    <section aria-label="Remembered answers" className="flex flex-col gap-6">
      {rows.length > 0 && (
        <Group title={`Remembered answers (${rows.length})`} footer={failNote ?? "Answers you gave on earlier forms. Autopilot reuses them, so you only answer each question once."}>
          {rows.map(([q, v]) => (
            <Row
              key={q}
              title={<span className="block first-letter:uppercase">{q}</span>}
              subtitle={<span className="break-words">{Array.isArray(v) ? v.join(", ") : v}</span>}
              trailing={<button type="button" onClick={() => forget(() => forgetAnswer(q), () => setRows((all) => all.filter(([k]) => k !== q)))} disabled={pending} className={FORGET}>Forget</button>}
            />
          ))}
        </Group>
      )}
      {longRows.length > 0 && (
        <Group title={`Long answers (${longRows.length})`} footer={rows.length ? undefined : (failNote ?? undefined)}>
          {longRows.map((r) => (
            <Row
              key={r.id}
              title={r.label}
              subtitle={
                <>
                  {r.company && <span className="block text-black/40">{r.company}</span>}
                  <span className="break-words">{r.preview}{r.preview.length >= 140 ? "…" : ""}</span>
                </>
              }
              trailing={<button type="button" onClick={() => forget(() => forgetLongAnswer(r.id), () => setLongRows((all) => all.filter((x) => x.id !== r.id)))} disabled={pending} className={FORGET}>Forget</button>}
            />
          ))}
        </Group>
      )}
    </section>
  );
}
