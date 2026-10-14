"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ARCHETYPES, ARCHETYPE_LABELS, type Archetype } from "@/lib/types";
import type { LiPanelData } from "@/lib/linkedin-score/run";
import { LinkedInScorePanel } from "@/components/linkedin-score-panel";
import { uploadLinkedIn } from "./actions";

const STEPS = ["Reading your profile…", "Comparing it with your CV…", "Checking recruiter rules…", "Writing your fixes…"];

/** Upload card + result. The result comes straight from the action, so it shows even before migration 0013 is applied. */
export function LinkedInView({ initial, sector: initialSector }: { initial: LiPanelData | null; sector: Archetype }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<LiPanelData | null>(initial);
  const [sector, setSector] = useState<Archetype>(initialSector);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2000);
    return () => { clearInterval(t); setStep(0); };
  }, [pending]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
      <form
        action={(fd) => start(async () => {
          setError(null);
          const r = await uploadLinkedIn(fd);
          if (inputRef.current) inputRef.current.value = "";
          if ("error" in r) { setError(r.error); return; }
          setData(r.data);
          if (r.data.saved) router.refresh();
        })}
        className="card-quest flex h-fit flex-col gap-4 p-6"
      >
        <h1 className="text-xl font-extrabold">Score your LinkedIn</h1>
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-[#3F3F4C]">
          <li>On a computer, open your LinkedIn profile.</li>
          <li>Click <b>Resources</b> (or <b>More</b>) under your name, then <b>Save to PDF</b>.</li>
          <li>Drop that PDF here.</li>
        </ol>
        <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
          Score it for
          <select name="sector" value={sector} disabled={pending} onChange={(e) => setSector(e.target.value as Archetype)} className="min-h-11 rounded-xl border-2 border-[#E6E6EF] bg-white px-3 py-2 font-semibold">
            {ARCHETYPES.map((a) => <option key={a} value={a}>{ARCHETYPE_LABELS[a]}</option>)}
          </select>
        </label>
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
          className={`flex min-h-32 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${dragging ? "border-[#5B3DF5] bg-[#EEEBFF]" : "border-[#C9C2FF] bg-[#F8F7FF]"}`}
        >
          <span className="font-bold">Drop your LinkedIn PDF here or click to choose</span>
          <span className="text-xs text-muted-foreground">We read it, score it and delete the file. Your photo, connections and posts are never scored.</span>
          <input ref={inputRef} type="file" name="linkedin" accept="application/pdf" required disabled={pending} className="sr-only" onChange={(e) => e.currentTarget.form?.requestSubmit()} />
        </label>
        {pending && <p role="status" aria-live="polite" className="font-semibold text-[#3A20C4]">{STEPS[step]}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      </form>

      <section aria-label="LinkedIn Score" className="min-w-0">
        {data ? (
          <LinkedInScorePanel data={data} />
        ) : (
          <div className="flex flex-col gap-2 rounded-[20px] border border-[#E6E6EF] bg-white p-5">
            <h2 className="text-base font-bold">No LinkedIn Score yet</h2>
            <p className="text-sm text-[#5B5B6B]">
              Upload your export to see how your profile comes across when a recruiter looks you up, and whether it matches your CV.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
