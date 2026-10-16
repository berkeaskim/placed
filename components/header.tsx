import Link from "next/link";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { badges, profiles } from "@/lib/db/schema";
import { levelFromXp, type BadgeKey } from "@/lib/gamify/core";
import { env } from "@/lib/env";
import { BadgesModal } from "./badges-modal";
import { NavLinks } from "./nav-links";

export function Header({ userId }: { userId: string }) {
  const p = db.select({ xp: profiles.xp, streak_days: profiles.streak_days }).from(profiles).where(eq(profiles.user_id, userId)).get();
  const b = db.select({ badge_key: badges.badge_key }).from(badges).where(eq(badges.user_id, userId)).all();
  const xp = p?.xp ?? 0;
  const lvl = levelFromXp(xp);
  return (
    <header className="flex min-h-[72px] flex-wrap items-center gap-x-6 gap-y-2 border-b bg-white px-4 sm:px-8">
      <Link href="/feed" className="text-[22px] font-extrabold tracking-tight">placed<span className="text-primary">.</span></Link>
      {/* One scrollable row on phones instead of wrapping into two (the header took ~180px at 390px wide). */}
      <nav className="order-last -mx-4 flex w-[calc(100%+2rem)] gap-1.5 overflow-x-auto px-4 pb-2 sm:order-none sm:mx-0 sm:w-auto sm:flex-wrap sm:overflow-visible sm:px-0 sm:pb-0">
        <NavLinks autopilot={env.autopilot} />
        <BadgesModal earned={b.map((x) => x.badge_key as BadgeKey)} />
      </nav>
      <div className="flex-1" />
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
        <div className="hidden w-[170px] flex-col gap-1 sm:flex">
          <div className="whitespace-nowrap text-xs font-bold">{lvl.name} · {lvl.needed - lvl.intoLevel} XP to level {lvl.level + 1}</div>
          <div className="h-2.5 rounded-full bg-[#E6E6EF]"><div className="h-2.5 rounded-full bg-primary" style={{ width: `${Math.round((lvl.intoLevel / lvl.needed) * 100)}%` }} /></div>
        </div>
      </div>
    </header>
  );
}
