"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { celebrate } from "@/components/reward-toast";
import { markApplied } from "./actions";

/**
 * Placed never applies for the student: the link opens the company's own posting in a new tab.
 * When the student comes back (tab visible again / window focus) we ask "Did you apply?".
 * `url` is already validated as http(s) on the server; null means there is no usable link.
 */
export function ApplyButton({ jobId, url, company, alreadyApplied }: { jobId: string; url: string | null; company: string; alreadyApplied: boolean }) {
  const awaiting = useRef(false);
  const [ask, setAsk] = useState(false);
  const [applied, setApplied] = useState(alreadyApplied);
  const [pending, start] = useTransition();

  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState !== "visible" || !awaiting.current) return;
      awaiting.current = false;
      setAsk(true);
    };
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    return () => {
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
    };
  }, []);

  if (!url) {
    return <p className="text-sm font-semibold text-muted-foreground">This posting has no application link. Search for the role on {company || "the company"}&apos;s careers site.</p>;
  }

  const yes = () => start(async () => {
    try {
      const r = await markApplied(jobId);
      if (!r.ok) { toast.error(r.error ?? "Couldn't record that — try again."); return; }
      setApplied(true);
      setAsk(false);
      celebrate(r.award);
    } catch {
      toast.error("Couldn't record that — try again.");
    }
  });

  return (
    <>
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => { if (!applied) awaiting.current = true; }}
        className="btn-quest flex min-h-12 items-center justify-center gap-2 px-4 py-3 text-center no-underline">
        {applied ? "Applied · open the posting" : "Apply on company site"}
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      <p className="text-xs text-muted-foreground">You apply on {company ? `${company}'s` : "the company's"} own site. Placed never submits anything for you.</p>
      <Dialog open={ask} onOpenChange={setAsk}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Did you apply?</DialogTitle>
            <DialogDescription>We&apos;ll move it to Applied in your tracker. Nothing is sent to the company.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3">
            <button type="button" disabled={pending} className="btn-quest min-h-12 flex-1 py-3" onClick={yes}>
              {pending ? "Saving…" : "Yes, I applied"}
            </button>
            <button type="button" disabled={pending} className="min-h-12 flex-1 rounded-[14px] border-2 py-3 font-bold" onClick={() => setAsk(false)}>
              Not yet
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
