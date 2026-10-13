import { MYTHS } from "@/lib/cv-rules/myths";
import { mythLinks } from "@/lib/quiz/view";

/** "Myth vs evidence" (ruling C19): popular CV myths, the evidence-based verdict, and cited sources. */
const PICKS = ["M1", "M13", "M6"]; // M13 supersedes M2 (6-second scan) with better evidence

function External() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 3h6v6" /><path d="M10 14 21 3" /><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}

export function MythCard() {
  const myths = PICKS.map((id) => MYTHS.find((m) => m.id === id)).filter((m): m is (typeof MYTHS)[number] => !!m);
  if (!myths.length) return null;
  return (
    <section aria-labelledby="myth-h" className="flex flex-col gap-4 rounded-[20px] border border-[#E6E6EF] bg-white p-5">
      <h2 id="myth-h" className="text-base font-bold">Myth vs evidence</h2>
      <ul className="flex flex-col gap-4">
        {myths.map((m) => {
          const links = mythLinks(m.sources);
          return (
            <li key={m.id} className="flex flex-col gap-1.5">
              <p className="text-sm font-semibold">
                <span className="mr-1.5 text-xs font-bold uppercase tracking-wide text-[#C2410C]">Myth</span>
                <span className="line-through decoration-[#C2410C]/60">{m.myth}</span>
              </p>
              <p className="text-sm text-[#3F3F4C]">
                <span className="mr-1.5 text-xs font-bold uppercase tracking-wide text-[#0E8A5F]">Evidence</span>
                {m.verdict}
              </p>
              {links.length > 0 && (
                <div className="flex flex-wrap gap-x-2">
                  {links.map((l) => (
                    <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
                      className="group/chip inline-flex min-h-11 items-center no-underline focus-visible:outline-2 focus-visible:outline-[#5B3DF5]">
                      <span className="inline-flex items-center gap-1 rounded-lg bg-[#F2F2F7] px-2.5 py-1 text-xs font-semibold text-[#3F3F4C] group-hover/chip:bg-[#E9E9F1]">
                        {l.label}<External /><span className="sr-only">(opens in a new tab)</span>
                      </span>
                    </a>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
