"use client";
import { useState } from "react";
import { canEdit, canReject, hasPlaceholder, placeholderParts, type Decision, type TailorChangeView } from "@/lib/tailor/view";
import { AlertIcon, CheckIcon, PencilIcon, QuoteIcon, UndoIcon } from "./icons";

const SECTION_LABEL: Record<TailorChangeView["section"], string> = {
  experience: "Experience", projects: "Projects", leadership: "Leadership", skills: "Skills", summary: "Profile",
};
const TYPE_LABEL: Record<TailorChangeView["changeType"], string> = {
  kept: "Kept", reordered: "Moved up", rephrased: "Reworded", merged: "Merged", dropped: "Left out",
};

/** A tailored line, with NEEDS_NUMBER shown as a visible blank (never the raw token). */
function Line({ text }: { text: string }) {
  return (
    <>{placeholderParts(text).map((p, i) => p.blank
      ? <span key={i} className="mx-0.5 inline-block min-w-12 rounded-md border-2 border-dashed border-[#C2410C] px-1.5 text-center text-xs font-bold text-[#C2410C]">number?</span>
      : <span key={i}>{p.text}</span>)}</>
  );
}

const btn = "inline-flex min-h-11 items-center gap-1.5 rounded-xl border-2 px-3 text-sm font-bold transition-colors disabled:opacity-50";

/**
 * One change (spec §8.3, B7, B8): before → after, the original CV line(s) it comes from, the posting requirement it
 * serves and why; Accept / Edit / Reject with Undo. A blocked edit is shown reverted, with the claim that blocked it.
 */
export function ChangeCard({ change: c, decision, text, onDecide, onUndo, onConfirmNumber }: {
  change: TailorChangeView; decision: Decision; text: string;
  onDecide: (d: Decision) => void; onUndo: () => void; onConfirmNumber: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);
  const k = decision.kind;
  const shown = k === "rejected" ? c.before : k === "edited" ? decision.text : c.after;
  const needsNumber = k !== "rejected" && hasPlaceholder(shown);
  const tone = k === "rejected" ? "border-[#E6E6EF] bg-[#FAFAFC]" : k === "suggested" ? "border-[#E6E6EF] bg-white" : "border-[#BFE8D6] bg-white";

  return (
    <li className={`flex flex-col gap-2.5 rounded-2xl border-2 p-3.5 text-sm ${tone}`}>
      <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold">
        <span className="rounded-full bg-[#EEEEF2] px-2 py-0.5 text-[#3F3F4C]">{SECTION_LABEL[c.section]}</span>
        <span className="rounded-full bg-[#F4F1FF] px-2 py-0.5 text-[#3A20C4]">{TYPE_LABEL[c.changeType]}</span>
        {c.jdRequirement && <span className="rounded-full bg-[#E6EEFF] px-2 py-0.5 text-[#2340A8]">For: {c.jdRequirement}</span>}
        {k === "accepted" && <span className="ml-auto inline-flex items-center gap-1 text-[#0B6B49]"><CheckIcon size={12} />Accepted</span>}
        {k === "edited" && <span className="ml-auto inline-flex items-center gap-1 text-[#0B6B49]"><PencilIcon size={12} />Your words</span>}
        {k === "rejected" && <span className="ml-auto text-muted-foreground">Kept your original</span>}
      </div>

      {c.changeType !== "reordered" && c.before && k !== "rejected" && (
        <p className="text-muted-foreground line-through decoration-[#9A9AA8]"><span className="sr-only">Before: </span>{c.before}</p>
      )}
      {editing ? (
        <div className="flex flex-col gap-2">
          <label className="sr-only" htmlFor={`edit-${c.bulletId}`}>Edit this line</label>
          <textarea id={`edit-${c.bulletId}`} value={draft} onChange={(e) => setDraft(e.target.value)} rows={3} maxLength={600}
            className="w-full rounded-xl border-2 border-[#C9C9D6] p-2.5 text-sm focus:border-[#5B3DF5] focus:outline-none" />
          <p className="text-xs text-muted-foreground">Use only what you really did. Any new number or tool is checked against your CV before your PDF is made.</p>
          <div className="flex gap-2">
            <button type="button" className="btn-quest min-h-11 px-4 text-sm" disabled={!draft.trim()}
              onClick={() => { onDecide({ kind: "edited", text: draft.trim() }); setEditing(false); }}>Use my version</button>
            <button type="button" className={`${btn} border-[#E6E6EF]`} onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </div>
      ) : (
        <p className={c.changeType === "dropped" && k !== "rejected" ? "italic text-muted-foreground" : "font-semibold"}>
          <span className="sr-only">{k === "rejected" ? "Your original: " : "After: "}</span>
          {c.changeType === "dropped" && k !== "rejected" ? "Left out of this version" : <Line text={shown} />}
        </p>
      )}

      {decision.kind === "rejected" && decision.blockedBy && (
        <p className="flex gap-1.5 rounded-xl bg-[#FFF1DC] px-2.5 py-2 text-xs font-semibold text-[#7A4100]" role="alert">
          <AlertIcon size={14} className="mt-px shrink-0" />
          <span>We put your original line back: &ldquo;{decision.blockedBy.claim}&rdquo; isn&apos;t in your CV. {decision.blockedBy.reason}</span>
        </p>
      )}
      {needsNumber && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl bg-[#FFF4EC] px-2.5 py-2 text-xs text-[#7A3410]">
          <span className="flex-1">We left a blank instead of guessing a number. Until you add the real one, your PDF keeps your original wording.</span>
          <button type="button" onClick={onConfirmNumber} className={`${btn} border-[#C2410C]/40 bg-white text-[#9A3412]`}>Confirm this number</button>
        </div>
      )}

      <p className="text-xs text-[#4A4A57]"><span className="font-bold">Why: </span>{c.reason}</p>
      {c.sources.length > 0 && (
        <div className="flex flex-col gap-1 rounded-xl bg-[#F6F6FA] p-2.5 text-xs">
          <span className="inline-flex items-center gap-1 font-bold text-[#3F3F4C]"><QuoteIcon size={12} />From your original CV</span>
          {c.sources.map((s) => <span key={s.id} className="italic text-[#4A4A57]">&ldquo;{s.text}&rdquo;</span>)}
        </div>
      )}

      {!editing && (
        <div className="flex flex-wrap gap-2">
          {k === "suggested" ? (
            <>
              <button type="button" onClick={() => onDecide({ kind: "accepted" })} className={`${btn} border-[#0E8A5F]/40 text-[#0B6B49] hover:bg-[#E3F6EE]`}><CheckIcon size={14} />Accept</button>
              {canEdit(c) && <button type="button" onClick={() => { setDraft(text); setEditing(true); }} className={`${btn} border-[#E6E6EF] hover:bg-[#F6F6FA]`}><PencilIcon size={14} />Edit</button>}
              {canReject(c) && <button type="button" onClick={() => onDecide({ kind: "rejected" })} className={`${btn} border-[#E6E6EF] text-[#3F3F4C] hover:bg-[#F6F6FA]`}>Keep my original</button>}
            </>
          ) : (
            <>
              <button type="button" onClick={onUndo} className={`${btn} border-[#E6E6EF] hover:bg-[#F6F6FA]`}><UndoIcon size={14} />Undo</button>
              {(k === "accepted" || k === "edited") && canEdit(c) && <button type="button" onClick={() => { setDraft(text); setEditing(true); }} className={`${btn} border-[#E6E6EF] hover:bg-[#F6F6FA]`}><PencilIcon size={14} />Edit</button>}
            </>
          )}
        </div>
      )}
    </li>
  );
}
