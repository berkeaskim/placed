import type { Signal } from "@/lib/playbooks";

const GRADE = {
  A: { cls: "bg-[#E3F6EE] text-[#0E6B4A]", label: "Evidence A" },
  B: { cls: "bg-[#E3F6EE] text-[#0E6B4A]", label: "Evidence B" },
  C: { cls: "bg-[#FFF1DC] text-[#7A4100]", label: "Convention (C)" },
  D: { cls: "bg-[#F0F0F5] text-[#5B5B6B]", label: "Our view (D)" },
} as const;

/** "What employers look for": the signal, its evidence grade, and each source's verbatim quote (spec §15.2). */
export function SignalCard({ signal }: { signal: Signal }) {
  const g = GRADE[signal.grade];
  const single = signal.sources.length === 1 && (signal.grade === "C" || signal.grade === "D");
  return (
    <li className="flex flex-col gap-2 rounded-[18px] border border-[#E6E6EF] bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold">{signal.text}</p>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${g.cls}`}>{single ? "Convention" : g.label}</span>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {signal.sources.map((s, k) => (
          <li key={k}>
            <details className="group text-xs">
              <summary className="flex min-h-8 cursor-pointer list-none items-center rounded-full border border-[#E6E6EF] px-2.5 font-semibold hover:bg-[#F6F6FA]">
                {s.publisher ?? s.title ?? "Source"}
              </summary>
              <div className="mt-1.5 max-w-[34ch] rounded-xl bg-[#F6F6FA] p-2.5 text-[#3B3B4A]">
                <blockquote className="italic">“{s.quote}”</blockquote>
                <p className="mt-1 text-[#5B5B6B]">
                  Accessed {s.accessed}
                  {s.url && <> · <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">open<span className="sr-only"> source (new tab)</span></a></>}
                </p>
              </div>
            </details>
          </li>
        ))}
      </ul>
    </li>
  );
}
