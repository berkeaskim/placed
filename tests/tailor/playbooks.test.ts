import { describe, it, expect } from "vitest";
import { playbookPrompt, tailorPlaybook } from "@/lib/tailor/playbooks";
import { buildTailorPrompt } from "@/lib/ai/tailorCV";
import { SYSTEM_TAILOR, TAILOR_TARGET } from "@/lib/ai/prompts";
import { ARCHETYPES, type ParsedCV } from "@/lib/types";
import type { JobListItem } from "@/lib/db/queries";

const cv = {
  name: "Test", email: null, phone: null, location: "", links: [], summary: null, education: [],
  experience: [{ id: "x0", org: "Shop", title: "Assistant", dates: "2025", location: "", bullets: [{ id: "x0-b0", text: "Served customers" }] }],
  projects: [], leadership: [], skills: [], interests: "", sectionOrder: [], yearGuess: null, archetypes: [],
} as unknown as ParsedCV;
const jobFor = (archetype: string | null) => ({
  id: "j", extId: "k", company: "Acme", url: "", summary: "", title: "Intern", location: "", remote: false, archetype,
  yearEligibility: [], sponsorsVisa: "unknown", employmentType: "internship", firstYearFriendly: false, requirements: [],
  textLines: ["- Excel"], deadline: null, postedAt: null,
}) as unknown as JobListItem;

describe("tailoring playbooks", () => {
  it("has a playbook for every archetype", () => {
    for (const a of ARCHETYPES) {
      expect(tailorPlaybook(a), a).not.toBeNull();
      expect(playbookPrompt(a)).toMatch(/^ROLE PLAYBOOK: .*never a source of facts/);
    }
  });

  it("is injected into the tailor prompt for the job's archetype only", () => {
    const data = buildTailorPrompt({ cv, job: jobFor("data_analytics"), allowed: [], supported: [], feedback: null });
    const cons = buildTailorPrompt({ cv, job: jobFor("consulting"), allowed: [], supported: [], feedback: null });
    expect(data).toContain("ROLE PLAYBOOK: Data & Analytics");
    expect(cons).toContain("ROLE PLAYBOOK: Consulting");
    expect(data).not.toEqual(cons);
    expect(buildTailorPrompt({ cv, job: jobFor(null), allowed: [], supported: [], feedback: null })).not.toContain("ROLE PLAYBOOK");
  });

  it("comes after the untrusted posting, outside its tags", () => {
    const p = buildTailorPrompt({ cv, job: jobFor("product"), allowed: [], supported: [], feedback: null });
    expect(p.indexOf("ROLE PLAYBOOK")).toBeGreaterThan(p.lastIndexOf("</job_posting>"));
  });

  it("system prompt asks for select/reorder and minimal edits (audit 05 #11)", () => {
    // audit 05 #11: select/reorder + minimal edits, not "a substantial rewrite" where "unchanged is never the safe default"
    expect(SYSTEM_TAILOR).toContain(`At most ${TAILOR_TARGET.max} changes`);
    expect(TAILOR_TARGET.max).toBeLessThanOrEqual(8);
    expect(SYSTEM_TAILOR).not.toMatch(/never the safe default|substantial/);
    expect(SYSTEM_TAILOR).toMatch(/Prefer, in this order: \(1\) reorder/);
    // 05 #1: never create a profile; 05 #17: no keyword placement across summary + first bullets + skills
    expect(SYSTEM_TAILOR).toMatch(/if the CV has no summary, return summary: null/i);
    expect(SYSTEM_TAILOR).not.toMatch(/write one, 1-2 lines/);
    expect(SYSTEM_TAILOR).not.toMatch(/Distribute the top posting keywords/);
    expect(SYSTEM_TAILOR).toMatch(/never a source of facts|only from facts already in the CV/);
  });

  // audit 05 #10: the formulas contradicted SYSTEM_TAILOR ("No numbers", "never write the target role")
  it("no summary formula asks for numbers, metrics, a target role or a quantified fact", () => {
    for (const a of ARCHETYPES) expect(tailorPlaybook(a)!.summaryFormula, a).not.toMatch(/\bnumbers?\b|\bmetrics?\b|\btarget\b|quantified/i);
    for (const a of ARCHETYPES) expect(tailorPlaybook(a)!.summaryFormula, a).toMatch(/never write one/);
  });

  // audit 05 #9: reframes whose target is a skill label the gate always blocks were dead letters
  it("drops the dead-letter reframes and the Bain policy line", () => {
    const all = ARCHETYPES.flatMap((a) => tailorPlaybook(a)!.reframes.map((r) => r.to.toLowerCase()));
    expect(all.some((t) => t.startsWith("client-facing"))).toBe(false);
    expect(all).not.toContain("stakeholder management");
    expect(JSON.stringify(ARCHETYPES.map((a) => tailorPlaybook(a)!.pitfalls))).not.toMatch(/Bain/);
  });

  it("grammar-only mode leaves the playbook out", () => {
    const p = buildTailorPrompt({ cv, job: jobFor("consulting"), allowed: [], supported: [], feedback: null, mode: "grammar_only" });
    expect(p).not.toContain("ROLE PLAYBOOK");
  });
});

import { normalizeTailored } from "@/lib/ai/tailorCV";
import { TailoredCvFixture } from "@/lib/ai/schemas";
import { runTailoring } from "@/lib/tailor/run";

describe("punctuation-only edits are not suggestions", () => {
  const two = {
    ...cv,
    experience: [{ id: "x0", org: "Shop", title: "Assistant", dates: "2025", location: "", bullets: [
      { id: "x0-b0", text: "Served customers" }, { id: "x0-b1", text: "Trained 3 new staff on the till" },
    ] }],
  } as unknown as ParsedCV;
  const raw = (texts: [string, string], changeType = "rephrased") => TailoredCvFixture.parse({
    summary: null, skills: [], changes: [],
    experience: [{ id: "x0", org: "Shop", title: "Assistant", dates: "2025", location: "", bullets: [
      { id: "x0-b0", text: texts[0], sourceRefs: ["x0-b0"], changeType },
      { id: "x0-b1", text: texts[1], sourceRefs: ["x0-b1"], changeType },
    ] }],
  });

  it("restores the student's line when only punctuation or case changed", () => {
    const t = normalizeTailored(raw(["Served customers.", "Trained 3 new staff on the till to cut queues"]), two);
    expect(t.experience[0].bullets[0].text).toBe("Served customers");
    expect(t.experience[0].bullets[1].text).toBe("Trained 3 new staff on the till to cut queues");
  });

  it("does not count a model-labelled 'rephrased' line with unchanged text", async () => {
    const tailor = async () => normalizeTailored(raw(["Served customers.", "Trained 3 new staff on the till"]), two);
    const o = await runTailoring({ cv: two, rawText: "Served customers\nTrained 3 new staff on the till", job: jobFor("data_analytics"), confirmedFacts: [], tailor });
    expect(o.changes.filter((c) => c.section === "experience")).toEqual([]);
  });
});
