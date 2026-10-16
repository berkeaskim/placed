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
      <DialogTrigger className="min-h-11 shrink-0 whitespace-nowrap rounded-[10px] px-3.5 py-2 text-sm font-medium text-[#4A4A57] hover:bg-[#EFEBFF]">
        Badges {earned.length}/5
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
