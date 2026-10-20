import { describe, expect, it } from "vitest";
import { buildTailorPrompt } from "@/lib/ai/tailorCV";
import { rulesGained } from "@/lib/tailor/rules-gained";
import { TailorPlaybook } from "@/lib/tailor/playbooks";
import {
  PLACEMENT_TAILOR_BLOCK, placementPlaybook, SPRING_PLAYBOOK, SPRING_TAILOR_BLOCK, trackForJob, trackOverlayPrompt,
} from "@/lib/tailor/track";
import { toTailored } from "@/lib/verify/tailoring";
import type { JobListItem } from "@/lib/db/queries";
import type { ParsedCV } from "@/lib/types";

const cv: ParsedCV = {
  name: "A", email: "a@b.co", phone: "07000000000", location: null, links: [], summary: null,
  education: [{ id: "e0", institution: "UCL", degree: "BSc Economics", dates: "2025–2028", grade: null, details: [] }],
  experience: [{ id: "x0", org: "Tesco", title: "Customer Assistant", dates: "2024–2025", location: "", bullets: [
    { id: "x0-b0", text: "Served customers on the tills at weekends" }, { id: "x0-b1", text: "Trained new starters on the self-checkout" },
    { id: "x0-b2", text: "Handled the cash office on Sundays" }, { id: "x0-b3", text: "Restocked the chilled aisle" },
  ] }],
  projects: [], leadership: [], skills: [{ group: "Skills", items: ["Excel"] }], interests: null, sectionOrder: [], yearGuess: null, archetypes: [],
};
const job = (employmentType: string, archetype = "finance_banking") => ({
  id: "j", extId: "k", company: "Acme", url: "https://x", summary: "", title: "Programme", location: "London", remote: false,
  archetype, yearEligibility: [], sponsorsVisa: "unknown", employmentType, firstYearFriendly: false,
  requirements: [], textLines: ["About the programme"], deadline: null, postedAt: null,
}) as unknown as JobListItem;
const prompt = (j: JobListItem, extra: Partial<Parameters<typeof buildTailorPrompt>[0]> = {}) =>
  buildTailorPrompt({ cv, job: j, allowed: [], supported: [], feedback: null, ...extra });

describe("trackForJob", () => {
  it("maps employment types to tracks", () => {
    expect(trackForJob({ employmentType: "spring_week" })).toBe("spring");
    expect(trackForJob({ employmentType: "insight" })).toBe("spring");
    expect(trackForJob({ employmentType: "placement" })).toBe("placement");
    for (const t of ["internship", "graduate", "permanent", "other"] as const) expect(trackForJob({ employmentType: t })).toBe("standard");
    expect(trackForJob(null)).toBe("standard");
  });
});

describe("track overlays in the tailoring prompt", () => {
  it("adds nothing for an internship", () => {
    const p = prompt(job("internship"));
    expect(p).not.toContain("SPRING WEEK / INSIGHT MODE");
    expect(p).not.toContain("PLACEMENT YEAR MODE");
    expect(p).not.toContain("ROLE PLAYBOOK OVERLAY");
  });
  it("adds the spring block and overlay after the sector playbook", () => {
    const p = prompt(job("spring_week"));
    expect(p).toContain(SPRING_TAILOR_BLOCK);
    expect(p.indexOf("ROLE PLAYBOOK:")).toBeGreaterThanOrEqual(0);
    expect(p.indexOf("ROLE PLAYBOOK OVERLAY: Spring week / insight")).toBeGreaterThan(p.indexOf("ROLE PLAYBOOK:"));
  });
  it("adds the placement block, and availability only when given", () => {
    const p = prompt(job("placement", "software_eng"));
    expect(p).toContain(PLACEMENT_TAILOR_BLOCK);
    expect(p).not.toContain("AVAILABILITY (from");
    expect(prompt(job("placement"), { availability: "1 Jun 2027 to 31 Aug 2028" })).toContain("AVAILABILITY (from the student's own setup): 1 Jun 2027 to 31 Aug 2028");
    expect(prompt(job("internship"), { availability: "1 Jun 2027" })).not.toContain("AVAILABILITY");
  });
  it("grammar-only mode gets no overlay or block", () => {
    const p = prompt(job("spring_week"), { mode: "grammar_only" });
    expect(p).not.toContain("SPRING WEEK");
    expect(p).not.toContain("OVERLAY");
  });
  it("placement section order is projects-first for STEM and banking-style for business", () => {
    expect(placementPlaybook("software_eng").sectionOrder[1]).toBe("Technical Projects");
    expect(placementPlaybook("finance_banking").sectionOrder[1]).toBe("Experience");
    expect(trackOverlayPrompt("standard", "finance_banking")).toBeNull();
  });
  it("overlays parse as playbooks", () => {
    expect(TailorPlaybook.safeParse(SPRING_PLAYBOOK).success).toBe(true);
    expect(TailorPlaybook.safeParse(placementPlaybook("software_eng")).success).toBe(true);
  });
});

describe("rulesGained on the job's track", () => {
  it("judges a spring job on spring thresholds", () => {
    // One quantified bullet of four (0.25) clears the spring quantified threshold (0.2), not the standard one (0.4).
    const t = toTailored(cv);
    t.experience[0].bullets[1].text = "Trained 4 new starters on the self-checkout";
    const spring = rulesGained(cv, t, "finance_banking", "1st", "spring");
    const standard = rulesGained(cv, t, "finance_banking", "2nd", "standard");
    expect(spring.gained).toBeGreaterThan(standard.gained);
  });
});
