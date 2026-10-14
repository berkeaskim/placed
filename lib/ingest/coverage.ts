// Recall benchmark: how many well-known UK early-careers employers our seed list actually reaches.
// Pure functions; scripts/coverage.ts does the I/O.

export type BenchmarkEmployer = { name: string; sector: string; ats: string; sources: string[]; why?: string };
export type SeedCompany = { slug: string; ats: string; enabled?: boolean };
/** Live result for one board, keyed by sourceKey(): early-career postings kept by the ingest filters. */
export type BoardCount = { kept: number; uk: number } | { error: string };

export const sourceKey = (c: Pick<SeedCompany, "ats" | "slug">) => `${c.ats}:${c.slug}`;

/** Benchmark sources that point at an enabled board in `companies`. */
export function enabledSources(e: BenchmarkEmployer, companies: SeedCompany[]): string[] {
  const on = new Set(companies.filter((c) => c.enabled !== false).map(sourceKey));
  return e.sources.filter((s) => on.has(s));
}

/** Sources named in the benchmark that don't exist in companies.yml at all (typos, or a board that was removed). */
export function unknownSources(bench: BenchmarkEmployer[], companies: SeedCompany[]): string[] {
  const all = new Set(companies.map(sourceKey));
  return [...new Set(bench.flatMap((e) => e.sources))].filter((s) => !all.has(s));
}

export type EmployerCoverage = {
  employer: BenchmarkEmployer;
  configured: boolean;
  /** Only with live counts: kept postings summed over the employer's enabled boards. */
  kept?: number;
  uk?: number;
  errors?: string[];
};

export function employerCoverage(
  bench: BenchmarkEmployer[], companies: SeedCompany[], live?: Map<string, BoardCount>,
): EmployerCoverage[] {
  return bench.map((employer) => {
    const srcs = enabledSources(employer, companies);
    const row: EmployerCoverage = { employer, configured: srcs.length > 0 };
    if (live) {
      let kept = 0, uk = 0;
      const errors: string[] = [];
      for (const s of srcs) {
        const r = live.get(s);
        if (!r) continue;
        if ("error" in r) errors.push(`${s}: ${r.error}`);
        else { kept += r.kept; uk += r.uk; }
      }
      Object.assign(row, { kept, uk, errors });
    }
    return row;
  });
}

export type CoverageSummary = { sector: string; total: number; configured: number; live?: number; liveUk?: number };

/** Per-sector counts plus an "all" row. `live` = employers with >= 1 kept UK/EU posting; `liveUk` = >= 1 in the UK. */
export function summarize(rows: EmployerCoverage[]): CoverageSummary[] {
  const hasLive = rows.some((r) => r.kept !== undefined);
  const sum = (sector: string, rs: EmployerCoverage[]): CoverageSummary => ({
    sector,
    total: rs.length,
    configured: rs.filter((r) => r.configured).length,
    ...(hasLive ? { live: rs.filter((r) => (r.kept ?? 0) > 0).length, liveUk: rs.filter((r) => (r.uk ?? 0) > 0).length } : {}),
  });
  const sectors = [...new Set(rows.map((r) => r.employer.sector))];
  return [...sectors.map((s) => sum(s, rows.filter((r) => r.employer.sector === s))), sum("all", rows)];
}
