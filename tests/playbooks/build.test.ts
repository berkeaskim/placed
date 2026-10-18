import { describe, it, expect } from "vitest";
import { normalise, crossCheck, addShared, vocabCoverage, FROZEN_WORDS } from "@/scripts/build-playbooks";
import { SIGNAL_VALUES } from "@/lib/playbooks/schema";
import { PLAYBOOKS } from "@/lib/playbooks";
import { ARCHETYPES } from "@/lib/types";
import { SKILLS } from "@/lib/skills/vocab";

const canon = new Set(SKILLS.map((s) => s.canonical));

describe("playbook data", () => {
  it("covers all 8 archetypes with signals and actions", () => {
    for (const a of ARCHETYPES) {
      expect(PLAYBOOKS[a].signals.length).toBeGreaterThanOrEqual(5);
      expect(PLAYBOOKS[a].actions.length).toBeGreaterThanOrEqual(10);
    }
  });

  it("every source has a quote and access date; every linked action is verified", () => {
    for (const a of ARCHETYPES) {
      for (const x of [...PLAYBOOKS[a].signals, ...PLAYBOOKS[a].actions]) {
        for (const s of x.sources) {
          expect(s.quote.length).toBeGreaterThan(0);
          expect(s.accessed).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }
      }
      for (const act of PLAYBOOKS[a].actions) if (act.url) expect(act.verified).toBe(true);
    }
  });

  it("signals carry at least one source; A/B grades carry two", () => {
    for (const a of ARCHETYPES) for (const s of PLAYBOOKS[a].signals) {
      expect(s.sources.length).toBeGreaterThanOrEqual(1);
      if (s.grade === "A" || s.grade === "B") expect(s.sources.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("skills are canonical and signal refs resolve", () => {
    for (const a of ARCHETYPES) {
      const ids = new Set(PLAYBOOKS[a].signals.map((s) => s.id));
      for (const act of PLAYBOOKS[a].actions) {
        for (const sk of act.skills) expect(canon.has(sk), `${act.id} skill ${sk}`).toBe(true);
        for (const sig of act.signals) expect(ids.has(sig), `${act.id} signal ${sig}`).toBe(true);
      }
    }
  });

  it("has year guidance for every year", () => {
    for (const a of ARCHETYPES) for (const y of ["1st", "2nd", "penultimate", "final", "masters"] as const) {
      expect(PLAYBOOKS[a].yearGuidance[y], `${a} ${y}`).toBeTruthy();
    }
  });
});

describe("normalise", () => {
  const raw = {
    finance_banking: {
      signals: [],
      actions: [{ id: "X", type: "course", title: "t", description: "d", skills: [], signals: [], effort: "term", minYear: 2, evidence: "e", sources: [], timing: "Opens in January", kind: "build", signalValue: "test_prep", signalNote: "test prep only", cost: "free", free: true }],
      yearGuidance: { year1: "a", year2_penultimate: "b", final: "c", postgrad: "d", note: "n" },
      yearGuidanceDated: [{ year: "year1", text: "dated", expiresOn: "2027-01-03", ref: "X" }, { year: "year1", text: "expected", reviewBy: "2026-11-30", gradYears: [2029] }],
    },
  };

  it("maps finance minYear numbers and year-guidance keys", () => {
    const out = normalise(raw, []);
    expect(out.finance_banking.actions[0].minYear).toBe("2nd");
    expect(out.finance_banking.yearGuidance).toMatchObject({ "1st": "a", "2nd": "b", penultimate: "b", final: "c", masters: "d" });
    expect(out.finance_banking.note).toBe("n");
    expect(out.finance_banking.yearGuidanceDated[0]).toMatchObject({ year: "1st", expiresOn: "2027-01-03" });
  });

  it("keeps the honest signal labels, cost and kind through the build (06#3)", () => {
    const a = normalise(raw, []).finance_banking.actions[0];
    expect(a).toMatchObject({ kind: "build", signalValue: "test_prep", signalNote: "test prep only", cost: "Free" });
  });

  it("keeps reviewBy and gradYears on dated guidance (06#2, 06#30)", () => {
    expect(normalise(raw, []).finance_banking.yearGuidanceDated[1]).toMatchObject({ year: "1st", reviewBy: "2026-11-30", gradYears: [2029] });
  });

  it("rejects an action without a signal value", () => {
    const bad = structuredClone(raw);
    delete (bad.finance_banking.actions[0] as Record<string, unknown>).signalValue;
    expect(() => normalise(bad, [])).toThrow(/signalValue/);
  });

  it("appends timing to the description", () => {
    expect(normalise(raw, []).finance_banking.actions[0].description).toBe("d Opens in January");
  });

  it("inlines tech source refs from the top-level table", () => {
    const tech = {
      research: {
        signals: [{ id: "S", text: "t", grade: "C", ruleIds: [], sources: [{ ref: "R1", quote: "q", accessed: "2026-10-13" }] }],
        actions: [], yearGuidance: { "1st": "a" },
      },
    };
    const out = normalise(tech, [{ id: "R1", title: "T", publisher: "P", url: "https://example.org/x" }]);
    expect(out.research.signals[0].sources[0]).toEqual({ title: "T", publisher: "P", url: "https://example.org/x", quote: "q", accessed: "2026-10-13" });
  });

  it("throws on an unknown source ref", () => {
    const bad = { research: { signals: [{ id: "S", text: "t", grade: "C", ruleIds: [], sources: [{ ref: "R9", quote: "q", accessed: "2026-10-13" }] }], actions: [], yearGuidance: {} } };
    expect(() => normalise(bad, [])).toThrow(/R9/);
  });
});

describe("crossCheck", () => {
  const base = () => normalise({
    research: {
      signals: [{ id: "S1", text: "t", grade: "C", ruleIds: ["G-01"], sources: [{ quote: "q", accessed: "2026-10-13" }] }],
      actions: [{ id: "A1", type: "course", title: "t", description: "d", skills: ["Python"], signals: ["S1"], effort: "term", minYear: "1st", evidence: "e", url: "https://example.org", verified: true, sources: [], kind: "build", signalValue: "cv_low" }],
      yearGuidance: { "1st": "a" },
    },
  }, []);

  it("passes on clean data", () => {
    expect(crossCheck(base(), { requireAll: false })).toEqual([]);
  });
  it("flags unverified links, dangling signals, unknown skills and duplicate ids", () => {
    const pb = base();
    const a = pb.research.actions[0];
    pb.research.actions.push({ ...a, verified: false, signals: ["NOPE"], skills: ["Underwater Basket Weaving"] });
    const errs = crossCheck(pb, { requireAll: false }).join("\n");
    expect(errs).toMatch(/duplicate id A1/);
    expect(errs).toMatch(/not verified/);
    expect(errs).toMatch(/NOPE/);
    expect(errs).toMatch(/Underwater Basket Weaving/);
  });
  it("flags frozen relative time words, undated linked experiences and mis-kinded items (06#17, 06#30)", () => {
    const pb = base();
    const a = pb.research.actions[0];
    pb.research.actions.push(
      { ...a, id: "A2", description: "GS 2027 EMEA is open now, reviewed on a rolling basis." },
      { ...a, id: "A3", type: "experience", kind: "opportunity" },
      { ...a, id: "A4", type: "course", kind: "opportunity" },
      { ...a, id: "A5", type: "experience", kind: "opportunity", evergreen: true },
      { ...a, id: "A6", type: "experience", kind: "opportunity", reviewBy: "2027-01-01" },
    );
    pb.research.yearGuidance["2nd"] = "Applications close next month.";
    const errs = crossCheck(pb, { requireAll: false }).join("\n");
    expect(errs).toMatch(/A2: relative time word in description: open now/);
    expect(errs).toMatch(/A3: linked experience needs expiresOn, reviewBy or evergreen/);
    expect(errs).toMatch(/A4: only experiences can be opportunities/);
    expect(errs).not.toMatch(/A5|A6/);
    expect(errs).toMatch(/research\/2nd: relative time word/);
  });

  it("resolves sub-item rule ids to their base id and flags unknown ones", () => {
    const pb = base();
    pb.research.signals[0].ruleIds = ["G-01a", "ZZZ-99"];
    const errs = crossCheck(pb, { requireAll: false });
    expect(errs.join("\n")).toMatch(/ZZZ-99/);
    expect(errs.join("\n")).not.toMatch(/G-01a/);
  });
});

describe("shared access programmes", () => {
  it("copies a shared item into each listed archetype, dropping signal links it lacks", () => {
    const pbs = normalise({
      research: { signals: [{ id: "S1", text: "t", grade: "C", ruleIds: [], sources: [{ quote: "q", accessed: "2026-10-13" }] }], actions: [], yearGuidance: {} },
      product: { signals: [], actions: [], yearGuidance: {} },
    }, []);
    addShared(pbs, { actions: [{ id: "PB-ALL-E99", archetypes: ["research", "product"], type: "experience", kind: "opportunity", title: "t", description: "d", skills: [], signals: ["S1"], effort: "weekend", minYear: "1st", evidence: "e", sources: [], signalValue: "cv_high" }] });
    expect(pbs.research.actions[0]).toMatchObject({ id: "PB-ALL-E99", signals: ["S1"] });
    expect(pbs.product.actions[0]).toMatchObject({ id: "PB-ALL-E99", signals: [] });
    expect(crossCheck(pbs, { requireAll: false })).toEqual([]);
    expect(() => addShared(pbs, { actions: [{ id: "X-1", archetypes: ["research"] }] })).toThrow(/PB-ALL-/);
  });

  it("ships at least five verified access programmes, shown to every finance and consulting student (06#11)", () => {
    for (const a of ["finance_banking", "consulting"] as const) {
      const ids = PLAYBOOKS[a].actions.filter((x) => x.id.startsWith("PB-ALL-")).map((x) => x.id);
      expect(ids.length, a).toBeGreaterThanOrEqual(5);
    }
    for (const a of ARCHETYPES) for (const x of PLAYBOOKS[a].actions.filter((y) => y.id.startsWith("PB-ALL-"))) {
      expect(x.kind).toBe("opportunity");
      expect(x.description).toMatch(/Check eligibility yourself/);
    }
  });
});

describe("time-bound and eligibility data (06#30)", () => {
  const today = new Date().toISOString().slice(0, 10);
  const all = () => ARCHETYPES.flatMap((a) => PLAYBOOKS[a].actions.map((x) => ({ a, x })));

  it("every linked experience says when it stops being true", () => {
    for (const { a, x } of all()) if (x.type === "experience" && x.url) {
      expect(Boolean(x.expiresOn || x.reviewBy || x.evergreen), `${a}/${x.id}`).toBe(true);
    }
  });

  it("no shipped text freezes a relative time word", () => {
    for (const a of ARCHETYPES) {
      const pb = PLAYBOOKS[a];
      for (const x of pb.actions) expect(FROZEN_WORDS.test(x.description), `${a}/${x.id}`).toBe(false);
      for (const [y, t] of Object.entries(pb.yearGuidance)) expect(FROZEN_WORDS.test(t ?? ""), `${a}/${y}`).toBe(false);
      for (const d of pb.yearGuidanceDated) expect(FROZEN_WORDS.test(d.text), `${a} dated`).toBe(false);
    }
  });

  it("every action has a signal value; courses and practice are never opportunities", () => {
    for (const { a, x } of all()) {
      expect(SIGNAL_VALUES, `${a}/${x.id}`).toContain(x.signalValue);
      if (x.type === "course") expect(x.kind, `${a}/${x.id}`).toBe("build");
      if (x.eligibleGradYears) expect(x.kind, `${a}/${x.id}`).toBe("opportunity");
    }
  });

  it("no reviewBy is more than 30 days overdue: re-check the official page and move it (T7)", () => {
    const limit = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    for (const a of ARCHETYPES) {
      for (const x of [...PLAYBOOKS[a].actions, ...PLAYBOOKS[a].yearGuidanceDated]) {
        if (x.reviewBy) expect(x.reviewBy >= limit, `${a}: ${"id" in x ? x.id : x.text.slice(0, 40)} reviewBy ${x.reviewBy} (today ${today})`).toBe(true);
      }
    }
  });

  it("first-year-only programmes declare an upper year bound or graduation year", () => {
    for (const id of ["PB-QNT-E01", "PB-QNT-E06", "PB-FIN-E01", "PB-FIN-E04", "PB-FIN-E06", "PB-ALL-E05"]) {
      const x = all().find((y) => y.x.id === id)?.x;
      expect(x, id).toBeDefined();
      expect(Boolean(x?.maxYear || x?.eligibleGradYears?.length), id).toBe(true);
    }
  });
});

describe("vocab coverage report (07#4)", () => {
  it("counts vocab skills with no build action and the most demanded uncovered seed skills", () => {
    const pbs = { software_eng: PLAYBOOKS.software_eng } as Parameters<typeof vocabCoverage>[0];
    const jobs = [{ archetype: "software_eng", text_lines: ["Requirements", "Experience with Scala and Java"], requirements: [] }];
    const [r] = vocabCoverage(pbs, jobs);
    expect(r.archetype).toBe("software_eng");
    expect(r.uncovered).not.toContain("Java");
    expect(r.uncovered).toContain("Scala");
    expect(r.demandedUncovered.map((d) => d.skill)).toEqual(["Scala"]);
  });
});
