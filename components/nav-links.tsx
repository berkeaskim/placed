"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutGroup, motion, useReducedMotion } from "motion/react";

// Critically damped: the thumb glides to the new section and settles without overshoot.
const SPRING = { type: "spring", bounce: 0, duration: 0.4 } as const;

/** Header nav as an iOS-style segmented control: one sliding thumb marks the current section (aria-current). */
export function NavLinks({ autopilot }: { autopilot: boolean }) {
  const path = usePathname() ?? "";
  const reduce = useReducedMotion();
  const links = [
    { href: "/feed", label: "Feed", match: ["/feed", "/jobs"] },
    { href: "/tracker", label: "Tracker", match: ["/tracker"] },
    { href: "/strategy", label: "Strategy", match: ["/strategy"] },
    { href: "/profile", label: "Profile", match: ["/profile"] },
    ...(autopilot ? [{ href: "/autopilot/setup", label: "Autopilot", match: ["/autopilot"] }] : []),
    { href: "/settings", label: "Settings", match: ["/settings"] },
  ];
  return (
    <LayoutGroup id="header-nav">
      {links.map((l) => {
        const active = l.match.some((m) => path === m || path.startsWith(`${m}/`));
        return (
          <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
            className={`relative flex min-h-9 shrink-0 items-center rounded-full px-3.5 text-[14px] tracking-[-0.006em] transition-[color,transform] duration-100 ease-out active:scale-[0.96] ${active ? "font-semibold text-[#1C1C1E]" : "font-medium text-[#3C3C43]/75 hover:text-[#1C1C1E]"}`}>
            {active && (
              <motion.span layoutId="nav-thumb" aria-hidden="true" transition={reduce ? { duration: 0 } : SPRING}
                className="absolute inset-0 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_2px_8px_-2px_rgba(31,20,90,0.14),0_0_0_0.5px_rgba(0,0,0,0.04)]" />
            )}
            <span className="relative">{l.label}</span>
          </Link>
        );
      })}
    </LayoutGroup>
  );
}
