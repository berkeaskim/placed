"use client";
import type { Fact } from "@/lib/cover-letter/types";

/** "Aug 2026" from an ISO date; null when there is none or it doesn't parse. */
export function monthYear(date: string | null): string | null {
  if (!date) return null;
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "Europe/London" });
}

const initials = (s: string) => s.replace(/^www\./, "").replace(/[^\p{L}\p{N} ]/gu, " ").trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "·";

/**
 * The research block: a spinning ring and shimmer rows while it runs, then each row replaced by a source as it
 * resolves and the ring turning green. Under reduced motion the ring and shimmer stand still (motion.css).
 */
export function ResearchCard({ company, running, stopped = false, facts, isStatic }: { company: string; running: boolean; stopped?: boolean; facts: Fact[]; isStatic: boolean }) {
  const sources = [...new Map(facts.map((f) => [f.publisher, f])).values()].slice(0, 3);
  const title = stopped ? `Still researching ${company}: carrying on without it`
    : running ? `Researching ${company}…`
    : sources.length ? `${sources.length} source${sources.length === 1 ? "" : "s"} read · ${facts.length} fact${facts.length === 1 ? "" : "s"} found` : `Nothing recent found about ${company}`;
  return (
    <div className={`research${stopped ? " stopped" : running ? "" : " done"}`} {...(isStatic ? { "data-static": "" } : {})} role="status" aria-live="polite">
      <div className="t"><span className="orb" aria-hidden="true" /><span>{title}</span></div>
      <div>
        {stopped ? null : running
          ? [0, 1, 2].map((i) => <div key={i} className="src" aria-hidden="true"><span className="fav">·</span><span className="shimmer" /></div>)
          : sources.map((f) => (
            <div key={f.publisher} className="src">
              <span className="fav" aria-hidden="true">{initials(f.publisher)}</span>
              <span>{[f.publisher, monthYear(f.date)].filter(Boolean).join(" · ")}</span>
            </div>
          ))}
      </div>
    </div>
  );
}
