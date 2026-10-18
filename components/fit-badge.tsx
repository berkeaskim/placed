import type { FitLabel } from "@/lib/types";

type BadgeLabel = FitLabel | "Check eligibility";

const STYLE: Record<BadgeLabel, string> = {
  "Strong fit": "bg-[#E3F6EE] text-[#0B6B49]",
  "Good fit": "bg-[#E6EEFF] text-[#2340A8]",
  Stretch: "bg-[#FFF1DC] text-[#7A4100]",
  "Not recommended": "bg-[#EEEEF2] text-[#3F3F4C]",
  // a failed gate is a question for the student, not a verdict (audit 10#3): no score shown
  "Check eligibility": "bg-[#FFF1DC] text-[#7A4100] ring-1 ring-inset ring-[#E8C48A]",
};

export function FitBadge({ label, score }: { label: BadgeLabel; score?: number }) {
  const showScore = score !== undefined && label !== "Not recommended" && label !== "Check eligibility";
  return <span className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-bold ${STYLE[label]}`}>{label}{showScore ? ` · ${score.toFixed(1)}` : ""}</span>;
}
