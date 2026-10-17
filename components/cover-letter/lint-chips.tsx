"use client";
import { useEffect, useRef, useState } from "react";
import type { OutputView } from "@/lib/cover-letter/service";
import type { LintHit } from "@/lib/cover-letter/types";
import { useReducedMotion } from "./use-word-stream";

/** The word count ticks to its new value with an ease-out cubic over 600ms, from wherever it is now (interruptible). */
function useTick(target: number): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    const from = cur.current;
    if (reduced || from === target) {
      cur.current = target;
      const id = requestAnimationFrame(() => setShown(target));
      return () => cancelAnimationFrame(id);
    }
    const t0 = performance.now();
    let id = 0;
    const f = (t: number) => {
      const k = Math.min(1, (t - t0) / 600);
      const v = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      cur.current = v;
      setShown(v);
      if (k < 1) id = requestAnimationFrame(f);
    };
    id = requestAnimationFrame(f);
    return () => cancelAnimationFrame(id);
  }, [target, reduced]);
  return shown;
}

type Chip = { tone: "ok" | "warn"; label: string; title?: string };
const LENGTH = /^CL-0[23]$/, NAMES = /^CL-20$/, STYLE = /^CL-(04|5\d)$/;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

function chipsFor(o: OutputView, feedbackOnly: boolean): Chip[] {
  const of = (re: RegExp) => o.lint.filter((h) => re.test(h.ruleId));
  const labels = (hs: LintHit[]) => [...new Set(hs.map((h) => h.label))].join("\n");
  const out: Chip[] = [];
  const names = of(NAMES);
  out.push(names.length ? { tone: "warn", label: names[0].label, title: labels(names) } : { tone: "ok", label: "Company and role ✓" });
  const style = of(STYLE);
  out.push(style.length ? { tone: "warn", label: plural(style.length, "style note", "style notes"), title: labels(style) } : { tone: "ok", label: "No clichés" });
  if (!feedbackOnly) {
    const flags = o.spans.filter((s) => s.kind === "ai" && s.flag).length;
    out.push(flags ? { tone: "warn", label: plural(flags, "thing to check", "things to check") } : { tone: "ok", label: "Every claim sourced" });
  }
  const rest = o.lint.filter((h) => !LENGTH.test(h.ruleId) && !NAMES.test(h.ruleId) && !STYLE.test(h.ruleId) && (h.severity === "block" || h.severity === "high"));
  for (const l of [...new Set(rest.map((h) => h.label))].slice(0, 3)) out.push({ tone: "warn", label: l });
  return out;
}

/**
 * The lint strip under the letter: a status line while the AI works, then the chips popping in 80ms apart.
 * `data-cl-words` marks the ticking word count (the e2e test reads it).
 */
export function LintChips({ output, status, dim, feedbackOnly }: {
  output: OutputView | null; status: { text: string; error?: boolean } | null; dim: boolean; feedbackOnly: boolean;
}) {
  const lim = output?.limit ?? null;
  const chars = lim?.unit === "chars";
  const count = (chars ? output?.text.length : output?.words) ?? 0;
  const shown = useTick(count);
  if (status || !output || !output.text.trim()) {
    return (
      <div className="lint" aria-live="polite">
        {status && <span className={`status${status.error ? " err" : ""}`}>{!status.error && <span className="orb" aria-hidden="true" />}{status.text}</span>}
      </div>
    );
  }
  const length = output.lint.filter((h) => LENGTH.test(h.ruleId));
  const chips = chipsFor(output, feedbackOnly);
  return (
    <div className={`lint${dim ? " dim" : ""}`} aria-live="polite">
      <span className={`chip ${length.length ? "warn" : "ok"}`} title={length.map((h) => h.label).join("\n") || undefined}>
        <span className="count" data-cl-words={count} {...(chars ? { "data-cl-unit": "chars" } : {})}>{shown}</span>
        {lim ? `/${lim.max}` : ""} {chars ? "characters" : "words"}
      </span>
      {chips.map((c, i) => (
        <span key={c.label} className={`chip ${c.tone}`} title={c.title} style={{ animationDelay: `${(i + 1) * 80}ms` }}>{c.label}</span>
      ))}
    </div>
  );
}
