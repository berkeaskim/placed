"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Check, Play, RotateCcw, Timer, Video } from "lucide-react";
import type { PrepQuestion } from "@/lib/interview-prep/spring-bank";

/**
 * Timed video interview practice with real spring week timings: prep countdown, answer countdown, one take, no pause.
 * The camera is optional; a recording stays in this browser tab as a blob URL and is never uploaded or saved.
 */

type Take = { seconds: number; url: string | null };
type Phase =
  | { kind: "setup" }
  | { kind: "prep"; i: number; ends: number }
  | { kind: "answer"; i: number; ends: number; started: number }
  | { kind: "between"; i: number }
  | { kind: "review" };

export const RUBRIC = [
  "Named something specific (a fact, a person, a number)",
  "STAR structure, with Situation and Task kept short",
  "Said \"I\" for my part, not \"we\"",
  "Gave a result, ideally with a number",
  "Said what I learned or would do differently",
  "Finished inside the time",
  "Spoke to the camera, not from a script",
] as const;

const PRESS = "transition-transform duration-100 ease-out active:scale-[0.97]";
/** Wall clock, read only from event handlers and timers. */
const clock = () => Date.now();
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, "0")}`;

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [active]);
  return now;
}

export function VideoPractice({ questions, prepSeconds, answerSeconds, onRestart }: {
  questions: PrepQuestion[]; prepSeconds: number; answerSeconds: number; onRestart: () => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "setup" });
  const [takes, setTakes] = useState<Take[]>([]);
  const [useCamera, setUseCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  // The camera stream is state (the preview renders from it); the recorder, chunks, timer and URLs are bookkeeping.
  const [live, setLiveState] = useState<MediaStream | null>(null);
  // Timers fire closures from an earlier render, so the recorder reads the stream from a ref.
  const liveRef = useRef<MediaStream | null>(null);
  const setLive = (s: MediaStream | null) => { liveRef.current = s; setLiveState(s); };
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const urls = useRef<string[]>([]);
  const now = useNow(phase.kind === "prep" || phase.kind === "answer");

  const clearTimer = () => { if (timer.current) clearTimeout(timer.current); timer.current = null; };

  // Release the camera, the clock and the recordings when the practice goes away.
  useEffect(() => () => {
    clearTimer();
    urls.current.forEach((u) => URL.revokeObjectURL(u));
  }, []);
  useEffect(() => () => live?.getTracks().forEach((t) => t.stop()), [live]);

  const startRecording = () => {
    const stream = liveRef.current;
    if (!stream || typeof MediaRecorder === "undefined") return;
    chunks.current = [];
    const r = new MediaRecorder(stream);
    r.ondataavailable = (e) => { if (e.data.size) chunks.current.push(e.data); };
    r.start();
    recorder.current = r;
  };

  const stopRecording = (): Promise<string | null> => new Promise((resolve) => {
    const r = recorder.current;
    recorder.current = null;
    if (!r || r.state === "inactive") return resolve(null);
    r.onstop = () => {
      const url = chunks.current.length ? URL.createObjectURL(new Blob(chunks.current, { type: r.mimeType || "video/webm" })) : null;
      if (url) urls.current.push(url);
      resolve(url);
    };
    r.stop();
  });

  // The clock moves you on, as in the real thing: prep runs out into the answer, the answer runs out into the next step.
  const prep = (i: number) => {
    clearTimer();
    setPhase({ kind: "prep", i, ends: clock() + prepSeconds * 1000 });
    timer.current = setTimeout(() => answer(i), prepSeconds * 1000);
  };

  const answer = (i: number) => {
    clearTimer();
    const started = clock();
    startRecording();
    setPhase({ kind: "answer", i, ends: started + answerSeconds * 1000, started });
    timer.current = setTimeout(() => void finish(i, started), answerSeconds * 1000);
  };

  const finish = async (i: number, started: number) => {
    clearTimer();
    const seconds = Math.min(answerSeconds, Math.round((Date.now() - started) / 1000));
    setPhase({ kind: "between", i });
    const url = await stopRecording();
    setTakes((ts) => [...ts, { seconds, url }]);
    if (i + 1 >= questions.length) {
      setLive(null);
      setPhase({ kind: "review" });
    }
  };

  const begin = async () => {
    setCameraError(null);
    if (useCamera) {
      try {
        setLive(await navigator.mediaDevices.getUserMedia({ video: true, audio: true }));
      } catch {
        setCameraError("We couldn't open your camera, so this run is timer only. Check your browser's camera permission to record.");
      }
    }
    setTakes([]);
    setChecks({});
    prep(0);
  };

  const restart = () => {
    clearTimer();
    setLive(null);
    urls.current.forEach((u) => URL.revokeObjectURL(u));
    urls.current = [];
    setTakes([]);
    setPhase({ kind: "setup" });
    onRestart();
  };


  if (phase.kind === "setup") {
    return (
      <div className="flex flex-col gap-4 rounded-[18px] bg-[#F6F5FB] p-4 sm:p-5">
        <dl className="grid grid-cols-3 gap-2 text-center">
          {[[questions.length, "questions"], [`${prepSeconds}s`, "to prepare"], [`${answerSeconds}s`, "to answer"]].map(([v, l]) => (
            <div key={l} className="flex flex-col gap-0.5 rounded-[14px] bg-white px-2 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
              <dd className="text-[22px] font-semibold leading-none tracking-[-0.02em] tabular-nums text-[#1C1C1E]">{v}</dd>
              <dt className="text-[12px] text-[#6E6E73]">{l}</dt>
            </div>
          ))}
        </dl>
        <p className="text-[14px] leading-[1.43] text-[#3C3C43]">One take per question and no pausing, like the real thing. You see each question only when its prep time starts.</p>
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[12px] bg-white px-3.5 py-2.5 text-[14px] text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
          <input type="checkbox" checked={useCamera} onChange={(e) => setUseCamera(e.target.checked)} className="h-4 w-4 accent-[#5B3DF5]" />
          <span className="flex-1">Record myself so I can watch it back <span className="text-[#8E8E93]">(stays in this tab, never uploaded)</span></span>
          {useCamera ? <Camera className="h-4 w-4 text-[#5B3DF5]" aria-hidden="true" /> : <CameraOff className="h-4 w-4 text-[#8E8E93]" aria-hidden="true" />}
        </label>
        <button type="button" onClick={begin} className={`inline-flex min-h-12 items-center justify-center gap-2 self-start rounded-full bg-[#5B3DF5] px-6 text-[16px] font-semibold text-white shadow-[0_6px_16px_-6px_rgba(91,61,245,0.6)] hover:bg-[#4E31E6] ${PRESS}`}>
          <Play className="h-4 w-4" aria-hidden="true" /> Start practice interview
        </button>
      </div>
    );
  }

  if (phase.kind === "review") {
    const total = takes.reduce((n, t) => n + t.seconds, 0);
    return (
      <div className="flex flex-col gap-4 rounded-[18px] bg-[#F6F5FB] p-4 sm:p-5">
        <p className="text-[15px] font-semibold text-[#1C1C1E]">Done: {questions.length} answers in {fmt(total)}. Watch them back and tick what you did.</p>
        <ol className="flex flex-col gap-3">
          {questions.map((q, i) => {
            const t = takes[i];
            return (
              <li key={q.id} className="flex flex-col gap-3 rounded-[14px] bg-white p-3.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[15px] font-medium leading-snug text-[#1C1C1E]">{i + 1}. {q.text}</p>
                  {t && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums ${t.seconds < Math.min(60, answerSeconds / 2) ? "bg-[#FFF4E5] text-[#7A4100]" : "bg-[#E3F6EE] text-[#0B6B49]"}`}>{fmt(t.seconds)}</span>}
                </div>
                {t?.url && <video src={t.url} controls playsInline className="aspect-video w-full max-w-md rounded-[10px] bg-black" />}
                <fieldset className="flex flex-col gap-1">
                  <legend className="mb-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#8E8E93]">Self-check</legend>
                  {RUBRIC.map((r) => {
                    const k = `${q.id}:${r}`;
                    return (
                      <label key={r} className="flex min-h-8 cursor-pointer items-center gap-2 text-[13px] text-[#3C3C43]">
                        <input type="checkbox" checked={Boolean(checks[k])} onChange={(e) => setChecks((c) => ({ ...c, [k]: e.target.checked }))} className="h-4 w-4 accent-[#5B3DF5]" />
                        {r}
                      </label>
                    );
                  })}
                </fieldset>
              </li>
            );
          })}
        </ol>
        <button type="button" onClick={restart} className={`inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-white px-5 text-[15px] font-semibold text-[#5B3DF5] shadow-[0_0_0_1px_rgba(91,61,245,0.25)] ${PRESS}`}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" /> Practise with new questions
        </button>
      </div>
    );
  }

  const i = phase.i;
  const q = questions[i];
  const remaining = phase.kind === "prep" || phase.kind === "answer" ? Math.max(0, Math.ceil((phase.ends - now) / 1000)) : 0;
  const total = phase.kind === "prep" ? prepSeconds : answerSeconds;
  const recording = phase.kind === "answer" && Boolean(live);

  return (
    <div className="flex flex-col gap-4 rounded-[18px] bg-[#1C1C1E] p-4 text-white sm:p-5" aria-live="polite">
      <div className="flex items-center justify-between gap-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-white/60">
        <span>Question {i + 1} of {questions.length}</span>
        {phase.kind !== "between" && (
          <span className={`inline-flex items-center gap-1.5 ${phase.kind === "answer" ? "text-[#FF6B6B]" : "text-[#B9A8FF]"}`}>
            {phase.kind === "answer" ? <Video className="h-3.5 w-3.5" aria-hidden="true" /> : <Timer className="h-3.5 w-3.5" aria-hidden="true" />}
            {phase.kind === "answer" ? (recording ? "Recording" : "Answering") : "Preparing"}
          </span>
        )}
      </div>
      {cameraError && <p className="rounded-[10px] bg-white/10 px-3 py-2 text-[13px] text-white/80" role="note">{cameraError}</p>}

      {phase.kind === "between" ? (
        i + 1 < questions.length && (
          <div className="flex flex-col items-start gap-3">
            <p className="text-[17px] font-semibold">Answer saved. No retakes.</p>
            <button type="button" onClick={() => prep(i + 1)} className={`inline-flex min-h-11 items-center gap-2 rounded-full bg-white px-5 text-[15px] font-semibold text-[#1C1C1E] ${PRESS}`}>
              Next question
            </button>
          </div>
        )
      ) : (
        <>
          <p className="text-[20px] font-semibold leading-[1.3] tracking-[-0.015em] sm:text-[22px]">{q.text}</p>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-[40px] font-semibold leading-none tabular-nums tracking-[-0.03em]" aria-label={`${remaining} seconds left`}>{fmt(remaining)}</span>
            <div className="h-1.5 min-w-[120px] flex-1 overflow-hidden rounded-full bg-white/15">
              <div className={`h-full rounded-full ${phase.kind === "answer" ? "bg-[#FF6B6B]" : "bg-[#B9A8FF]"}`} style={{ width: `${(remaining / total) * 100}%`, transition: "width 200ms linear" }} />
            </div>
          </div>
          {live && <video ref={(el) => { if (el && el.srcObject !== live) el.srcObject = live; }} autoPlay muted playsInline className="aspect-video w-full max-w-xs -scale-x-100 rounded-[10px] bg-black" />}
          {phase.kind === "prep"
            ? <button type="button" onClick={() => answer(i)} className={`inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-white px-5 text-[15px] font-semibold text-[#1C1C1E] ${PRESS}`}>Start answering now</button>
            : <button type="button" onClick={() => void finish(i, phase.started)} className={`inline-flex min-h-11 items-center gap-2 self-start rounded-full bg-white px-5 text-[15px] font-semibold text-[#1C1C1E] ${PRESS}`}><Check className="h-4 w-4" aria-hidden="true" /> Finish answer</button>}
        </>
      )}
    </div>
  );
}
