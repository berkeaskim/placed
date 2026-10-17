"use client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { BADGES, type BadgeKey } from "@/lib/gamify/core";

function Mark({ earned }: { earned: boolean }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={earned ? "#0E8A5F" : "#8A8A99"} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {earned ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></>}
    </svg>
  );
}

export function BadgesModal({ earned }: { earned: BadgeKey[] }) {
  return (
    <Dialog>
      <DialogTrigger aria-label={`Badges, ${earned.length} of 5 earned`} className="flex h-8 shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-[#767680]/[0.12] px-2.5 text-[13px] font-semibold tracking-[-0.006em] text-[#1C1C1E] transition-transform duration-100 ease-out hover:bg-[#767680]/[0.18] active:scale-[0.96]">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="#5B3DF5" aria-hidden="true"><path d="M12 2l2.4 2.1 3.2-.3.7 3.1 2.8 1.6-1.3 2.9 1.3 2.9-2.8 1.6-.7 3.1-3.2-.3L12 20.8l-2.4-2.1-3.2.3-.7-3.1-2.8-1.6L4.2 11.4 2.9 8.5l2.8-1.6.7-3.1 3.2.3z" /></svg>
        <span className="tabular-nums">{earned.length}/5</span>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Your badges</DialogTitle></DialogHeader>
        <ul className="grid gap-3">
          {(Object.keys(BADGES) as BadgeKey[]).map((k) => (
            <li key={k} className={`card-quest flex items-center gap-3 p-3 ${earned.includes(k) ? "" : "opacity-50"}`}>
              <Mark earned={earned.includes(k)} />
              <div><div className="font-bold">{BADGES[k].name}</div><div className="text-sm text-muted-foreground">{BADGES[k].description}</div></div>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
