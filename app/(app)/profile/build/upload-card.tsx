"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
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
    })} className="card-quest flex flex-col gap-4 p-6">
      <h2 className="text-xl font-extrabold">Upload your CV</h2>
      <p className="text-sm text-muted-foreground">PDF, up to 5 MB. We read it, score it against recruiter guidance, and never share it.</p>
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
        className={`flex min-h-36 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${dragging ? "border-[#5B3DF5] bg-[#EEEBFF]" : "border-[#C9C2FF] bg-[#F8F7FF]"}`}
      >
        <span className="font-bold">Drop your PDF here or click to choose</span>
        <input ref={inputRef} type="file" name="cv" accept="application/pdf" required disabled={pending} className="sr-only" onChange={(e) => e.currentTarget.form?.requestSubmit()} />
      </label>
      {pending && <p role="status" aria-live="polite" className="font-semibold text-[#3A20C4]">{STEPS[step]}</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
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
