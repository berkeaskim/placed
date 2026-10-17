// Recall benchmark: how many well-known UK early-careers employers our seed list actually reaches.
// Pure functions; scripts/coverage.ts does the I/O.

/** `sources` are "ats:slug" boards, or "curated:<employer key>" for a card in seed/programmes.yml (not a board). */
export type BenchmarkEmployer = { name: string; sector: string; ats: string; sources: string[]; why?: string; tier?: "top" };
export type SeedCompany = { slug: string; ats: string; enabled?: boolean };
/** Live result for one board, keyed by sourceKey(): early-career postings kept by the ingest filters. */
export type BoardCount = { kept: number; uk: number } | { error: string };

const CURATED = "curated:";
const isCurated = (s: string) => s.startsWith(CURATED);

export const sourceKey = (c: Pick<SeedCompany, "ats" | "slug">) => `${c.ats}:${c.slug}`;

/** Benchmark sources that point at an enabled board in `companies`. */
export function enabledSources(e: BenchmarkEmployer, companies: SeedCompany[]): string[] {
  const on = new Set(companies.filter((c) => c.enabled !== false).map(sourceKey));
  return e.sources.filter((s) => !isCurated(s) && on.has(s));
}

/** Sources named in the benchmark that don't exist in companies.yml at all (typos, or a board that was removed). */
export function unknownSources(bench: BenchmarkEmployer[], companies: SeedCompany[]): string[] {
  const all = new Set(companies.map(sourceKey));
  return [...new Set(bench.flatMap((e) => e.sources))].filter((s) => !isCurated(s) && !all.has(s));
}

export type EmployerCoverage = {
  employer: BenchmarkEmployer;
  configured: boolean;
  /** Has a "curated:<key>" source whose programme card is visible today (offline check). */
  curated: boolean;
  /** Only with live counts: kept postings summed over the employer's enabled boards. */
  kept?: number;
  uk?: number;
  errors?: string[];
};

export function employerCoverage(
  bench: BenchmarkEmployer[], companies: SeedCompany[], live?: Map<string, BoardCount>,
  /** Employer keys that have a visible curated programme today. */
  curatedKeys: ReadonlySet<string> = new Set(),
): EmployerCoverage[] {
  return bench.map((employer) => {
    const srcs = enabledSources(employer, companies);
    const curated = employer.sources.some((x) => isCurated(x) && curatedKeys.has(x.slice(CURATED.length)));
    const row: EmployerCoverage = { employer, configured: srcs.length > 0, curated };
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

export type CoverageSummary = { sector: string; total: number; configured: number; live?: number; liveUk?: number; liveOrCurated?: number };

/** Per-sector counts plus an "all" row. `live` = employers with >= 1 kept UK/EU posting; `liveUk` = >= 1 in the UK. */
export function summarize(rows: EmployerCoverage[]): CoverageSummary[] {
  const hasLive = rows.some((r) => r.kept !== undefined);
  const sum = (sector: string, rs: EmployerCoverage[]): CoverageSummary => ({
    sector,
    total: rs.length,
    configured: rs.filter((r) => r.configured).length,
    ...(hasLive ? { live: rs.filter((r) => (r.kept ?? 0) > 0).length, liveUk: rs.filter((r) => (r.uk ?? 0) > 0).length,
          liveOrCurated: rs.filter((r) => (r.kept ?? 0) > 0 || r.curated).length } : {}),
  });
  const sectors = [...new Set(rows.map((r) => r.employer.sector))];
  return [...sectors.map((s) => sum(s, rows.filter((r) => r.employer.sector === s))), sum("all", rows)];
}

export type TopTierRow = { name: string; status: "live" | "curated" | "missing"; kept?: number };

/** Status of each `tier: top` employer: live board posting beats a curated card; neither is "missing". Needs live counts. */
export function topTier(rows: EmployerCoverage[]): TopTierRow[] {
  return rows.filter((r) => r.employer.tier === "top").map((r) => {
    if ((r.kept ?? 0) > 0) return { name: r.employer.name, status: "live", kept: r.kept };
    return { name: r.employer.name, status: r.curated ? "curated" : "missing" };
  });
}
