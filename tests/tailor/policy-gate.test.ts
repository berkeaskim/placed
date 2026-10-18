/** Audit 05 #13: the employer's AI policy is checked before any AI rewrite of the CV. */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { tailorForJob } from "@/app/(app)/jobs/[id]/actions";
import { seedCv, seedJob, withTempDb } from "../cv/temp-db";
import type { ParsedCV } from "@/lib/types";

withTempDb();
const prevMode = process.env.AI_MODE;
beforeAll(() => { process.env.AI_MODE = "fixture"; });
afterAll(() => { if (prevMode === undefined) delete process.env.AI_MODE; else process.env.AI_MODE = prevMode; });

const parsed: ParsedCV = {
  name: "Sam", email: null, phone: null, location: "London", links: [], summary: null,
  education: [{ id: "e0", institution: "UCL", degree: "BSc Economics", dates: "2024–2027", grade: null, details: [] }],
  experience: [{ id: "x0", org: "Finance Society", title: "Events Officer", dates: "2025", location: "", bullets: [{ id: "x0-b0", text: "Organised monthly events for 60 members" }] }],
  projects: [], leadership: [], skills: [{ group: "Skills", items: ["Excel"] }], interests: null, sectionOrder: [], yearGuess: null, archetypes: [],
};

describe("tailorForJob and employer AI policy", () => {
  beforeAll(() => { seedCv({ parsed_json: parsed as never, raw_text: "Organised monthly events for 60 members\nExcel", is_active: true }); });

  it("Bain London: shows the grammar-only notice before anything runs", async () => {
    const job = seedJob({ title: "Associate Consultant", archetype: "consulting", text_lines: ["Associate Consultant, London office"] }, { name: "Bain & Company" });
    const r = await tailorForJob(job.id);
    expect(r).toMatchObject({ error: "ai_policy", policyNotice: { grammarOnly: true, sourceUrl: "https://www.bain.com/careers/recruiting/london-recruiting/" } });
  });

  it("an advert that bans AI stops tailoring with its own words", async () => {
    const job = seedJob({ title: "Analyst Intern", text_lines: ["Use of AI tools is not permitted."] }, { name: "Acme" });
    const r = await tailorForJob(job.id);
    expect("error" in r && r.error).toMatch(/not to use AI/);
  });

  it("an employer with no known policy tailors as before (no notice)", async () => {
    const job = seedJob({ title: "Analyst Intern", text_lines: ["Excel"] }, { name: "Acme" });
    const r = await tailorForJob(job.id);
    expect("error" in r && r.error === "ai_policy").toBe(false);
  });
});
