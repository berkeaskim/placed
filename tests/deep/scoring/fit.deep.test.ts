import { describe, it, expect } from "vitest";
import { scoreFit, labelFor, FIT_WEIGHTS } from "@/lib/scoring/fit";
import type { CoverageResult } from "@/lib/scoring/coverage";
import { ARCHETYPES, YEARS, type Archetype, type JobForScoring, type Region, type StudentProfile, type Year } from "@/lib/types";

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const today = "2026-10-13";
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

const student = (over: Partial<StudentProfile> = {}): StudentProfile => ({
  year: "2nd", locationPref: ["london"], needsVisa: false, skills: [],
  archetypes: [{ key: "data_analytics", score: 90, why: [] }, { key: "finance_banking", score: 70, why: [] }, { key: "consulting", score: 40, why: [] }],
  ...over,
});
const job = (over: Partial<JobForScoring> = {}): JobForScoring => ({
  id: "j", title: "Intern", location: "London", remote: false, archetype: "data_analytics",
  yearEligibility: [], sponsorsVisa: "unknown", employmentType: "internship", firstYearFriendly: false,
  requirements: [], textLines: [], deadline: addDays(today, 10), postedAt: "2026-10-01T00:00:00Z", ...over,
});
const cov = (weighted: number | null): CoverageResult => ({
  readable: weighted !== null, weighted, must: { matched: 0, total: 0 }, nice: { matched: 0, total: 0 }, items: [],
});
const gate = (r: ReturnType<typeof scoreFit>, k: string) => r.gates.find((g) => g.key === k)!;

// Formula as revised by audit 10#4/#5: 0.40 archetype + 0.40 requirement fit + 0.20 location; the deadline is urgency, not fit.
describe("fit formula conformance (audit 10#4)", () => {
  it("weights are exactly 0.40 / 0.40 / 0.20 and sum to 1", () => {
    expect(FIT_WEIGHTS).toEqual({ archetype: 0.4, requirements: 0.4, location: 0.2 });
    expect(Object.values(FIT_WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
  });
  it("global = round1(clamp(Σ w·sub − 0.5·softFlags, 1, 5)) for random ungated inputs", () => {
    const r = rng(17);
    for (let i = 0; i < 500; i++) {
      const res = scoreFit(student(), job({ archetype: ARCHETYPES[Math.floor(r() * ARCHETYPES.length)], cohortClash: r() < 0.3 }), cov(r()), today);
      const raw = FIT_WEIGHTS.archetype * res.sub.archetype + FIT_WEIGHTS.requirements * res.sub.requirements +
        FIT_WEIGHTS.location * res.sub.location - 0.5 * res.softFlags.length;
      expect(res.global).toBeCloseTo(Math.round((Math.min(5, Math.max(1, raw)) + 1e-9) * 10) / 10, 9);
    }
  });
  it("requirement sub with no must-haves listed = 1 + 4·weighted (0 → 1, 1 → 5, 0.5 → 3)", () => {
    expect(scoreFit(student(), job(), cov(0), today).sub.requirements).toBe(1);
    expect(scoreFit(student(), job(), cov(1), today).sub.requirements).toBe(5);
    expect(scoreFit(student(), job(), cov(0.5), today).sub.requirements).toBe(3);
  });
  it("archetypeFit: top → 5, top-2 → 4, adjacent → 3, otherwise 2.5 (10#28)", () => {
    expect(scoreFit(student(), job({ archetype: "data_analytics" }), cov(0.5), today).sub.archetype).toBe(5);
    expect(scoreFit(student(), job({ archetype: "finance_banking" }), cov(0.5), today).sub.archetype).toBe(4);
    expect(scoreFit(student(), job({ archetype: "software_eng" }), cov(0.5), today).sub.archetype).toBe(3); // adjacent to data_analytics
    const unrelated = scoreFit(student(), job({ archetype: "marketing_growth" }), cov(0.5), today).sub.archetype;
    expect(unrelated).toBe(2.5);
  });
  it("archetypeFit is neutral (3) when the job or student has no archetype", () => {
    expect(scoreFit(student(), job({ archetype: null }), cov(0.5), today).sub.archetype).toBe(3);
    expect(scoreFit(student({ archetypes: [] }), job(), cov(0.5), today).sub.archetype).toBe(3);
  });
  it("labels: ≥4.5 Strong · ≥4.0 Good · ≥3.5 Stretch · <3.5 Not recommended (every 0.1 step)", () => {
    for (let k = 10; k <= 50; k++) {
      const g = k / 10;
      const expected = g >= 4.5 ? "Strong fit" : g >= 4.0 ? "Good fit" : g >= 3.5 ? "Stretch" : "Not recommended";
      expect(labelFor(g)).toBe(expected);
    }
  });
});

describe("gates (spec §5 stage 0)", () => {
  it("gates are reported in order: year, permanent, location, visa, experience", () => {
    expect(scoreFit(student(), job(), cov(0.5), today).gates.map((g) => g.key)).toEqual(["year", "permanent", "location", "visa", "experience"]);
  });
  it("year gate: empty eligibility admits every year; a listed year admits only listed years", () => {
    for (const y of YEARS) {
      expect(gate(scoreFit(student({ year: y }), job({ yearEligibility: [] }), cov(1), today), "year").passed).toBe(true);
      for (const allowed of YEARS) {
        const res = scoreFit(student({ year: y }), job({ yearEligibility: [allowed] }), cov(1), today);
        expect(gate(res, "year").passed).toBe(y === allowed);
      }
    }
  });
  it("year gate reason names the allowed years", () => {
    const res = scoreFit(student({ year: "1st" }), job({ yearEligibility: ["penultimate"] }), cov(1), today);
    expect(gate(res, "year").reason).toBe("Open to penultimate year only");
  });
  it("first-year-friendly does not override an explicit year restriction", () => {
    const res = scoreFit(student({ year: "1st" }), job({ firstYearFriendly: true, yearEligibility: ["final"] }), cov(1), today);
    expect(res.capped).toBe(true);
    expect(res.global).toBeLessThanOrEqual(2.5);
  });
  it("visa: unknown is neutral (identical score to yes); only explicit 'no' + needsVisa gates a graduate role", () => {
    // a finalist, so a graduate role starting next year passes the year gate
    const s = student({ year: "final", needsVisa: true });
    const grad = { employmentType: "graduate" as const };
    const yes = scoreFit(s, job({ ...grad, sponsorsVisa: "yes" }), cov(0.7), today);
    const unknown = scoreFit(s, job({ ...grad, sponsorsVisa: "unknown" }), cov(0.7), today);
    const no = scoreFit(s, job({ ...grad, sponsorsVisa: "no" }), cov(0.7), today);
    // a vacation internship never needs sponsorship on a Student visa
    expect(scoreFit(s, job({ sponsorsVisa: "no" }), cov(0.7), today).capped).toBe(false);
    expect(unknown.global).toBe(yes.global);
    expect(unknown.capped).toBe(false);
    expect(no.capped).toBe(true);
    expect(gate(no, "visa").reason).toBe("No visa sponsorship");
    // student who doesn't need a visa is never gated by sponsorship
    expect(scoreFit(student({ year: "final", needsVisa: false }), job({ ...grad, sponsorsVisa: "no" }), cov(0.7), today).capped).toBe(false);
  });
  it("permanent roles gate students still enrolled when they start, not finalists or masters (10#8); other types never", () => {
    for (const t of ["internship", "placement", "spring_week", "insight", "graduate", "other"] as const) {
      expect(gate(scoreFit(student(), job({ employmentType: t }), cov(1), today), "permanent").passed).toBe(true);
    }
    for (const y of ["1st", "2nd", "penultimate"] as Year[]) expect(gate(scoreFit(student({ year: y }), job({ employmentType: "permanent" }), cov(1), today), "permanent").passed).toBe(false);
    for (const y of ["final", "masters"] as Year[]) expect(gate(scoreFit(student({ year: y }), job({ employmentType: "permanent" }), cov(1), today), "permanent").passed).toBe(true);
  });
  it("location: hybrid elsewhere = 3 and passes; non-hybrid elsewhere fails; remote passes", () => {
    expect(scoreFit(student(), job({ location: "Hybrid, Berlin" }), cov(1), today).sub.location).toBe(3);
    expect(gate(scoreFit(student(), job({ location: "Berlin, Germany" }), cov(1), today), "location").passed).toBe(false);
    expect(gate(scoreFit(student(), job({ location: "Anywhere", remote: true }), cov(1), today), "location").passed).toBe(true);
  });
  it("location: London job satisfies a UK preference (5); UK job only partially satisfies London (3.5)", () => {
    expect(scoreFit(student({ locationPref: ["uk"] }), job({ location: "London, UK" }), cov(1), today).sub.location).toBe(5);
    expect(scoreFit(student({ locationPref: ["london"] }), job({ location: "Manchester" }), cov(1), today).sub.location).toBe(3.5);
  });
  it("no location preference is neutral (4) and never gates", () => {
    const res = scoreFit(student({ locationPref: [] }), job({ location: "Tokyo, Japan" }), cov(1), today);
    expect(res.sub.location).toBe(4);
    expect(gate(res, "location").passed).toBe(true);
  });
  it("a failed gate caps at 2.5 even with perfect everything; label is always Not recommended", () => {
    const perfect = job({ deadline: addDays(today, 10), firstYearFriendly: true });
    for (const over of [{ yearEligibility: ["final"] as Year[] }, { employmentType: "permanent" as const }, { location: "Paris" }]) {
      const res = scoreFit(student(), { ...perfect, ...over }, cov(1), today);
      expect(res.capped).toBe(true);
      expect(res.global).toBe(2.5);
      expect(res.label).toBe("Not recommended");
    }
  });
  it("multiple failed gates: still ≤ 2.5 and every reason is reported", () => {
    const res = scoreFit(student({ needsVisa: true }), job({ yearEligibility: ["masters"], employmentType: "permanent", location: "New York", sponsorsVisa: "no" }), cov(1), today);
    expect(res.gates.filter((g) => !g.passed).map((g) => g.key)).toEqual(["year", "permanent", "location", "visa"]);
    expect(res.gates.every((g) => g.passed || (g.reason && g.reason.length > 0))).toBe(true);
    expect(res.global).toBeLessThanOrEqual(2.5);
  });
  it("a gate cap never raises a low score", () => {
    const res = scoreFit(student(), job({ employmentType: "permanent", archetype: "marketing_growth", deadline: addDays(today, -1), cohortClash: true }), cov(0), today);
    expect(res.global).toBeLessThan(2.5);
  });

  // FIXED (was GAP): lib/scoring/fit.ts:49,74 — an empty/unknown location classifies as "other" → location sub 2 → hard gate
  // "Outside your locations (unknown)". The ingest filter deliberately lets empty locations through
  // (lib/ingest/filter.ts passesLocationFilter), and the spec's "silence is absence of signal" principle
  // suggests missing data should be neutral, not a blocker.
  it("unknown (empty) job location does not fail the location gate", () => {
    const res = scoreFit(student(), job({ location: "" }), cov(1), today);
    expect(gate(res, "location").passed).toBe(true);
  });
});

describe("urgency is not a fit input (10#4, #9)", () => {
  const g = (over: Partial<JobForScoring>, st: Partial<StudentProfile> = {}) => scoreFit(student(st), job(over), cov(0.5), today).global;
  it("deadline proximity never changes the score", () => {
    const base = g({ deadline: null });
    for (const d of [-1, 0, 3, 4, 30, 31]) expect(g({ deadline: addDays(today, d) })).toBe(base);
  });
  it("posting age never changes an early-careers score", () => {
    expect(g({ postedAt: `${addDays(today, -200)}T09:00:00Z` })).toBe(g({ postedAt: `${addDays(today, -1)}T09:00:00Z` }));
    expect(scoreFit(student(), job({ postedAt: `${addDays(today, -91)}T00:00:00Z` }), cov(0.6), today).softFlags).toEqual([]);
  });
  it("first-year-friendly is a chip, not a score bump", () => {
    for (const y of YEARS) expect(g({ firstYearFriendly: true }, { year: y })).toBe(g({ firstYearFriendly: false }, { year: y }));
  });
  it("urgency buckets: ≤7 days rank 0, ≤14 days or rolling rank 1, otherwise 2", () => {
    const u = (over: Partial<JobForScoring> & { rolling?: boolean }) => scoreFit(student(), { ...job(over), rolling: over.rolling }, cov(0.5), today).urgency;
    expect(u({ deadline: today })).toMatchObject({ rank: 0, chip: "Closes today" });
    expect(u({ deadline: addDays(today, 1) })).toMatchObject({ rank: 0, chip: "Closes tomorrow" });
    expect(u({ deadline: addDays(today, 7) })).toMatchObject({ rank: 0, chip: "Closes in 7 days" });
    expect(u({ deadline: addDays(today, 14) })).toMatchObject({ rank: 1 });
    expect(u({ deadline: addDays(today, 31) })).toMatchObject({ rank: 2, chip: null });
    expect(u({ deadline: null, rolling: true })).toMatchObject({ rank: 1, chip: "Rolling: apply early" });
  });
  it("malformed postedAt does not produce NaN", () => {
    const res = scoreFit(student(), job({ postedAt: "yesterday", employmentType: "other" }), cov(0.6), today);
    expect(Number.isFinite(res.global)).toBe(true);
  });
  it("a malformed deadline is treated like no deadline", () => {
    expect(scoreFit(student(), job({ deadline: "TBC" }), cov(0.5), today).urgency).toEqual(scoreFit(student(), job({ deadline: null }), cov(0.5), today).urgency);
  });
});

describe("fit invariants (seeded property loops)", () => {
  const regions: Region[] = ["london", "uk", "europe", "remote", "other"];
  const locations = ["London", "Manchester, UK", "Hybrid - Paris", "Berlin", "Remote", "New York, NY", "", "Edinburgh", "Dublin, Ireland"];
  const types: JobForScoring["employmentType"][] = ["internship", "placement", "spring_week", "insight", "graduate", "permanent", "other"];
  function randomCase(r: () => number) {
    const pickN = <T,>(xs: readonly T[]) => xs.filter(() => r() < 0.3);
    const arch = [...ARCHETYPES].sort(() => r() - 0.5).slice(0, Math.floor(r() * 4)) as Archetype[];
    const s = student({
      year: YEARS[Math.floor(r() * YEARS.length)], locationPref: pickN(regions), needsVisa: r() < 0.5,
      archetypes: arch.map((k, i) => ({ key: k, score: 100 - i * 10, why: [] })),
    });
    const j = job({
      location: locations[Math.floor(r() * locations.length)], remote: r() < 0.2,
      archetype: r() < 0.2 ? null : ARCHETYPES[Math.floor(r() * ARCHETYPES.length)], yearEligibility: pickN(YEARS),
      sponsorsVisa: (["yes", "no", "unknown"] as const)[Math.floor(r() * 3)], employmentType: types[Math.floor(r() * types.length)],
      firstYearFriendly: r() < 0.3, deadline: r() < 0.2 ? null : addDays(today, Math.floor(r() * 120) - 20),
      postedAt: r() < 0.2 ? null : `${addDays(today, -Math.floor(r() * 200))}T00:00:00Z`, cohortClash: r() < 0.2,
    });
    const c = cov(r() < 0.15 ? null : r());
    return { s, j, c };
  }
  it("global ∈ [1,5], one decimal, finite; label = labelFor(global); sub-scores ∈ [1,5]", () => {
    const r = rng(2024);
    for (let i = 0; i < 3000; i++) {
      const { s, j, c } = randomCase(r);
      const res = scoreFit(s, j, c, today);
      expect(Number.isFinite(res.global)).toBe(true);
      expect(res.global).toBeGreaterThanOrEqual(1);
      expect(res.global).toBeLessThanOrEqual(5);
      expect(Math.round(res.global * 10) / 10).toBe(res.global);
      expect(res.label).toBe(labelFor(res.global));
      for (const v of Object.values(res.sub)) { expect(v).toBeGreaterThanOrEqual(1); expect(v).toBeLessThanOrEqual(5); }
      expect(res.capped).toBe(res.gates.some((g) => !g.passed));
      if (res.capped) { expect(res.global).toBeLessThanOrEqual(2.5); expect(res.label).toBe("Not recommended"); }
      for (const g of res.gates) if (!g.passed) expect(g.reason).toBeTruthy();
    }
  });
  it("deterministic and does not mutate inputs", () => {
    const r = rng(5);
    for (let i = 0; i < 300; i++) {
      const { s, j, c } = randomCase(r);
      const snap = JSON.stringify({ s, j, c });
      expect(scoreFit(s, j, c, today)).toEqual(scoreFit(s, j, c, today));
      expect(JSON.stringify({ s, j, c })).toBe(snap);
    }
  });
  it("monotonic in coverage: higher weighted coverage never lowers the global", () => {
    const r = rng(6);
    for (let i = 0; i < 1000; i++) {
      const { s, j } = randomCase(r);
      const a = r(), b = r();
      const lo = scoreFit(s, j, cov(Math.min(a, b)), today).global, hi = scoreFit(s, j, cov(Math.max(a, b)), today).global;
      expect(hi).toBeGreaterThanOrEqual(lo);
    }
  });
  it("adding a soft flag never raises the global", () => {
    const r = rng(7);
    for (let i = 0; i < 1000; i++) {
      const { s, j, c } = randomCase(r);
      expect(scoreFit(s, { ...j, cohortClash: true }, c, today).global).toBeLessThanOrEqual(scoreFit(s, { ...j, cohortClash: false }, c, today).global);
    }
  });
  it("needing a visa never raises the global; 'no' sponsorship never beats 'unknown'", () => {
    const r = rng(8);
    for (let i = 0; i < 1000; i++) {
      const { s, j, c } = randomCase(r);
      expect(scoreFit({ ...s, needsVisa: true }, j, c, today).global).toBeLessThanOrEqual(scoreFit({ ...s, needsVisa: false }, j, c, today).global);
      expect(scoreFit(s, { ...j, sponsorsVisa: "no" }, c, today).global).toBeLessThanOrEqual(scoreFit(s, { ...j, sponsorsVisa: "unknown" }, c, today).global);
    }
  });
  it("order of yearEligibility / locationPref does not matter", () => {
    const r = rng(9);
    for (let i = 0; i < 500; i++) {
      const { s, j, c } = randomCase(r);
      const a = scoreFit(s, j, c, today);
      const b = scoreFit({ ...s, locationPref: [...s.locationPref].reverse() }, { ...j, yearEligibility: [...j.yearEligibility].reverse() }, c, today);
      expect(b.global).toBe(a.global);
      expect(b.capped).toBe(a.capped);
    }
  });
});
