"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ARCHETYPES, ARCHETYPE_LABELS, type Archetype } from "@/lib/types";
import type { LiPanelData } from "@/lib/linkedin-score/run";
import { LinkedInScorePanel } from "@/components/linkedin-score-panel";
import { scoreLinkedInLink, uploadLinkedIn, type UploadLinkedInResult } from "./actions";

const STEPS = ["Opening your profile…", "Comparing it with your CV…", "Checking recruiter rules…", "Writing your fixes…"];

function SectorPicker({ value, onChange, disabled }: { value: Archetype; onChange: (a: Archetype) => void; disabled: boolean }) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-sm font-semibold">
      Score it for
      <select name="sector" value={value} disabled={disabled} onChange={(e) => onChange(e.target.value as Archetype)} className="min-h-11 rounded-xl border-2 border-[#E6E6EF] bg-white px-3 py-2 font-semibold">
        {ARCHETYPES.map((a) => <option key={a} value={a}>{ARCHETYPE_LABELS[a]}</option>)}
      </select>
    </label>
  );
}

/** Link form (main path) + PDF fallback + result. Results come straight from the action, so they show even before migration 0013 is applied. */
export function LinkedInView({ initial, sector: initialSector }: { initial: LiPanelData | null; sector: Archetype }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [data, setData] = useState<LiPanelData | null>(initial);
  const [sector, setSector] = useState<Archetype>(initialSector);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [showPdf, setShowPdf] = useState(false);
  const [step, setStep] = useState(0);
  // Controlled: a form action resets uncontrolled fields, which wiped the link whenever scoring returned an error.
  const [url, setUrl] = useState("");
  const run = (fd: FormData, act: (fd: FormData) => Promise<UploadLinkedInResult>) => start(async () => {
    setError(null);
    const r = await act(fd);
    if (inputRef.current) inputRef.current.value = "";
    if ("error" in r) { setError(r.error); if (r.offerPdf) setShowPdf(true); return; }
    setData(r.data);
    if (r.data.saved) router.refresh();
  });
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 2000);
    return () => { clearInterval(t); setStep(0); };
  }, [pending]);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,400px)_1fr]">
      <div className="card-quest flex h-fit flex-col gap-4 p-6">
        <h1 className="text-xl font-extrabold">Score your LinkedIn</h1>
        <form action={(fd) => run(fd, scoreLinkedInLink)} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-semibold">
            Your profile link
            <input
              name="url" type="text" inputMode="url" autoComplete="url" required disabled={pending}
              value={url} onChange={(e) => setUrl(e.target.value)}
              placeholder="linkedin.com/in/your-name"
              className="min-h-12 rounded-xl border-2 border-[#E6E6EF] bg-white px-3 py-2 font-medium outline-none focus:border-[#5B3DF5]"
            />
          </label>
          <SectorPicker value={sector} onChange={setSector} disabled={pending} />
          <button type="submit" disabled={pending} className="btn-quest flex min-h-12 items-center justify-center py-3 disabled:opacity-60">Score my profile</button>
          <p className="text-xs text-[#5B5B6B]">We read your public profile once and don&apos;t keep the page. Your photo, connections and posts are never scored.</p>
        </form>
        {pending && <p role="status" aria-live="polite" className="font-semibold text-[#3A20C4]">{STEPS[step]}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

        <details open={showPdf} onToggle={(e) => setShowPdf(e.currentTarget.open)} className="rounded-2xl border border-[#E6E6EF]">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold">Profile not public? Upload the PDF instead</summary>
          <form action={(fd) => run(fd, uploadLinkedIn)} className="flex flex-col gap-3 px-4 pb-4">
            <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-[#3F3F4C]">
              <li>On a computer, open your LinkedIn profile.</li>
              <li>Click <b>Resources</b> (or <b>More</b>) under your name, then <b>Save to PDF</b>.</li>
              <li>Drop that PDF here.</li>
            </ol>
            <input type="hidden" name="sector" value={sector} />
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
              className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${dragging ? "border-[#5B3DF5] bg-[#EEEBFF]" : "border-[#C9C2FF] bg-[#F8F7FF]"}`}
            >
              <span className="font-bold">Drop your LinkedIn PDF here or click to choose</span>
              <input ref={inputRef} type="file" name="linkedin" accept="application/pdf" required disabled={pending} className="sr-only" onChange={(e) => e.currentTarget.form?.requestSubmit()} />
            </label>
          </form>
        </details>
      </div>

      <section aria-label="LinkedIn Score" className="min-w-0">
        {data ? (
          <LinkedInScorePanel data={data} />
        ) : (
          <div className="flex flex-col gap-2 rounded-[20px] border border-[#E6E6EF] bg-white p-5">
            <h2 className="text-base font-bold">No LinkedIn Score yet</h2>
            <p className="text-sm text-[#5B5B6B]">
              Paste your profile link to see how your profile comes across when a recruiter looks you up, and whether it matches your CV.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
