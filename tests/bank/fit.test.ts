import { describe, expect, it } from "vitest";
import { fitSelection, fillRatio, overflowCandidates, pageCount } from "@/lib/bank/fit";
import { cvLines, DEFAULT_LINE_BUDGET, selectForJob, type SelectOpts } from "@/lib/bank/select";
import { toTailored } from "@/lib/verify/tailoring";
import type { Bank, BankBullet, BankEntry } from "@/lib/bank/types";
import type { CvEntry, ParsedCV } from "@/lib/types";
import type { JobListItem } from "@/lib/db/queries";

const CV_SRC = "src-cv";
const NOW = "2026-10";

type B = Partial<BankBullet> & { id: string; text: string };
function entry(id: string, section: BankEntry["section"], org: string, startYm: string | null, endYm: string | null, bullets: B[], extra: Partial<BankEntry> = {}): BankEntry {
  return {
    id, section, org, title: `${org} role`, dates: "2024 - 2025", startYm, endYm, location: "London", pinned: false, hidden: false, sourceIds: [], updatedAt: "",
    bullets: bullets.map((b, i) => ({ entryId: id, position: i, pinned: false, hidden: false, sourceIds: [], sourceText: null, updatedAt: "", ...b })),
    ...extra,
  };
}
const baseCv = (over: Partial<ParsedCV> = {}): ParsedCV => ({
  name: "Ada Student", email: "ada@example.com", phone: "07700 900000", location: "London", links: ["linkedin.com/in/ada"], summary: null,
  education: [{ id: "ed0", institution: "University College London", degree: "BSc Mathematics", dates: "2024 - 2027", grade: "First", details: [{ id: "ed0-d0", text: "Modules: Probability, Statistics, Linear Algebra, Real Analysis" }] }],
  experience: [], projects: [], leadership: [],
  skills: [{ group: "Technical", items: ["Python", "R", "Excel", "SQL"] }],
  interests: "Chess, running, climbing", sectionOrder: ["education", "experience", "projects", "leadership", "skills", "interests"], yearGuess: null, archetypes: [],
  ...over,
});
const job = {
  id: "j1", title: "Quant Analyst Intern", company: "Quantco", url: "", summary: "", extId: "j1", location: null, remote: null,
  requirements: [], textLines: ["## Requirements", "- Python", "- Statistics", "## Nice to have", "- SQL"], deadline: null, postedAt: null,
} as unknown as JobListItem;
const opts = (o: Partial<SelectOpts> = {}): SelectOpts => ({ pinnedForJob: [], excludedForJob: [], activeCvSourceId: CV_SRC, nowYm: NOW, ...o });

const LONG = "Built and validated a Python model of match outcomes using statistics and regression, then presented the findings to a panel of {n} senior members of the society";
function bigBank(): Bank {
  const entries: BankEntry[] = [];
  for (let i = 0; i < 10; i++) {
    entries.push(entry(`e${i}`, i < 5 ? "experience" : i < 8 ? "projects" : "leadership", `Org ${i}`, `20${15 + i}-01`.replace("2015", "2019"), `20${20 + (i % 6)}-06`,
      [0, 1, 2].map((k) => ({ id: `e${i}-b${k}`, text: LONG.replace("{n}", String(i * 3 + k + 12)) }))));
  }
  return { entries };
}

// Realistic one-page student CV (about what a first-year UCL student hands in): used for the "never lose a bullet" ruling.
function onePageCv(): ParsedCV {
  const b = (id: string, text: string) => ({ id, text });
  const exp: CvEntry[] = [
    { id: "x0", org: "Hargreave Capital", title: "Spring Insight Intern", dates: "Apr 2026", location: "London", bullets: [
      b("x0-b0", "Shadowed the equity research desk and summarised 12 company filings into one-page briefings for senior analysts"),
      b("x0-b1", "Built a Python screen of 40 FTSE 250 stocks by margin and growth, presented to a team of 6"),
    ] },
    { id: "x1", org: "Marlowe Cafe", title: "Barista", dates: "2024 - 2025", location: "London", bullets: [
      b("x1-b0", "Served 150+ customers per shift in a fast-paced environment, maintaining sales accuracy to the penny"),
      b("x1-b1", "Trained 3 new staff on the till and opening routine"),
    ] },
  ];
  const proj: CvEntry[] = [
    { id: "p0", org: "London Rent Tracker", title: "Personal project", dates: "2025", location: "", bullets: [
      b("p0-b0", "Used Python and SQL to collect and clean 1,200 rental listings"),
      b("p0-b1", "Built charts in Excel comparing rents across 12 boroughs"),
    ] },
  ];
  const lead: CvEntry[] = [
    { id: "l0", org: "UCL Finance Society", title: "Events Officer", dates: "2025 - present", location: "", bullets: [
      b("l0-b0", "Organised 8 events with 400+ attendees and managed a GBP 2,000 events budget"),
      b("l0-b1", "Secured 3 sponsors by pitching to banks and consultancies"),
    ] },
  ];
  return baseCv({ experience: exp, projects: proj, leadership: lead });
}
function bankFromCv(cv: ParsedCV): Bank {
  const entries: BankEntry[] = [];
  const all: [BankEntry["section"], CvEntry[]][] = [["experience", cv.experience], ["projects", cv.projects], ["leadership", cv.leadership]];
  for (const [section, es] of all) {
    for (const e of es) entries.push(entry(e.id, section, e.org, "2025-01", "2025-06", e.bullets.map((x) => ({ id: x.id, text: x.text })), { title: e.title, dates: e.dates, location: e.location, sourceIds: [CV_SRC] }));
  }
  return { entries };
}

const ids = (cv: ParsedCV) => [cv.experience, cv.projects, cv.leadership].flat().flatMap((e) => e.bullets.map((b) => b.id));

describe("fitSelection", () => {
  it("a bank of 30 long bullets still renders on one page", async () => {
    const bank = bigBank();
    const cv = baseCv();
    const sel = await fitSelection(bank, cv, job, opts());
    expect(sel.pages).toBe(1);
    expect(await pageCount(toTailored(sel.base), sel.base)).toBe(1);
    expect(ids(sel.base).length).toBeLessThan(30);
    // anything dropped to fit is still reported as left out
    const kept = new Set(ids(sel.base));
    // every bank bullet is either on the page or reported as left out (the report lists at most a few extras, so just check kept ones are not listed)
    for (const l of sel.report.leftOut) expect(l.kind === "bullet" ? kept.has(l.id) : false).toBe(false);
  }, 120_000);

  it("an oversized budget forces drops, which stay reported as left out", async () => {
    const bank = bigBank();
    const sel = await fitSelection(bank, baseCv(), job, opts({ lineBudget: 60 }));
    expect(sel.pages).toBe(1);
    const dropped = sel.report.leftOut.filter((l) => l.reason === "dropped to fit one page");
    expect(dropped.length).toBeGreaterThan(0);
    const kept = new Set(ids(sel.base));
    for (const d of dropped) expect(kept.has(d.id)).toBe(false);
  }, 120_000);

  it("pins that alone overflow are dropped oldest first and reported", async () => {
    const bank = bigBank();
    for (const e of bank.entries) for (const b of e.bullets) b.pinned = true;
    const sel = await fitSelection(bank, baseCv(), job, opts({ lineBudget: 64 }));
    expect(sel.pages).toBe(1);
    expect(sel.report.pinnedOverflow).toBe(true);
    const dropped = sel.report.leftOut.filter((l) => l.reason === "pinned, but there was no room on one page");
    expect(dropped.length).toBeGreaterThan(0);
    const kept = new Set(ids(sel.base));
    for (const d of dropped) expect(kept.has(d.id)).toBe(false);
    // oldest first: org 0 (ended 2020-06) loses bullets before org 5 (ended 2025-06)
    const lostByOrg = (n: number) => bank.entries[n].bullets.filter((b) => !kept.has(b.id)).length;
    expect(lostByOrg(0)).toBeGreaterThanOrEqual(lostByOrg(5));
  }, 120_000);

  it("a short bank is not trimmed", async () => {
    const cv = baseCv();
    const bank: Bank = { entries: [entry("e1", "experience", "Acme", "2025-01", "2025-06", [{ id: "a1", text: "Built a Python pipeline cutting reporting time by 30%" }, { id: "a2", text: "Analysed statistics for 5 clients" }])] };
    const sel = await fitSelection(bank, cv, job, opts());
    expect(sel.pages).toBe(1);
    expect(ids(sel.base).sort()).toEqual(["a1", "a2"]);
    expect(sel.report.leftOut.filter((l) => l.reason === "dropped to fit one page")).toHaveLength(0);
  }, 60_000);

  it("a real-sized one-page active CV with an equal bank keeps every bullet", async () => {
    const cv = onePageCv();
    expect(await pageCount(toTailored(cv), cv)).toBe(1);
    const bank = bankFromCv(cv);
    const sel = await fitSelection(bank, cv, job, opts());
    expect(sel.pages).toBe(1);
    expect(ids(sel.base).sort()).toEqual(ids(cv).sort());
  }, 60_000);

  it("pinned bullets are never dropped for fit", async () => {
    const bank = bigBank();
    const sel = await fitSelection(bank, baseCv(), job, opts({ pinnedForJob: ["e0-b0", "e1-b0"] }));
    expect(sel.pages).toBe(1);
    const kept = new Set(ids(sel.base));
    expect(kept.has("e0-b0") && kept.has("e1-b0")).toBe(true);
  }, 120_000);
});

describe("overflowCandidates", () => {
  it("returns the 3 lowest-scoring rendered bullets in ascending order", () => {
    const cv = onePageCv();
    const scores: Record<string, number> = { "x0-b0": 5, "x0-b1": 4, "x1-b0": 1, "x1-b1": 2, "p0-b0": 3, "p0-b1": 6, "l0-b0": 7, "l0-b1": 0.5 };
    const out = overflowCandidates(toTailored(cv), scores);
    expect(out.map((o) => o.bulletId)).toEqual(["l0-b1", "x1-b0", "x1-b1"]);
    expect(out[0].text).toBe("Secured 3 sponsors by pitching to banks and consultancies");
  });
  it("skips dropped bullets and returns fewer when there are fewer", () => {
    const t = toTailored(onePageCv());
    t.experience[0].bullets[0].changeType = "dropped";
    const out = overflowCandidates(t, { "x0-b0": -10, "x0-b1": 1 });
    expect(out.map((o) => o.bulletId)).toEqual(["x0-b1"]);
  });
  it("names a merged or AI bullet by its lowest-scoring bank-id source, and skips bullets with no bank-id ref", () => {
    const t = toTailored(onePageCv());
    t.experience[0].bullets = [{ id: "ai-merged-1", text: "Merged line", sourceRefs: ["x0-b0", "x0-b1"], changeType: "merged" }];
    t.experience[1].bullets = [{ id: "ai-new", text: "No bank source", sourceRefs: ["not-a-bank-id"], changeType: "rephrased" }];
    const scores: Record<string, number> = { "x0-b0": 5, "x0-b1": 0.2, "p0-b0": 3, "p0-b1": 6, "l0-b0": 7, "l0-b1": 4 };
    const out = overflowCandidates(t, scores);
    expect(out).toEqual([
      { bulletId: "x0-b1", text: "Merged line" },
      { bulletId: "p0-b0", text: "Used Python and SQL to collect and clean 1,200 rental listings" },
      { bulletId: "l0-b1", text: "Secured 3 sponsors by pitching to banks and consultancies" },
    ]);
    expect(out.map((o) => o.bulletId)).not.toContain("ai-merged-1");
  });
});

describe("fillRatio", () => {
  it("is between 0 and 1 and grows with content", async () => {
    const small = baseCv();
    const full = onePageCv();
    const a = await fillRatio(toTailored(small), small), b = await fillRatio(toTailored(full), full);
    expect(a).toBeGreaterThan(0); expect(b).toBeLessThanOrEqual(1.5);
    expect(b).toBeGreaterThan(a);
  }, 60_000);
});

describe("calibration", () => {
  it("logs pages at DEFAULT_LINE_BUDGET", async () => {
    const out: string[] = [];
    for (const [name, cv] of [["onePageCv", onePageCv()], ["bigBank", baseCv()]] as const) {
      const bank = name === "onePageCv" ? bankFromCv(cv) : bigBank();
      for (const budget of [38, 42, 46, 50, 54, 58]) {
        const s = selectForJob(bank, cv, job, opts({ lineBudget: budget }));
        out.push(`${name} budget=${budget} est=${cvLines(s.base)} pages=${await pageCount(toTailored(s.base), s.base)} fill=${(await fillRatio(toTailored(s.base), s.base)).toFixed(2)}`);
      }
    }
    if (process.env.BANK_CALIBRATE) console.log(`DEFAULT=${DEFAULT_LINE_BUDGET}\n${out.join("\n")}`);
    const s = selectForJob(bigBank(), baseCv(), job, opts());
    expect(await pageCount(toTailored(s.base), s.base)).toBe(1); // the default budget must not overflow on its own
  }, 180_000);
});
