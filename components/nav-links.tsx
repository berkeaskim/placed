"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const BASE = "flex min-h-11 shrink-0 items-center rounded-[10px] px-3.5 py-2 text-sm hover:bg-[#EFEBFF]";

/** Header nav; the current section is bold and marked aria-current (it used to always highlight Feed). */
export function NavLinks({ autopilot }: { autopilot: boolean }) {
  const path = usePathname() ?? "";
  const links = [
    { href: "/feed", label: "Feed", match: ["/feed", "/jobs"] },
    { href: "/tracker", label: "Tracker", match: ["/tracker"] },
    { href: "/strategy", label: "Strategy", match: ["/strategy"] },
    { href: "/profile", label: "Profile", match: ["/profile"] },
    ...(autopilot ? [{ href: "/autopilot/setup", label: "Autopilot", match: ["/autopilot"] }] : []),
    { href: "/settings", label: "Settings", match: ["/settings"] },
  ];
  return links.map((l) => {
    const active = l.match.some((m) => path === m || path.startsWith(`${m}/`));
    return (
      <Link key={l.href} href={l.href} aria-current={active ? "page" : undefined}
        className={`${BASE} ${active ? "bg-[#EFEBFF] font-semibold text-foreground" : "font-medium text-[#4A4A57]"}`}>
        {l.label}
      </Link>
    );
  });
}
