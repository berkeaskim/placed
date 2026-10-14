"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { FileUp, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { celebrate } from "@/components/reward-toast";
import { uploadCv } from "./actions";

const STEPS = ["Reading your CV…", "Spotting your skills…", "Finding your roles…", "Scoring against recruiter rules…"];

export function UploadCard() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [safetyWarning, setSafetyWarning] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1800);
    return () => { clearInterval(t); setStep(0); };
  }, [pending]);

  return (
    <form action={(fd) => start(async () => {
      setError(null);
      setUnreadable(false);
      setSafetyWarning(null);
      const r = await uploadCv(fd);
      if (inputRef.current) inputRef.current.value = ""; // allow re-picking the same file
      if ("error" in r) { setError(r.error); return; }
      celebrate(r.award);
      if (r.imageOnly) { setUnreadable(true); return; }
      if (r.safetyWarning) { setSafetyWarning(r.safetyWarning); return; }
      router.push("/profile");
    })} className="flex flex-col gap-4">
      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const input = inputRef.current;
          if (!input || pending || !e.dataTransfer.files.length) return;
          input.files = e.dataTransfer.files;
          input.form?.requestSubmit();
        }}
        aria-busy={pending}
        className={`flex min-h-60 flex-col items-center justify-center gap-4 rounded-[24px] border border-dashed bg-white px-6 py-10 text-center shadow-[0_1px_2px_rgba(22,22,29,0.04),0_12px_32px_rgba(22,22,29,0.06)] transition-colors focus-within:ring-4 focus-within:ring-[#5B3DF5]/20 sm:min-h-72 ${pending ? "cursor-progress" : "cursor-pointer"} ${dragging ? "border-[#5B3DF5] bg-[#F8F7FF]" : "border-[#D4D4E0] hover:border-[#5B3DF5]"}`}
      >
        <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-full bg-[#EFEBFF] text-[#5B3DF5]">
          {pending ? <LoaderCircle className="h-6 w-6 animate-spin" /> : <FileUp className="h-6 w-6" />}
        </span>
        {pending ? (
          <span role="status" aria-live="polite" className="text-[17px] font-semibold text-[#3A20C4]">{STEPS[step]}</span>
        ) : (
          <>
            <span className="flex flex-col gap-1">
              <span className="text-[17px] font-semibold">Drop your PDF here</span>
              <span className="text-sm text-muted-foreground">or</span>
            </span>
            <span className="inline-flex min-h-11 items-center rounded-full bg-[#5B3DF5] px-6 text-[15px] font-semibold text-white">Choose a file</span>
          </>
        )}
        <span className="text-[13px] text-muted-foreground">PDF, up to 4 MB · Private, never shared</span>
        <input ref={inputRef} type="file" name="cv" accept="application/pdf" required disabled={pending} className="sr-only" onChange={(e) => e.currentTarget.form?.requestSubmit()} />
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
