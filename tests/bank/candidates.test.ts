import { describe, expect, it } from "vitest";
import { fromLinkedIn, fromParsedCv } from "@/lib/bank/candidates";
import type { ParsedCV } from "@/lib/types";
import type { ParsedLinkedIn } from "@/lib/linkedin/parse-export";

const cv = {
  name: "A", email: null, phone: null, location: null, links: [], summary: null, education: [],
  experience: [{ id: "e1", org: "Acme", title: "Analyst", dates: "Jun 2024 - Aug 2024", location: "London", bullets: [{ id: "b1", text: "Built a model" }] }],
  projects: [{ id: "p1", org: "Placed", title: "Founder", dates: "2025", location: "", bullets: [] }],
  leadership: [{ id: "l1", org: "Society", title: "Treasurer", dates: "2025", location: "", bullets: [{ id: "b2", text: "Ran budget" }] }],
  skills: [], interests: null, sectionOrder: [], yearGuess: null, archetypes: [],
} as unknown as ParsedCV;

const li = (experience: Partial<ParsedLinkedIn["experience"][number]>[]) => ({
  experience: experience.map((e) => ({ company: "X", title: "T", dates: "", start: null, end: null, location: null, description: "", ...e })),
}) as unknown as ParsedLinkedIn;

describe("fromParsedCv", () => {
  it("keeps sections and bullet text and parses startYm", () => {
    const c = fromParsedCv(cv);
    expect(c.map((x) => x.section)).toEqual(["experience", "projects", "leadership"]);
    expect(c[0].bullets).toEqual([{ text: "Built a model", sourceText: "Built a model" }]);
    expect(c[0].startYm).toBe("2024-06");
    expect(c[0].endYm).toBe("2024-08");
  });
});

describe("fromLinkedIn", () => {
  it("routes Project: titles to projects with the prefix stripped", () => {
    const c = fromLinkedIn(li([{ company: "Self", title: "Project: Placed" }]));
    expect(c[0].section).toBe("projects");
    expect(c[0].title).toBe("Placed");
  });
  it("splits a description into bullets and drops short lines", () => {
    const c = fromLinkedIn(li([{
      dates: "June 2025 - August 2025 (3 months)",
      description: "• Built a pricing model for retail\n- Led a team of four analysts\n* Presented findings to the board\nShort line",
    }]));
    expect(c[0].section).toBe("experience");
    expect(c[0].bullets.map((b) => b.text)).toEqual([
      "Built a pricing model for retail", "Led a team of four analysts", "Presented findings to the board",
    ]);
    expect(c[0].startYm).toBe("2025-06");
  });
});
