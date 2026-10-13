import { aiMode } from "@/lib/env";

export function DemoBadge() {
  if (aiMode() === "live") return null;
  return (
    <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
      Demo mode
    </span>
  );
}
