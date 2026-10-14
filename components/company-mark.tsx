import { companyDisplay } from "@/lib/jobs/company";

const SIZES = {
  md: { box: "h-10 w-10 rounded-[12px] text-base", name: "text-[15px]" },
  lg: { box: "h-12 w-12 rounded-[14px] text-lg", name: "text-base sm:text-[17px]" },
} as const;

/** Company avatar (initial) + name, so every job says whose it is. Falls back to a URL guess, then a neutral label. */
export function CompanyMark({ company, url, size = "md" }: { company: string | null | undefined; url: string | null | undefined; size?: keyof typeof SIZES }) {
  const c = companyDisplay({ company, url });
  const s = SIZES[size];
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span aria-hidden="true" className={`flex shrink-0 items-center justify-center bg-[#EFEBFF] font-extrabold text-[#3A20C4] ${s.box}`}>{c.initial}</span>
      <span className={`truncate font-bold ${s.name} ${c.fallback ? "text-[#4A4A57]" : "text-foreground"}`}>{c.name}</span>
    </div>
  );
}
