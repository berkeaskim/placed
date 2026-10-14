"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { FileText, FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { celebrate } from "@/components/reward-toast";
import { AgentSteps, useAgentSteps } from "@/components/agent/agent-steps";
import { ScanLine } from "@/components/agent/reveal";
import { uploadCv } from "./actions";

// The stages uploadCv really runs, in order. CV scoring happens after the response (after()), so it isn't listed.
const STEPS = ["Extracting the text from your PDF", "Checking for hidden text", "Reading your roles and skills", "Saving your profile"] as const;

export function UploadCard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [saved, setSaved] = useState(false);
  const { index, finishing } = useAgentSteps(STEPS.length, pending);
  // Only a clean success ticks the remaining steps off; the checklist stays up until we've left for the profile.
  const showSteps = pending || saved;
  useEffect(() => {
    if (saved && !pending && !finishing) router.push("/profile");
  }, [saved, pending, finishing, router]);

  return (
    <form action={(fd) => start(async () => {
      setError(null);
      setUnreadable(false);
      setSafetyWarning(null);
      setSaved(false);
      const r = await uploadCv(fd);
      if (inputRef.current) inputRef.current.value = ""; // allow re-picking the same file
      if ("error" in r) { setError(r.error); return; }
      celebrate(r.award);
      if (r.imageOnly) { setUnreadable(true); return; }
      if (r.safetyWarning) { setSafetyWarning(r.safetyWarning); return; }
      setSaved(true);
    })} className="flex flex-col gap-4">
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const input = inputRef.current;
          if (!input || pending || saved || !e.dataTransfer.files.length) return;
          input.files = e.dataTransfer.files;
          input.form?.requestSubmit();
        }}
        className={`flex min-h-60 flex-col items-center justify-center gap-4 rounded-[24px] border border-dashed px-6 py-10 text-center shadow-[0_1px_2px_rgba(22,22,29,0.04),0_12px_32px_rgba(22,22,29,0.06)] transition-colors has-[input:focus-visible]:ring-2 has-[input:focus-visible]:ring-[#5B3DF5] has-[input:focus-visible]:ring-offset-2 sm:min-h-72 ${showSteps ? "cursor-progress" : "cursor-pointer"} ${dragging ? "border-[#5B3DF5] bg-[#F8F7FF]" : "border-[#D4D4E0] bg-white hover:border-[#5B3DF5]"}`}
      >
        <span aria-hidden="true" className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-[#EFEBFF] text-[#5B3DF5]">
          {showSteps ? <><FileText className="h-6 w-6" /><ScanLine /></> : <FileUp className="h-6 w-6" />}
        </span>
        {/* Always mounted so screen readers announce each step; the visual checklist below is hidden from them. */}
        <span role="status" aria-live="polite" className="sr-only">{showSteps ? STEPS[Math.min(index, STEPS.length - 1)] : ""}</span>
        {showSteps && <div aria-hidden="true" className="w-full max-w-sm text-left"><AgentSteps steps={STEPS} index={index} label="CV agent" /></div>}
        {!showSteps && (
          <>
            <span className="flex flex-col gap-1">
              <span className="text-[17px] font-semibold">Drop your PDF here</span>
              <span className="text-sm text-muted-foreground">or</span>
            </span>
            <span className="inline-flex min-h-11 items-center rounded-full bg-[#5B3DF5] px-6 text-[15px] font-semibold text-white">Choose a file</span>
          </>
        )}
        <span className="text-[13px] text-muted-foreground">PDF, up to 4 MB · Private, never shared</span>
        <input ref={inputRef} type="file" name="cv" accept="application/pdf" required disabled={pending || saved} className="sr-only" onChange={(e) => e.currentTarget.form?.requestSubmit()} />
      </label>
      {error && <p role="alert" className="text-center text-sm text-destructive">{error}</p>}
      {safetyWarning && (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl bg-[#FFF4E5] p-4 text-sm">
          <p className="font-bold">{safetyWarning}</p>
          <Link href="/profile" className="font-bold text-[#3A20C4] underline">Continue to your profile</Link>
        </div>
      )}
      {unreadable && (
        <div role="alert" className="flex flex-col gap-2 rounded-2xl bg-[#FFF4E5] p-4 text-sm">
          <p className="font-bold">We couldn&apos;t read this CV — try another file or take the quiz.</p>
          <p className="text-muted-foreground">It looks scanned or image-only, so recruiters&apos; screening software can&apos;t read it either.</p>
          <div className="flex gap-4 font-bold">
            <Link href="/profile/quiz" className="text-[#3A20C4] underline">Take the quiz</Link>
            <Link href="/profile?warn=image" className="text-muted-foreground underline">Continue anyway</Link>
          </div>
        </div>
      )}
    </form>
  );
}
