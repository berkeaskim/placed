"use client";
import confetti from "canvas-confetti";
import { toast } from "sonner";
import { BADGES, type AwardResult } from "@/lib/gamify/core";

function Star() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="#FFC800" stroke="#9A6B00" strokeWidth="1.5" aria-hidden="true">
      <path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z" />
    </svg>
  );
}

export function celebrate(r: AwardResult | null) {
  if (!r || r.xpGained === 0) return;
  const badge = r.newBadges[0] ? BADGES[r.newBadges[0]] : null;
  toast.custom(() => (
    <div role="status" className="card-quest flex w-[340px] items-center gap-3.5 p-4 shadow-xl">
      <div className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-[#FFF4D6]"><Star /></div>
      <div className="flex flex-col gap-0.5">
        <div className="num-quest text-xl text-[#9A6B00]">+{r.xpGained} XP</div>
        <div className="text-sm font-bold">
          {badge ? `Badge unlocked: ${badge.name}` : r.levelUp ? `Level up! You're now a ${r.levelName}` : `${r.streakDays}-day streak`}
        </div>
        {badge && <div className="text-xs text-muted-foreground">{badge.description}</div>}
      </div>
    </div>
  ), { duration: 4000 });
  if (r.levelUp || r.newBadges.length) {
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.8 }, colors: ["#5B3DF5", "#FFC800", "#FF9600", "#0E8A5F"] });
  }
}
