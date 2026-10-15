"use client";
import { useEffect, useRef, useState, useSyncExternalStore, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ARCHETYPES, ARCHETYPE_LABELS, type Archetype } from "@/lib/types";
import type { LiPanelData } from "@/lib/linkedin-score/run";
import { LinkedInScorePanel } from "@/components/linkedin-score-panel";
import { pollLinkedInCapture, startLinkedInCapture, uploadLinkedIn, type UploadLinkedInResult } from "./actions";

const STEPS = ["Opening your profile…", "Comparing it with your CV…", "Checking recruiter rules…", "Writing your fixes…"];
const EXT_STEPS = ["Opening your profile in a new tab…", "Reading your profile…", "Reading your skills…", "Comparing it with your CV…", "Checking recruiter rules…", "Writing your fixes…"];
const POLL_MS = 2500;
const POLL_FOR_MS = 3 * 60_000;

/** Hands the ticket to the Placed extension (extension/placed-bridge.js) and waits for its answer. */
function armExtension(token: string): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (ok: boolean) => { window.removeEventListener("message", on); clearTimeout(t); resolve(ok); };
    const on = (e: MessageEvent) => { if (e.source === window && e.data?.type === "placed:linkedin-armed") done(Boolean(e.data.ok)); };
    const t = setTimeout(() => done(false), 3000);
    window.addEventListener("message", on);
    window.postMessage({ type: "placed:linkedin-arm", token }, window.location.origin);
  });
}

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

/** One-click extension read (main path) + PDF fallback + result. Results come straight from the action, so they show even before migration 0013 is applied. */
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
  // extension/placed-bridge.js marks <html> at document_start; false during SSR.
  const hasExt = useSyncExternalStore(() => () => {}, () => Boolean(document.documentElement.dataset.placedExtension), () => false);
  const [capturing, setCapturing] = useState(false);
  const [capStep, setCapStep] = useState(0);

  /** Opens the student's own profile (/in/me) in a new tab; the extension reads it there and Placed polls for the score. */
  const scoreWithExtension = async () => {
    setError(null);
    // Open synchronously inside the click, or the pop-up blocker eats it. The ticket is armed right after;
    // the extension waits a few seconds for it.
    const tab = window.open("https://www.linkedin.com/in/me/", "_blank");
    if (!tab) { setError("Your browser blocked the new tab. Allow pop-ups for Placed and try again."); return; }
    try { tab.opener = null; } catch { /* already cross-origin */ }
    setCapturing(true);
    setCapStep(0);
    const fd = new FormData();
    fd.set("sector", sector);
    const r = await startLinkedInCapture(fd);
    if ("error" in r) { setError(r.error); setCapturing(false); return; }
    if (!(await armExtension(r.token))) { setError("The Placed extension didn't answer. Reload this page and try again."); setCapturing(false); return; }
    const stop = Date.now() + POLL_FOR_MS;
    while (Date.now() < stop) {
      await new Promise((res) => setTimeout(res, POLL_MS));
      setCapStep((s) => Math.min(s + 1, EXT_STEPS.length - 1));
      const got = await pollLinkedInCapture(sector, r.since).catch(() => null);
      if (got) { setData(got); setCapturing(false); router.refresh(); return; }
    }
    setCapturing(false);
    setError("We didn't get your profile. Check the LinkedIn tab: you need to be signed in. Then press the button again, or upload the PDF below.");
  };
  const busy = pending || capturing;
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
        <SectorPicker value={sector} onChange={setSector} disabled={busy} />
        {hasExt ? (
          <div className="flex flex-col gap-3">
            <button type="button" onClick={scoreWithExtension} disabled={busy} className="btn-quest flex min-h-12 items-center justify-center py-3 disabled:opacity-60">
              Score my LinkedIn in one click
            </button>
            <p className="text-xs text-[#5B5B6B]">
              Opens your own profile in a new tab, where the Placed extension reads it with your LinkedIn sign-in. It never edits anything,
              never reads your contact info, and your photo, connections and posts are never scored.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5 rounded-2xl bg-[#F8F7FF] p-4 text-sm text-[#3F3F4C]">
            <p className="font-bold text-[#1A1A2E]">One-click scoring needs the Placed extension</p>
            <p>LinkedIn doesn&apos;t show profiles to other sites, so the extension reads yours in your own browser. Add it from <code>chrome://extensions</code> (Load unpacked → the <code>extension</code> folder), then reload this page. Or upload the PDF below.</p>
          </div>
        )}
        {capturing && <p role="status" aria-live="polite" className="font-semibold text-[#3A20C4]">{EXT_STEPS[capStep]}</p>}
        {pending && <p role="status" aria-live="polite" className="font-semibold text-[#3A20C4]">{STEPS[step]}</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <details open={showPdf || !hasExt} onToggle={(e) => setShowPdf(e.currentTarget.open)} className="rounded-2xl border border-[#E6E6EF]">
          <summary className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold">Or upload your LinkedIn PDF</summary>
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
                if (!input || busy || !e.dataTransfer.files.length) return;
                input.files = e.dataTransfer.files;
                input.form?.requestSubmit();
              }}
              className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center transition-colors ${dragging ? "border-[#5B3DF5] bg-[#EEEBFF]" : "border-[#C9C2FF] bg-[#F8F7FF]"}`}
            >
              <span className="font-bold">Drop your LinkedIn PDF here or click to choose</span>
              <input ref={inputRef} type="file" name="linkedin" accept="application/pdf" required disabled={busy} className="sr-only" onChange={(e) => e.currentTarget.form?.requestSubmit()} />
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
              Score your profile to see how it comes across when a recruiter looks you up, and whether it matches your CV.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
