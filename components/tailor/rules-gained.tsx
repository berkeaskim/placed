import type { RulesGained } from "@/lib/tailor/view";

/** Score after tailoring as rules gained per dimension (amendments): never a single before→after LLM number. */
export function RulesGainedPanel({ rules }: { rules: RulesGained | null }) {
  return (
    <section aria-labelledby="rules-gained" className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <h3 id="rules-gained" className="text-sm font-bold">CV Score rules</h3>
        <span className="rounded-full bg-[#EEEEF2] px-2 py-0.5 text-xs font-semibold text-[#3F3F4C]">AI-assisted rewrite</span>
      </div>
      {rules === null ? <p className="text-xs text-muted-foreground">Checking the score rules…</p>
        : rules.dims.length === 0 ? <p className="text-xs text-muted-foreground">No score rules changed: these edits are about this posting, not your overall CV.</p>
          : (
            <ul className="flex flex-wrap gap-1.5 text-xs font-bold">
              {rules.dims.map((d) => (
                <li key={d.dimension} className="flex gap-1">
                  {d.gained > 0 && <span className="rounded-full bg-[#E3F6EE] px-2 py-1 text-[#0B6B49]">{d.label}: +{d.gained} {d.gained === 1 ? "rule" : "rules"} passed</span>}
                  {d.lost > 0 && <span className="rounded-full bg-[#FFF1DC] px-2 py-1 text-[#7A4100]">{d.label}: {d.lost} now {d.lost === 1 ? "fails" : "fail"}</span>}
                </li>
              ))}
            </ul>
          )}
    </section>
  );
}
