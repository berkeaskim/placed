import { describe, it, expect } from "vitest";
import { normalise, crossCheck } from "@/scripts/build-playbooks";
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
      actions: [{ id: "X", type: "course", title: "t", description: "d", skills: [], signals: [], effort: "term", minYear: 2, evidence: "e", sources: [], timing: "Opens in January" }],
      yearGuidance: { year1: "a", year2_penultimate: "b", final: "c", postgrad: "d", note: "n" },
      yearGuidanceDated: [{ year: "year1", text: "dated", expiresOn: "2027-01-03", ref: "X" }],
    },
  };

  it("maps finance minYear numbers and year-guidance keys", () => {
    const out = normalise(raw, []);
    expect(out.finance_banking.actions[0].minYear).toBe("2nd");
    expect(out.finance_banking.yearGuidance).toMatchObject({ "1st": "a", "2nd": "b", penultimate: "b", final: "c", masters: "d" });
    expect(out.finance_banking.note).toBe("n");
    expect(out.finance_banking.yearGuidanceDated[0]).toMatchObject({ year: "1st", expiresOn: "2027-01-03" });
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
      actions: [{ id: "A1", type: "course", title: "t", description: "d", skills: ["Python"], signals: ["S1"], effort: "term", minYear: "1st", evidence: "e", url: "https://example.org", verified: true, sources: [] }],
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
  it("resolves sub-item rule ids to their base id and flags unknown ones", () => {
    const pb = base();
    pb.research.signals[0].ruleIds = ["G-01a", "ZZZ-99"];
    const errs = crossCheck(pb, { requireAll: false });
    expect(errs.join("\n")).toMatch(/ZZZ-99/);
    expect(errs.join("\n")).not.toMatch(/G-01a/);
  });
});
