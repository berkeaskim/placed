"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { importCvAction, importLinkedInCaptureAction, importLinkedInExportAction, importPostsAction, type ImportResult } from "./actions";
import { AI_NOT_SET_UP } from "@/lib/ai/provider";

const btn = "flex min-h-11 items-center rounded-full border-2 border-[#E6E6EF] bg-white px-4 text-sm font-bold hover:bg-[#F6F6FA] disabled:opacity-50";
const CAPTURE_MISSING = "Capture your profile with the extension first";

/** Bring more into the bank: old CVs, LinkedIn (extension capture or PDF export) and pasted LinkedIn posts. Everything lands as suggestions to review. */
export function ImportPanel({ aiOff }: { aiOff: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string; links?: "linkedin" | "ai" } | null>(null);
  const [posts, setPosts] = useState<string[]>([""]);
  const cvRef = useRef<HTMLInputElement>(null);
  const liRef = useRef<HTMLInputElement>(null);

  const report = (r: ImportResult, noun: string) => {
    if ("error" in r) {
      setMsg({ tone: "err", text: r.error, links: r.error === CAPTURE_MISSING ? "linkedin" : r.error === AI_NOT_SET_UP ? "ai" : undefined });
      return;
    }
    const dup = r.duplicates ? ` ${r.duplicates} already in your bank.` : "";
    const drop = r.dropped ? ` ${r.dropped} couldn't be matched to your words and were skipped.` : "";
    setMsg({ tone: "ok", text: r.suggestions ? `${r.suggestions} new suggestion${r.suggestions === 1 ? "" : "s"} from ${noun}. Review them below.${dup}${drop}` : `Nothing new from ${noun}.${dup}${drop}` });
  };
  const run = (fn: () => Promise<ImportResult>, noun: string, after?: () => void) => start(async () => {
    setMsg(null);
    report(await fn(), noun);
    after?.();
  });
  const upload = (field: "cv" | "export", ref: React.RefObject<HTMLInputElement | null>, action: (fd: FormData) => Promise<ImportResult>, noun: string) => {
    const file = ref.current?.files?.[0];
    if (!file) { setMsg({ tone: "err", text: "Choose a PDF first." }); return; }
    const fd = new FormData();
    fd.set(field, file);
    run(() => action(fd), noun, () => { if (ref.current) ref.current.value = ""; });
  };
  const filled = posts.map((p) => p.trim()).filter(Boolean);

  return (
    <section aria-label="Import" data-slot="bank-import" className="mb-6 rounded-2xl border-2 border-[#E6E6EF] bg-white p-4">
      <h2 className="text-base font-extrabold">Add more to your bank</h2>
      <p className="mb-4 text-sm text-[#555]">Nothing is added until you accept it.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="bank-import-cv" className="mb-1 block text-sm font-bold">Another CV (PDF)</label>
          <div className="flex flex-wrap gap-2">
            <input id="bank-import-cv" ref={cvRef} type="file" accept="application/pdf" className="min-h-11 text-sm" />
            <button type="button" className={btn} disabled={pending} onClick={() => upload("cv", cvRef, importCvAction, "that CV")}>Import CV</button>
          </div>
        </div>
        <div>
          <p className="mb-1 text-sm font-bold">LinkedIn</p>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" className={btn} disabled={pending} onClick={() => run(importLinkedInCaptureAction, "LinkedIn")}>Use my captured profile</button>
            <input aria-label="LinkedIn PDF export" ref={liRef} type="file" accept="application/pdf" className="min-h-11 text-sm" />
            <button type="button" className={btn} disabled={pending} onClick={() => upload("export", liRef, importLinkedInExportAction, "LinkedIn")}>Import PDF</button>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <p className="mb-1 text-sm font-bold">LinkedIn posts</p>
        {aiOff ? (
          <p className="text-sm">
            Reading posts needs AI. <Link href="/settings/ai" className="font-bold underline">Set up AI</Link>
          </p>
        ) : (
          <>
            {posts.map((p, i) => (
              <textarea key={i} aria-label={`Post ${i + 1}`} value={p} maxLength={5000} rows={4} disabled={pending}
                onChange={(e) => setPosts(posts.map((x, j) => (j === i ? e.target.value : x)))}
                placeholder="Paste a post about something you built, won or led"
                className="mb-2 w-full rounded-xl border-2 border-[#E6E6EF] bg-white p-3 text-sm" />
            ))}
            <div className="flex flex-wrap gap-2">
              {posts.length < 10 && <button type="button" className={btn} disabled={pending} onClick={() => setPosts([...posts, ""])}>Add another post</button>}
              <button type="button" className={btn} disabled={pending || !filled.length}
                onClick={() => run(() => importPostsAction(filled), "your posts", () => setPosts([""]))}>Find bullets in posts</button>
            </div>
          </>
        )}
      </div>

      {pending && <p role="status" className="mt-3 text-sm font-semibold">Working on it…</p>}
      {msg && (
        <p role={msg.tone === "err" ? "alert" : "status"} className={`mt-3 text-sm font-semibold ${msg.tone === "err" ? "text-[#B3261E]" : ""}`}>
          {msg.text}{" "}
          {msg.links === "linkedin" && <Link href="/profile/linkedin" className="underline">Open LinkedIn</Link>}
          {msg.links === "ai" && <Link href="/settings/ai" className="underline">Set up AI</Link>}
        </p>
      )}
    </section>
  );
}
