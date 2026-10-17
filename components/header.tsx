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
    // Translucent material over the page: content scrolls under it; the hairline is a soft edge, not a hard border.
    <header className="sticky top-0 z-40 border-b border-black/[0.06] bg-[#FBFBFD]/72 backdrop-blur-xl backdrop-saturate-[1.8] [@media(prefers-reduced-transparency:reduce)]:bg-[#FBFBFD] [@media(prefers-reduced-transparency:reduce)]:backdrop-blur-none">
      <div className="mx-auto flex min-h-[60px] max-w-[1280px] flex-wrap items-center gap-x-5 gap-y-2 px-4 sm:px-8">
        <Link href="/feed" className="text-[21px] font-bold tracking-[-0.03em] text-[#1C1C1E] transition-transform duration-100 ease-out active:scale-[0.97]">placed<span className="text-primary">.</span></Link>
        {/* One scrollable segmented row on phones instead of wrapping into two. */}
        <nav aria-label="Main" className="order-last -mx-4 w-[calc(100%+2rem)] overflow-x-auto px-4 pb-2.5 [scrollbar-width:none] sm:order-none sm:mx-0 sm:w-auto sm:overflow-visible sm:px-0 sm:pb-0">
          <div className="flex w-max gap-0.5 rounded-full bg-[#767680]/[0.12] p-[3px]">
            <NavLinks autopilot={env.autopilot} />
          </div>
        </nav>
        <div className="flex-1" />
        <div className="flex items-center gap-1.5">
          <BadgesModal earned={b.map((x) => x.badge_key as BadgeKey)} />
          <span className={CHIP} aria-label={`${p?.streak_days ?? 0}-day streak`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#FF9500" aria-hidden="true"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-4-1-6 1-10z" /></svg>
            <span className="tabular-nums">{p?.streak_days ?? 0}</span>
          </span>
          <span className={CHIP} aria-label={`${xp} XP`}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#FFB800" aria-hidden="true"><path d="M12 2l3 6.5 7 .8-5.2 4.8 1.4 7L12 17.6 5.8 21l1.4-7L2 9.3l7-.8z" /></svg>
            <span className="tabular-nums">{xp}</span>
          </span>
          <LevelRing level={lvl.level} name={lvl.name} into={lvl.intoLevel} needed={lvl.needed} />
        </div>
      </div>
    </header>
  );
}

const CHIP = "flex h-8 items-center gap-1 rounded-full bg-[#767680]/[0.12] px-2.5 text-[13px] font-semibold tracking-[-0.006em] text-[#1C1C1E]";

/** Level as an Activity-style ring: progress to the next level is the arc, the number sits inside. */
function LevelRing({ level, name, into, needed }: { level: number; name: string; into: number; needed: number }) {
  const r = 14, c = 2 * Math.PI * r, pct = needed > 0 ? Math.min(1, into / needed) : 0;
  return (
    <div className="flex items-center gap-2 pl-1" title={`${name} · ${needed - into} XP to level ${level + 1}`}
      aria-label={`Level ${level}, ${name}, ${needed - into} XP to level ${level + 1}`}>
      <div className="relative h-9 w-9">
        <svg width="36" height="36" viewBox="0 0 36 36" className="-rotate-90" aria-hidden="true">
          <circle cx="18" cy="18" r={r} fill="none" stroke="#5B3DF5" strokeOpacity="0.15" strokeWidth="4" />
          <circle cx="18" cy="18" r={r} fill="none" stroke="#5B3DF5" strokeWidth="4" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[13px] font-bold tabular-nums text-[#1C1C1E]">{level}</span>
      </div>
      <div className="hidden flex-col leading-tight lg:flex">
        <span className="text-[13px] font-semibold tracking-[-0.006em] text-[#1C1C1E]">{name}</span>
        <span className="text-[11px] font-medium text-[#3C3C43]/60 tabular-nums">{needed - into} XP to level {level + 1}</span>
      </div>
    </div>
  );
}
