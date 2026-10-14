"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { celebrate } from "@/components/reward-toast";
import { completeAction, planAction } from "@/app/(app)/profile/target/actions";
import type { PickedAction } from "@/lib/target/actions";

const TYPE_LABEL = { project: "Project", course: "Course", experience: "Experience" } as const;
const YEAR_LABEL = { "1st": "1st year+", "2nd": "2nd year+", penultimate: "Penultimate+", final: "Final year+", masters: "Masters" } as const;

function TypeIcon({ type }: { type: PickedAction["type"] }) {
  const d = type === "project" ? "M4 7h16M4 12h16M4 17h10" : type === "course" ? "M3 7l9-4 9 4-9 4-9-4zm4 3v5c0 1.5 2.5 3 5 3s5-1.5 5-3v-5" : "M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M4 7h16v12H4z";
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#EFEBFF] text-[#3A20C4]" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
    </span>
  );
}

/** One Role Playbook action (spec §15.6). "I've done this" needs the student's own one-line note; nothing is generated. */
export function ActionCard({ action, builds, planned }: { action: PickedAction; builds: string | null; planned: boolean }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [isPlanned, setPlanned] = useState(planned);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const noteId = `note-${action.id}`, linkId = `link-${action.id}`;

  return (
    <li id={action.id} className="flex scroll-mt-24 flex-col gap-3 rounded-[18px] border border-[#E6E6EF] bg-white p-4">
      <div className="flex items-start gap-3">
        <TypeIcon type={action.type} />
        <div className="flex min-w-0 flex-col gap-1.5">
          <h4 className="font-bold leading-snug">{action.title}</h4>
          <div className="flex flex-wrap gap-1.5 text-xs font-semibold">
            <span className="rounded-full bg-[#F6F6FA] px-2 py-0.5">{TYPE_LABEL[action.type]}</span>
            <span className="rounded-full bg-[#F6F6FA] px-2 py-0.5">{action.effort}</span>
            <span className="rounded-full bg-[#F6F6FA] px-2 py-0.5">{YEAR_LABEL[action.minYear]}</span>
            {action.covers.map((s) => <span key={s} className="rounded-full bg-[#EFEBFF] px-2 py-0.5 text-[#3A20C4]">Builds {s}</span>)}
            {action.type === "project" && <span className="rounded-full bg-[#F6F6FA] px-2 py-0.5 text-[#5B5B6B]">Our suggestion · evidence D</span>}
            {action.stale && <span className="rounded-full bg-[#FFF1DC] px-2 py-0.5 text-[#7A4100]">Dates may have changed — check the official page</span>}
          </div>
        </div>
      </div>
      <p className="text-sm text-[#5B5B6B]">{action.description}</p>
      {builds && <p className="text-xs text-[#5B5B6B]"><span className="font-semibold text-foreground">Builds:</span> {builds}</p>}
      {action.url ? (
        <a href={action.url} target="_blank" rel="noopener noreferrer" className="text-sm font-semibold text-[#3A20C4] underline underline-offset-2">
          Official page<span className="sr-only"> (opens in a new tab)</span>
        </a>
      ) : action.howToFind ? <p className="text-sm"><span className="font-semibold">How to find it:</span> {action.howToFind}</p> : null}

      {!open ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending || isPlanned} aria-pressed={isPlanned}
            onClick={() => start(async () => {
              const r = await planAction(action.id);
              if ("error" in r && r.error) toast.error(r.error); else setPlanned(true);
            })}
            className="min-h-11 rounded-[12px] border-2 border-[#E6E6EF] px-4 text-sm font-bold disabled:opacity-60">
            {isPlanned ? "Planned" : "Plan it"}
          </button>
          <button type="button" onClick={() => setOpen(true)} className="btn-quest min-h-11 px-4 text-sm">I&apos;ve done this</button>
        </div>
      ) : (
        <form className="flex flex-col gap-2" onSubmit={(e) => {
          e.preventDefault();
          setError(null);
          start(async () => {
            const r = await completeAction(action.id, note, link || undefined);
            if ("error" in r && r.error) { setError(r.error); return; }
            celebrate("award" in r ? r.award ?? null : null);
            toast.success("Added to your facts — tailoring can use it now.");
            setOpen(false);
          });
        }}>
          <label htmlFor={noteId} className="text-sm font-semibold">In one line, what did you do? <span className="font-normal text-[#5B5B6B]">(in your own words — this is what tailoring may use)</span></label>
          <textarea id={noteId} required minLength={10} maxLength={500} rows={2} value={note} onChange={(e) => setNote(e.target.value)}
            className="rounded-xl border-2 border-[#E6E6EF] p-2 text-sm" />
          <label htmlFor={linkId} className="text-sm font-semibold">Link <span className="font-normal text-[#5B5B6B]">(optional, https://)</span></label>
          <input id={linkId} type="url" inputMode="url" pattern="https://.*" value={link} onChange={(e) => setLink(e.target.value)}
            className="min-h-11 rounded-xl border-2 border-[#E6E6EF] px-2 text-sm" />
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn-quest min-h-11 px-4 text-sm disabled:opacity-60">{pending ? "Saving…" : "Mark as done"}</button>
            <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-[12px] px-4 text-sm font-bold">Cancel</button>
          </div>
        </form>
      )}
    </li>
  );
}
