import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { levelFromXp, type BadgeKey } from "@/lib/gamify/core";
import { env } from "@/lib/env";
import { DemoBadge } from "./demo-badge";
import { BadgesModal } from "./badges-modal";

export async function Header({ userId }: { userId: string }) {
  const supabase = await createClient();
  const [{ data: p }, { data: b }] = await Promise.all([
    supabase.from("profiles").select("xp, streak_days").eq("user_id", userId).single(),
    supabase.from("badges").select("badge_key").eq("user_id", userId),
  ]);
  const xp = p?.xp ?? 0;
  const lvl = levelFromXp(xp);
  return (
    <header className="flex min-h-[72px] flex-wrap items-center gap-x-6 gap-y-2 border-b bg-white px-4 sm:px-8">
      <Link href="/feed" className="text-[22px] font-extrabold tracking-tight">placed<span className="text-primary">.</span></Link>
      <nav className="flex flex-wrap gap-1.5">
        <Link href="/feed" className="flex min-h-11 items-center rounded-[10px] px-3.5 py-2 text-sm font-semibold hover:bg-[#EFEBFF]">Feed</Link>
        <Link href="/tracker" className="flex min-h-11 items-center rounded-[10px] px-3.5 py-2 text-sm font-medium text-[#4A4A57] hover:bg-[#EFEBFF]">Tracker</Link>
        <Link href="/profile" className="flex min-h-11 items-center rounded-[10px] px-3.5 py-2 text-sm font-medium text-[#4A4A57] hover:bg-[#EFEBFF]">Profile</Link>
        {env.autopilot && <Link href="/autopilot/setup" className="flex min-h-11 items-center rounded-[10px] px-3.5 py-2 text-sm font-medium text-[#4A4A57] hover:bg-[#EFEBFF]">Autopilot</Link>}
        <Link href="/settings" className="flex min-h-11 items-center rounded-[10px] px-3.5 py-2 text-sm font-medium text-[#4A4A57] hover:bg-[#EFEBFF]">Settings</Link>
        <BadgesModal earned={(b ?? []).map((x) => x.badge_key as BadgeKey)} />
      </nav>
      <div className="flex-1" />
      <DemoBadge />
      <span className="num-quest flex items-center gap-1.5 text-lg text-[#C2570A]" aria-label={`${p?.streak_days ?? 0}-day streak`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#FF9600" stroke="#C2570A" strokeWidth="1.5" aria-hidden="true"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z" /></svg>
        {p?.streak_days ?? 0}
      </span>
      <span className="num-quest flex items-center gap-1.5 text-lg text-[#9A6B00]" aria-label={`${xp} XP`}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFC800" stroke="#9A6B00" strokeWidth="1.5" aria-hidden="true"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z" /></svg>
        {xp}
      </span>
      <div className="flex items-center gap-2.5">
        <div className="num-quest flex h-[38px] w-[38px] items-center justify-center rounded-full bg-primary text-white shadow-[0_3px_0_#3A20C4]" aria-label={`Level ${lvl.level}`}>{lvl.level}</div>
        <div className="hidden w-[150px] flex-col gap-1 sm:flex">
          <div className="text-xs font-bold">{lvl.name} · {lvl.needed - lvl.intoLevel} XP to level {lvl.level + 1}</div>
          <div className="h-2.5 rounded-full bg-[#E6E6EF]"><div className="h-2.5 rounded-full bg-primary" style={{ width: `${Math.round((lvl.intoLevel / lvl.needed) * 100)}%` }} /></div>
        </div>
      </div>
    </header>
  );
}
