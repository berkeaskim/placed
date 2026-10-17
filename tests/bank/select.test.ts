import { describe, expect, it } from "vitest";
import { cvLines, DEFAULT_LINE_BUDGET, estimateLines, fixedLines, REMOVED_FOR_JOB_REASON, selectForJob, type SelectOpts } from "@/lib/bank/select";
import type { Bank, BankBullet, BankEntry } from "@/lib/bank/types";
import type { CvEntry, ParsedCV } from "@/lib/types";
import type { JobListItem } from "@/lib/db/queries";

const CV_SRC = "src-cv";
const NOW = "2026-10";

type B = Partial<BankBullet> & { id: string; text: string };
function entry(id: string, section: BankEntry["section"], org: string, startYm: string | null, endYm: string | null, bullets: B[], extra: Partial<BankEntry> = {}): BankEntry {
  return {
    id, section, org, title: `${org} role`, dates: "", startYm, endYm, location: "", pinned: false, hidden: false, sourceIds: [], updatedAt: "",
    bullets: bullets.map((b, i) => ({ entryId: id, position: i, pinned: false, hidden: false, sourceIds: [], sourceText: null, updatedAt: "", ...b })),
    ...extra,
  };
}

function cv(over: Partial<ParsedCV> = {}): ParsedCV {
  return {
    name: "Ada Student", email: "ada@example.com", phone: "07700 900000", location: "London", links: [], summary: null,
    education: [{ id: "ed0", institution: "UCL", degree: "BSc Mathematics", dates: "2024 - 2027", grade: "First", details: [] }],
    experience: [], projects: [], leadership: [],
    skills: [{ group: "Technical", items: ["Python", "R", "Excel"] }],
    interests: null, sectionOrder: ["education", "experience", "projects", "skills"], yearGuess: null, archetypes: [],
    ...over,
  };
}

const job = {
  id: "j1", title: "Quant Analyst Intern", company: "Quantco", url: "", summary: "", extId: "j1", location: null, remote: null,
  requirements: [], textLines: ["## Requirements", "- Python", "- Statistics", "## Nice to have", "- SQL"], deadline: null, postedAt: null,
} as unknown as JobListItem;

const opts = (o: Partial<SelectOpts> = {}): SelectOpts => ({ pinnedForJob: [], excludedForJob: [], activeCvSourceId: CV_SRC, nowYm: NOW, ...o });

// ~6 entries: two quant-relevant, two strong off-topic, two weak
function quantBank(): Bank {
  return {
    entries: [
      entry("e-quant", "projects", "Stats Society", "2025-01", "2025-06", [
        { id: "q1", text: "Built a Python model of football results using statistics and Poisson regression" },
        { id: "q2", text: "Ran regression analysis in Python on 10,000 matches, beating bookmaker odds by 4%" },
        { id: "q3", text: "Presented the statistics findings to the society" },
      ]),
      entry("e-bake", "projects", "Bake Club", "2025-01", "2025-06", [
        { id: "k1", text: "Organised weekly bake sales for the club" },
        { id: "k2", text: "Designed posters for the club noticeboard" },
      ]),
      entry("e-shop", "experience", "Corner Shop", "2023-06", "2023-09", [
        { id: "s1", text: "Served customers at the till" },
        { id: "s2", text: "Stocked shelves each morning" },
      ]),
      entry("e-fin", "experience", "Big Bank", "2025-06", "2025-08", [
        { id: "f1", text: "Cut month-end close time by 30% for a 12-person finance team" },
        { id: "f2", text: "Responsible for Python scripts" },
        { id: "f3", text: "Reconciled £2m of trades across 3 desks every week" },
      ]),
      entry("e-lead", "leadership", "Debate Society", "2024-10", null, [
        { id: "l1", text: "Led a 40-member debate society to 3 national finals" },
        { id: "l2", text: "Recruited 25 new members in one term" },
      ]),
      entry("e-old", "experience", "Paper Round", null, null, [{ id: "o1", text: "Delivered newspapers" }]),
    ],
  };
}

const allBulletIds = (c: ParsedCV) => [...c.experience, ...c.projects, ...c.leadership].flatMap((e) => e.bullets.map((b) => b.id));
const allEntryIds = (c: ParsedCV) => [...c.experience, ...c.projects, ...c.leadership].map((e) => e.id);

describe("selectForJob", () => {
  it("picks the on-topic project over an off-topic one when space is short", () => {
    const bank: Bank = { entries: quantBank().entries.filter((e) => e.id === "e-quant" || e.id === "e-bake") };
    const base = cv();
    // room for one heading + one entry with 2 bullets (each bullet 1 line)
    const budget = fixedLines(base) + 1 + 3;
    const sel = selectForJob(bank, base, job, opts({ lineBudget: budget }));
    expect(allEntryIds(sel.base)).toEqual(["e-quant"]);
    expect(sel.scores["e-quant"]).toBeGreaterThan(sel.scores["e-bake"]);
  });

  it("keeps a strong quantified off-topic bullet over a weak keyword-only on-topic bullet", () => {
    const sel = selectForJob(quantBank(), cv(), job, opts({ lineBudget: 200 }));
    // f1: quantified + action verb, covers nothing. f2: covers the Python must-have, nothing else.
    expect(sel.scores["f1"]).toBeGreaterThan(sel.scores["f2"]);
    expect(sel.scores["f3"]).toBeGreaterThan(sel.scores["f2"]);
    // and when only two bullets of that entry fit, the strong ones win
    const tight = selectForJob({ entries: quantBank().entries.filter((e) => e.id === "e-fin") }, cv(), job, opts({ lineBudget: fixedLines(cv()) + 1 + 3 }));
    expect(allBulletIds(tight.base).sort()).toEqual(["f1", "f3"]);
  });

  it("pinned is always in; hidden never", () => {
    const bank = quantBank();
    bank.entries.find((e) => e.id === "e-shop")!.pinned = true;
    bank.entries.find((e) => e.id === "e-quant")!.hidden = true;
    bank.entries.find((e) => e.id === "e-fin")!.bullets.find((b) => b.id === "f1")!.hidden = true;
    bank.entries.find((e) => e.id === "e-bake")!.bullets.find((b) => b.id === "k2")!.pinned = true;
    const sel = selectForJob(bank, cv(), job, opts({ lineBudget: fixedLines(cv()) + 12 }));
    expect(allEntryIds(sel.base)).toContain("e-shop");
    expect(allBulletIds(sel.base)).toContain("k2");
    expect(allEntryIds(sel.base)).not.toContain("e-quant");
    expect(allBulletIds(sel.base)).not.toContain("f1");
    const reported = [...sel.report.added, ...sel.report.leftOut].map((i) => i.id);
    expect(reported).not.toContain("e-quant");
    expect(reported).not.toContain("f1");
    expect(sel.report.added.find((i) => i.id === "e-shop")?.reason).toBe("pinned");
  });

  it("pinnedForJob / excludedForJob override for this job only", () => {
    const bank = quantBank();
    const budget = fixedLines(cv()) + 1 + 3;
    const plain = selectForJob(bank, cv(), job, opts({ lineBudget: budget }));
    expect(allEntryIds(plain.base)).toContain("e-quant");
    const over = selectForJob(bank, cv(), job, opts({ lineBudget: budget + 4, pinnedForJob: ["e-shop"], excludedForJob: ["e-quant"] }));
    expect(allEntryIds(over.base)).toContain("e-shop");
    expect(allEntryIds(over.base)).not.toContain("e-quant");
    // the bank rows themselves are untouched
    expect(bank.entries.find((e) => e.id === "e-shop")!.pinned).toBe(false);
    expect(bank.entries.find((e) => e.id === "e-quant")!.hidden).toBe(false);
    // an excluded bullet stays out even when its entry is in
    const noQ2 = selectForJob(bank, cv(), job, opts({ lineBudget: 200, excludedForJob: ["q2"] }));
    expect(allEntryIds(noQ2.base)).toContain("e-quant");
    expect(allBulletIds(noQ2.base)).not.toContain("q2");
  });

  it("items removed for this role are listed first in leftOut with the removed reason, outside the extra cap", () => {
    const bank = quantBank();
    const sel = selectForJob(bank, cv(), job, opts({ lineBudget: 200, excludedForJob: ["e-quant", "q2"] }));
    expect(sel.report.leftOut[0]).toMatchObject({ id: "e-quant", kind: "entry", reason: REMOVED_FOR_JOB_REASON });
    const noBullet = selectForJob(bank, cv(), job, opts({ lineBudget: 200, excludedForJob: ["q2"] }));
    expect(noBullet.report.leftOut[0]).toMatchObject({ id: "q2", kind: "bullet", reason: REMOVED_FOR_JOB_REASON });
    expect(allBulletIds(noBullet.base)).not.toContain("q2");
    // hidden items and ids that no longer exist are not listed
    bank.entries.find((e) => e.id === "e-quant")!.hidden = true;
    const hidden = selectForJob(bank, cv(), job, opts({ lineBudget: 200, excludedForJob: ["e-quant", "gone"] }));
    expect(hidden.report.leftOut.some((i) => i.reason === REMOVED_FOR_JOB_REASON)).toBe(false);
  });

  it("every included entry has ≥2 bullets when it has ≥2", () => {
    for (const extra of [4, 8, 12, 16, 20]) {
      const sel = selectForJob(quantBank(), cv(), job, opts({ lineBudget: fixedLines(cv()) + extra }));
      const bank = quantBank();
      for (const e of [...sel.base.experience, ...sel.base.projects, ...sel.base.leadership]) {
        const n = bank.entries.find((b) => b.id === e.id)!.bullets.length;
        expect(e.bullets.length).toBeGreaterThanOrEqual(Math.min(2, n));
      }
    }
  });

  it("sections render newest first", () => {
    const mk = (id: string, s: string | null, en: string | null) => entry(id, "experience", id, s, en, [{ id: `${id}-1`, text: "Did a thing" }]);
    const bank: Bank = { entries: [mk("y2023", "2023-01", "2023-06"), mk("nodate", null, null), mk("present", "2024-01", null), mk("y2024", "2024-03", "2024-09")] };
    // bullets keep bank position order, not score order
    bank.entries.push(entry("y2022", "experience", "Old", "2022-01", "2022-03", [
      { id: "p0", text: "Swept the floor" },
      { id: "p1", text: "Built a Python statistics model cutting errors 50%" },
    ]));
    const sel = selectForJob(bank, cv(), job, opts({ lineBudget: 200 }));
    expect(sel.base.experience.map((e) => e.id)).toEqual(["present", "y2024", "y2023", "y2022", "nodate"]);
    expect(sel.base.experience.find((e) => e.id === "y2022")!.bullets.map((b) => b.id)).toEqual(["p0", "p1"]);
  });

  it("bank equal to a one-page active CV keeps every bullet and an empty report", () => {
    const exp: CvEntry[] = [
      { id: "x0", org: "Big Bank", title: "Summer Analyst", dates: "Jun 2025 - Aug 2025", location: "London", bullets: [
        { id: "x0-b0", text: "Cut month-end close time by 30% for a 12-person finance team" },
        { id: "x0-b1", text: "Served customers at the till" },
      ] },
      { id: "x1", org: "Corner Shop", title: "Assistant", dates: "2023", location: "", bullets: [{ id: "x1-b0", text: "Stocked shelves" }] },
    ];
    const proj: CvEntry[] = [{ id: "p0", org: "", title: "Bake sale", dates: "", location: "", bullets: [
      { id: "p0-b0", text: "Organised bake sales" }, { id: "p0-b1", text: "Designed posters" }, { id: "p0-b2", text: "Counted the money" },
    ] }];
    const active = cv({ experience: exp, projects: proj });
    const toBank = (e: CvEntry, section: BankEntry["section"], s: string | null, en: string | null) =>
      entry(`bank-${e.id}`, section, e.org, s, en, e.bullets.map((b) => ({ id: `bank-${b.id}`, text: b.text, sourceIds: [CV_SRC] })), { title: e.title, dates: e.dates, location: e.location, sourceIds: [CV_SRC] });
    const bank: Bank = { entries: [toBank(exp[0], "experience", "2025-06", "2025-08"), toBank(exp[1], "experience", "2023-01", "2023-12"), toBank(proj[0], "projects", null, null)] };
    const sel = selectForJob(bank, active, job, opts());
    expect(sel.lineBudget).toBe(DEFAULT_LINE_BUDGET);
    expect(sel.report).toEqual({ added: [], leftOut: [], pinnedOverflow: false });
    const strip = (es: CvEntry[]) => es.map((e) => ({ ...e, id: "", bullets: e.bullets.map((b) => b.text) }));
    expect(strip(sel.base.experience)).toEqual(strip(exp));
    expect(strip(sel.base.projects)).toEqual(strip(proj));
    expect(sel.base.experience[0].id).toBe("bank-x0");
    expect(sel.base.experience[0].bullets[0].id).toBe("bank-x0-b0");
    expect(sel.base.education).toEqual(active.education);
    expect(sel.base.skills).toEqual(active.skills);
  });

  it("over-long active CV with no extras is trimmed to the budget", () => {
    const long = "Analysed quarterly revenue data across twelve regional business units to identify cost savings opportunities and report them";
    const entries = Array.from({ length: 8 }, (_, i) =>
      entry(`e${i}`, "experience", `Org ${i}`, `20${15 + i}-01`, `20${15 + i}-06`,
        Array.from({ length: 4 }, (_, j) => ({ id: `e${i}-b${j}`, text: `${long} ${i}${j}`, sourceIds: [CV_SRC] })), { sourceIds: [CV_SRC] }));
    const bank: Bank = { entries };
    const sel = selectForJob(bank, cv(), job, opts());
    expect(cvLines(sel.base)).toBeLessThanOrEqual(DEFAULT_LINE_BUDGET);
    expect(sel.report.added).toEqual([]);
    expect(sel.report.leftOut.length).toBeGreaterThan(0);
    expect(sel.report.leftOut.every((i) => i.reason === "lower match for this role than the items kept")).toBe(true);
    // the page is filled: a left-out bullet of an included entry (2 lines each) would not still fit
    const included = new Set(allEntryIds(sel.base));
    const leftOverBullets = sel.report.leftOut.filter((i) => i.kind === "bullet" && included.has(i.entryId));
    if (leftOverBullets.length > 0) expect(DEFAULT_LINE_BUDGET - cvLines(sel.base)).toBeLessThan(estimateLines({ bullets: [{ text: long }] }) - 1);
  });

  it("pinned items alone over budget set pinnedOverflow and do not throw", () => {
    const long = "Coordinated a multi-week research project with academic supervisors and external partners producing a written report";
    const entries = Array.from({ length: 6 }, (_, i) =>
      entry(`e${i}`, "projects", `Org ${i}`, `20${18 + i}-01`, `20${18 + i}-06`,
        Array.from({ length: 4 }, (_, j) => ({ id: `e${i}-b${j}`, text: `${long} ${i}${j}`, pinned: true })), { pinned: true }));
    const sel = selectForJob({ entries }, cv(), job, opts({ lineBudget: 30 }));
    expect(sel.report.pinnedOverflow).toBe(true);
    expect(cvLines(sel.base)).toBeLessThanOrEqual(30);
    // most recent pinned entry is kept first
    expect(allEntryIds(sel.base)).toContain("e5");
    expect(allEntryIds(sel.base)).not.toContain("e0");
  });

  it("reasons name the covered must-haves", () => {
    const sel = selectForJob(quantBank(), cv(), job, opts({ lineBudget: 200 }));
    const quant = sel.report.added.find((i) => i.id === "e-quant");
    expect(quant?.kind).toBe("entry");
    expect(quant?.reason).toBe("covers 'Python', 'Statistics' (must-haves)");
    expect(sel.report.added.find((i) => i.id === "e-lead")?.reason).toBe("kept for a quantified result");
  });
});
