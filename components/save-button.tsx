"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { celebrate } from "./reward-toast";
import { saveJob } from "@/app/(app)/jobs/actions";

export function SaveButton({ jobId, initiallySaved }: { jobId: string; initiallySaved: boolean }) {
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, start] = useTransition();
  return (
    <button type="button" aria-pressed={saved} aria-label={saved ? "Saved" : "Save job"} disabled={pending || saved}
      onClick={() => start(async () => {
        try {
          const r = await saveJob(jobId);
          if (!r.ok) { toast.error(r.error ?? "Couldn't save — try again"); return; }
          setSaved(true);
          celebrate(r.award);
        } catch {
          toast.error("Couldn't save — try again");
        }
      })}
      className="flex h-11 w-11 items-center justify-center rounded-xl border hover:bg-[#EFEBFF]">
      <svg width="20" height="20" viewBox="0 0 24 24" fill={saved ? "#5B3DF5" : "none"} stroke="#5B3DF5" strokeWidth="2" aria-hidden="true"><path d="M6 3h12v18l-6-4-6 4z" /></svg>
    </button>
  );
}
