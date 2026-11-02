"use client";
import { useState, useTransition } from "react";
import { forgetStory, type SavedStory } from "./story-actions";
import { Group, Row, btn } from "@/components/ui/apple";

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
    <section aria-label="Saved stories">
      <Group
        title={`Saved stories (${rows.length})`}
        footer={failed ? <span role="alert" className="font-medium text-[#D70015]">Couldn&apos;t forget that one. Try again.</span> : "Answers you gave the cover letter writer. It offers them again next time, so you don't retype them."}
      >
        {rows.map((s) => (
          <Row
            key={s.id}
            title={s.kind === "why_firm" ? `Why ${s.company ?? "this firm"}` : "A story from your CV"}
            subtitle={<span className="break-words">{s.text}</span>}
            trailing={<button type="button" onClick={() => forget(s.id)} disabled={pending} className={`${btn} text-[#D70015]`}>Forget</button>}
          />
        ))}
      </Group>
    </section>
  );
}
