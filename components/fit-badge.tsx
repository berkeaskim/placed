import type { FitLabel } from "@/lib/types";

const STYLE: Record<FitLabel, string> = {
  "Strong fit": "bg-[#E3F6EE] text-[#0B6B49]",
  "Good fit": "bg-[#E6EEFF] text-[#2340A8]",
  Stretch: "bg-[#FFF1DC] text-[#7A4100]",
  "Not recommended": "bg-[#EEEEF2] text-[#3F3F4C]",
};

export function FitBadge({ label, score }: { label: FitLabel; score?: number }) {
  return <span className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-bold ${STYLE[label]}`}>{label}{score !== undefined && label !== "Not recommended" ? ` · ${score.toFixed(1)}` : ""}</span>;
}
