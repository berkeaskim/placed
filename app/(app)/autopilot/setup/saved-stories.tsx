"use client";
import { useState, useTransition } from "react";
import { forgetStory, type SavedStory } from "./story-actions";

/** Answers the cover letter writer remembered, so the student can see what it reuses and drop one. */
export function SavedStories({ stories }: { stories: SavedStory[] }) {
  const [rows, setRows] = useState(stories);
  const [pending, start] = useTransition();
  const [failed, setFailed] = useState(false);
  if (!rows.length) return null;
  const forget = (id: string) => start(async () => {
    setFailed(false);
    try {
      const r = await forgetStory(id);
      if (r.ok) setRows((all) => all.filter((s) => s.id !== id)); else setFailed(true);
    } catch { setFailed(true); }
  });
  return (
    <section aria-label="Saved stories" className="flex flex-col gap-2 rounded-[20px] border bg-white p-5">
      <h2 className="text-lg font-extrabold">Saved stories ({rows.length})</h2>
      <p className="text-sm text-muted-foreground">Answers you gave the cover letter writer. It offers them again next time, so you don&apos;t retype them.</p>
      <ul className="flex flex-col gap-1.5">
        {rows.map((s) => (
          <li key={s.id} className="flex items-start justify-between gap-3 rounded-lg bg-[#F6F6FA] px-3 py-2 text-sm">
            <span className="flex min-w-0 flex-col">
              <span className="font-semibold">{s.kind === "why_firm" ? `Why ${s.company ?? "this firm"}` : "A story from your CV"}</span>
              <span className="break-words">{s.text}</span>
            </span>
            <button type="button" onClick={() => forget(s.id)} disabled={pending} className="min-h-11 shrink-0 rounded-[14px] px-3 text-xs font-bold text-[#7A4100] disabled:opacity-50">
              Forget
            </button>
          </li>
        ))}
      </ul>
      {failed && <p role="alert" className="text-xs font-semibold text-[#7A4100]">Couldn&apos;t forget that one. Try again.</p>}
    </section>
  );
}
