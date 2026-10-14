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

  it("system prompt asks for a substantial rewrite with the agreed target", () => {
    expect(SYSTEM_TAILOR).toContain(`${TAILOR_TARGET.min}-${TAILOR_TARGET.max} changes`);
    expect(SYSTEM_TAILOR).toMatch(/never the safe default/);
    expect(SYSTEM_TAILOR).toMatch(/never a source of facts|only from facts already in the CV/);
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
