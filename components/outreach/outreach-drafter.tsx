"use client";
import { useState, useTransition } from "react";
import { draftOutreachAction, setOutreachStatus } from "@/app/(app)/outreach/actions";
import { OUTREACH_TARGETS, type OutreachTarget } from "@/lib/outreach/targets";
import type { OutreachDraft, OutreachPurpose } from "@/lib/outreach/draft";

const LABEL: Record<OutreachTarget, string> = { alumni: "UCL alumnus", recent_joiner: "Recent joiner", team: "Team member", recruiter: "Recruiter" };
const PURPOSE: Record<OutreachPurpose, string> = { intro: "First message", follow_up: "Follow-up on my application", interview_prep: "Interview prep" };

function Copy({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false);
  return (
    <button type="button" className="min-h-11 rounded-full border px-3 text-sm font-semibold"
      onClick={async () => {
        try { await navigator.clipboard.writeText(text); } catch { return; }
        setDone(true); setTimeout(() => setDone(false), 1500);
      }}>
      {done ? "Copied" : `Copy ${label}`}
    </button>
  );
}

export function OutreachDrafter({ jobId, initialTarget, initialPurpose }: { jobId: string; initialTarget: OutreachTarget; initialPurpose: OutreachPurpose }) {
  const [target, setTarget] = useState(initialTarget);
  const [purpose, setPurpose] = useState(initialPurpose);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [draft, setDraft] = useState<OutreachDraft | null>(null);
  const [rowId, setRowId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const write = () => start(async () => {
    setError(null); setStatus(null);
    const r = await draftOutreachAction(jobId, { target, purpose, recipientName: name, note });
    if (!r.ok) { setError(r.message); return; }
    setDraft(r.draft); setRowId(r.id);
  });
  const bullets = draft?.questions.map((q) => `• ${q}`).join("\n") ?? "";

  return (
    <div className="flex flex-col gap-3 border-t pt-3">
      <h3 className="text-sm font-bold">Write a message</h3>
      <div className="flex flex-wrap gap-2">
        <label className="flex flex-col text-xs font-semibold">Who
          <select value={target} onChange={(e) => setTarget(e.target.value as OutreachTarget)} className="min-h-11 rounded-lg border px-2 text-sm">
            {OUTREACH_TARGETS.map((t) => <option key={t} value={t}>{LABEL[t]}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-xs font-semibold">Why
          <select value={purpose} onChange={(e) => setPurpose(e.target.value as OutreachPurpose)} className="min-h-11 rounded-lg border px-2 text-sm">
            {(Object.keys(PURPOSE) as OutreachPurpose[]).map((p) => <option key={p} value={p}>{PURPOSE[p]}</option>)}
          </select>
        </label>
        <label className="flex flex-col text-xs font-semibold">First name (optional)
          <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} className="min-h-11 rounded-lg border px-2 text-sm" />
        </label>
      </div>
      <label className="flex flex-col text-xs font-semibold">Anything you share with them? (optional)
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="e.g. we both studied Economics at UCL" className="min-h-11 rounded-lg border px-2 text-sm" />
      </label>
      <button type="button" onClick={write} disabled={pending} className="min-h-11 w-fit rounded-full bg-foreground px-4 text-sm font-bold text-background">
        {pending ? "Writing…" : draft ? "Rewrite" : "Write it"}
      </button>
      {error && <p role="alert" className="text-sm font-semibold text-[#B42318]">{error}</p>}
      {draft && (
        <div className="flex flex-col gap-3">
          {draft.removed.length > 0 && <p className="text-xs text-muted-foreground">We removed {draft.removed.length} line{draft.removed.length === 1 ? "" : "s"} we couldn&apos;t back up from your CV.</p>}
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold">Connection note ({draft.connectionNote.length}/300)</span>
            <p className="whitespace-pre-wrap rounded-xl bg-[#F6F6FA] p-3 text-sm">{draft.connectionNote}</p>
            <Copy text={draft.connectionNote} label="note" />
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-xs font-bold">After they accept</span>
            <p className="whitespace-pre-wrap rounded-xl bg-[#F6F6FA] p-3 text-sm">{draft.coffeeChat}{bullets ? `\n\n${bullets}` : ""}</p>
            <Copy text={bullets ? `${draft.coffeeChat}\n\n${bullets}` : draft.coffeeChat} label="message" />
          </div>
          <p className="text-xs text-muted-foreground">Placed never sends messages. Copy it, send it on LinkedIn yourself, then mark it here.</p>
          {rowId && (
            <div className="flex gap-2">
              {(["sent", "replied"] as const).map((s) => (
                <button key={s} type="button" className="min-h-11 rounded-full border px-3 text-sm font-semibold"
                  onClick={() => start(async () => { if (await setOutreachStatus(rowId, s)) setStatus(s === "sent" ? "Marked as sent." : "Marked as replied."); })}>
                  {s === "sent" ? "I sent it" : "They replied"}
                </button>
              ))}
              {status && <span role="status" className="self-center text-xs">{status}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
