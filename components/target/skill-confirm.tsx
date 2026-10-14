"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { confirmSkill } from "@/app/(app)/profile/target/actions";

/**
 * "Have you really used {skill}?" Nothing is added unless the student says yes and writes where, in their own
 * words. The answer becomes a confirmed fact (tailoring may use it); the CV itself is never edited.
 */
export function SkillConfirm({ options }: { options: string[] }) {
  const [open, setOpen] = useState(false);
  const [skill, setSkill] = useState(options[0]);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const id = `confirm-${options.join("-").replace(/\W+/g, "-")}`;

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="min-h-11 self-start rounded-[12px] border-2 border-[#E6E6EF] px-4 text-sm font-bold hover:bg-[#F6F6FA]">
        I have used {options.length > 1 ? "one of these" : options[0]}
      </button>
    );
  }
  return (
    <form className="flex flex-col gap-2 rounded-xl bg-[#F6F6FA] p-3" onSubmit={(e) => {
      e.preventDefault();
      setError(null);
      start(async () => {
        const r = await confirmSkill(skill, note);
        if ("error" in r) { setError(r.error ?? "Couldn't save that — try again."); return; }
        toast.success(`Saved. Tailoring can now use ${skill}. Add it to your CV too.`);
        setOpen(false);
      });
    }}>
      {options.length > 1 && (
        <label className="flex items-center gap-2 text-sm font-semibold">Which one?
          <select value={skill} onChange={(e) => setSkill(e.target.value)} className="min-h-11 rounded-xl border-2 border-[#E6E6EF] bg-white px-2">
            {options.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      )}
      <label htmlFor={id} className="text-sm font-semibold">
        Where did you use {skill}, and what did you do with it?{" "}
        <span className="font-normal text-[#5B5B6B]">Only if it&apos;s true. We store your words exactly as you write them.</span>
      </label>
      <textarea id={id} required minLength={10} maxLength={500} rows={2} value={note} onChange={(e) => setNote(e.target.value)}
        placeholder="e.g. Second-year stats coursework: cleaned survey data and ran regressions"
        className="rounded-xl border-2 border-[#E6E6EF] bg-white p-2 text-sm" />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="btn-quest min-h-11 px-4 text-sm disabled:opacity-60">{pending ? "Saving…" : "Save"}</button>
        <button type="button" onClick={() => setOpen(false)} className="min-h-11 rounded-[12px] px-4 text-sm font-bold">Cancel</button>
      </div>
    </form>
  );
}
