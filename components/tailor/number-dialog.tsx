"use client";
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { placeholderParts } from "@/lib/tailor/view";

export type NumberAsk =
  | { kind: "placeholder"; bulletId: string; text: string; original: string }
  | { kind: "caught"; bulletId: string; claim: string; attempted: string; restored: string };
export type NumberChoice = "confirm" | "edit" | "remove" | "keep_original";

const opt = "min-h-11 rounded-xl border-2 border-[#E6E6EF] px-3 text-left text-sm font-bold hover:bg-[#F6F6FA] disabled:opacity-50";

/**
 * Spec §7.3 / B9 "Confirm this number": four outcomes (confirm, edit, remove, keep original wording), never a bare
 * yes/no. A confirmed figure is stored in confirmed_facts as the student's own statement.
 */
export function NumberDialog({ ask, pending, error, onChoose, onClose }: {
  ask: NumberAsk | null; pending: boolean; error: string | null;
  onChoose: (choice: NumberChoice, figure: string) => void; onClose: () => void;
}) {
  const [figure, setFigure] = useState("");
  const open = ask !== null;
  const caught = ask?.kind === "caught";
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { setFigure(""); onClose(); } }}>
      <DialogContent className="sm:max-w-md">
        {ask && (
          <>
            <DialogHeader>
              <DialogTitle>{caught ? <>Is &ldquo;{ask.claim}&rdquo; a real number from your experience?</> : "What's the real number?"}</DialogTitle>
              <DialogDescription>
                {caught
                  ? "We took it out because it isn't in your CV. Only keep it if it's true and you can explain how you measured it."
                  : "We left a blank rather than guess. Only add a figure you can stand behind in an interview."}
              </DialogDescription>
            </DialogHeader>
            <p className="rounded-xl bg-[#F6F6FA] p-3 text-sm">
              {caught ? ask.attempted : placeholderParts(ask.text).map((p, i) => p.blank
                ? <span key={i} className="mx-0.5 rounded-md border-2 border-dashed border-[#C2410C] px-1.5 font-bold text-[#C2410C]">{figure.trim() || "number?"}</span>
                : <span key={i}>{p.text}</span>)}
            </p>
            <div className="flex flex-col gap-2">
              {caught && (
                <button type="button" disabled={pending} className="btn-quest min-h-11 px-3 text-sm" onClick={() => onChoose("confirm", ask.claim)}>
                  Yes, {ask.claim} is accurate
                </button>
              )}
              <div className="flex gap-2">
                <label className="sr-only" htmlFor="real-figure">{caught ? "The correct figure" : "The real figure"}</label>
                <input id="real-figure" value={figure} onChange={(e) => setFigure(e.target.value)} maxLength={40}
                  placeholder={caught ? "The correct figure" : "e.g. 30% or 120 members"} className="min-h-11 flex-1 rounded-xl border-2 border-[#C9C9D6] px-3 text-sm focus:border-[#5B3DF5] focus:outline-none" />
                <button type="button" disabled={pending || !figure.trim()} onClick={() => onChoose(caught ? "edit" : "confirm", figure.trim())}
                  className={caught ? "min-h-11 rounded-xl border-2 border-[#5B3DF5] px-3 text-sm font-bold text-[#3A20C4] disabled:opacity-50" : "btn-quest min-h-11 px-4 text-sm disabled:opacity-50"}>
                  {caught ? "Use this instead" : "It's accurate, add it"}
                </button>
              </div>
              {!caught && <button type="button" disabled={pending} className={opt} onClick={() => onChoose("edit", figure.trim())}>Rewrite the line myself</button>}
              <button type="button" disabled={pending} className={opt} onClick={() => onChoose("remove", "")}>Leave the number out</button>
              <button type="button" disabled={pending} className={opt} onClick={() => onChoose("keep_original", "")}>
                Keep my original wording
                <span className="block text-xs font-normal text-muted-foreground">&ldquo;{caught ? ask.restored : ask.original}&rdquo;</span>
              </button>
            </div>
            {error && <p className="text-sm font-semibold text-[#B42318]" role="alert">{error}</p>}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
