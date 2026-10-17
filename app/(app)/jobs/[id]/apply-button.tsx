"use client";
import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AppliedChip, useMarkApplied } from "@/components/mark-applied";

/**
 * Placed never applies for the student: the link opens the company's own posting in a new tab.
 * When the student comes back (tab visible again / window focus) we ask "Did you apply?".
 * Students who applied elsewhere (or before Placed) can mark it directly. Both paths share useMarkApplied.
 * `url` is already validated as http(s) on the server; null means there is no usable link.
 */
export function ApplyButton({ jobId, url, company, alreadyApplied, curated = false }: { jobId: string; url: string | null; company: string; alreadyApplied: boolean; curated?: boolean }) {
  const awaiting = useRef(false);
  const [ask, setAsk] = useState(false);
  const { applied, pending, mark } = useMarkApplied(jobId, alreadyApplied);

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

  const markRow = applied ? (
    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground"><AppliedChip />It&apos;s in the Applied column of your tracker.</div>
  ) : (
    <button type="button" disabled={pending} onClick={() => mark()}
      className="min-h-11 rounded-[14px] border-2 border-[#0E8A5F]/40 px-4 py-2 text-sm font-bold text-[#0B6B49] hover:bg-[#E3F6EE] disabled:opacity-60">
      {pending ? "Saving…" : "Already applied? Mark as applied"}
    </button>
  );

  if (!url) {
    return (
      <>
        <p className="text-sm font-semibold text-muted-foreground">This posting has no application link. Search for the role on {company || "the company"}&apos;s careers site.</p>
        {markRow}
      </>
    );
  }

  const yes = () => mark(() => setAsk(false));
  const arrow = <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17L17 7M9 7h8v8" /></svg>;

  // A curated card points at the employer's programme page, not a live posting: opening it is not applying,
  // so there is no "Did you apply?" prompt. The student can still mark it applied themselves.
  if (curated) {
    return (
      <>
        <a href={url} target="_blank" rel="noopener noreferrer"
          className="btn-quest flex min-h-12 items-center justify-center gap-2 px-4 py-3 text-center no-underline">
          Official programme page
          {arrow}
          <span className="sr-only">(opens in a new tab)</span>
        </a>
        {markRow}
        <p className="text-xs text-muted-foreground">A curated programme page, not a live posting. Check {company ? `${company}'s` : "the employer's"} site for when applications open.</p>
      </>
    );
  }

  return (
    <>
      <a href={url} target="_blank" rel="noopener noreferrer" onClick={() => { if (!applied) awaiting.current = true; }}
        className="btn-quest flex min-h-12 items-center justify-center gap-2 px-4 py-3 text-center no-underline">
        {applied ? "Applied · open the posting" : "Apply on company site"}
        {arrow}
        <span className="sr-only">(opens in a new tab)</span>
      </a>
      {markRow}
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
