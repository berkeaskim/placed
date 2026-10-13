import { STATE_COPY, tailoredForRows, type TailoredFor } from "@/lib/tailor/view";
import { CheckIcon, CrossIcon, SurfaceIcon } from "./icons";

const ICON = { check: CheckIcon, surface: SurfaceIcon, cross: CrossIcon } as const;

/** Spec §8.2: 5–8 posting requirements, each covered / made visible / not in your CV (never invented). */
export function TailoredForList({ items }: { items: TailoredFor[] }) {
  const rows = tailoredForRows(items);
  if (!rows.length) return <p className="text-sm text-muted-foreground">This posting doesn&apos;t list skills we can match.</p>;
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {rows.map((t) => {
        const s = STATE_COPY[t.state];
        const Icon = ICON[s.icon];
        return (
          <li key={`${t.section}-${t.requirement}`} className="flex gap-2.5">
            <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${s.bg} ${s.tone}`}><Icon size={14} /></span>
            <div className="flex min-w-0 flex-col">
              <span className="font-bold">{t.requirement}{t.section === "must" && <span className="ml-1.5 text-xs font-semibold text-muted-foreground">must-have</span>}</span>
              <span className={`text-xs font-semibold ${s.tone}`}>{s.label}</span>
              {t.state === "missing" && (
                <a href="#gaps" className="text-xs font-semibold text-[#5B3DF5] underline-offset-2 hover:underline">How to close the gap</a>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
