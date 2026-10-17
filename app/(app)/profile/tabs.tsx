import Link from "next/link";
import { TabPending } from "./tab-pending";

const TABS = [
  { href: "/profile", label: "Your roles" },
  { href: "/profile/bank", label: "Experience bank" },
  { href: "/profile/target", label: "Target role" },
  { href: "/profile/linkedin", label: "LinkedIn" },
] as const;

/** "Your roles" | "Experience bank" | "Target role" | "LinkedIn" pill tabs (spec §15.6); the active one is filled black. */
export function ProfileTabs({ active }: { active: (typeof TABS)[number]["href"] }) {
  return (
    <nav aria-label="Profile" className="mb-6 flex gap-2">
      {TABS.map((t) => {
        const on = t.href === active;
        return (
          <Link key={t.href} href={t.href} aria-current={on ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-full px-5 text-sm font-bold ${on ? "bg-foreground text-background" : "border-2 border-[#E6E6EF] bg-white text-foreground hover:bg-[#F6F6FA]"}`}>
            {t.label}
            {!on && <TabPending />}
          </Link>
        );
      })}
    </nav>
  );
}
