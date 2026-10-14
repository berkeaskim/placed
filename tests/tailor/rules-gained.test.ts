import { describe, it, expect } from "vitest";
import { rulesGained, tailoredAsParsed } from "@/lib/tailor/rules-gained";
import { toTailored } from "@/lib/verify/tailoring";
import type { ParsedCV } from "@/lib/types";

const bullets = ["Organised weekly socials", "Helped with the newsletter", "Answered member emails", "Updated the website"];
const cv: ParsedCV = {
  name: "A", email: "a@b.co", phone: "07000000000", location: null, links: [], summary: null,
  education: [{ id: "e0", institution: "UCL", degree: "BSc Economics", dates: "", grade: "2:1", details: [] }],
  experience: [{ id: "x0", org: "Society", title: "Officer", dates: "", location: "", bullets: bullets.map((text, i) => ({ id: `x0-b${i}`, text })) }],
  projects: [], leadership: [], skills: [{ group: "Skills", items: ["Excel"] }], interests: null, sectionOrder: [], yearGuess: null, archetypes: [],
};

describe("rulesGained (score after tailoring)", () => {
  it("is zero for an unchanged CV", () => {
    expect(rulesGained(cv, toTailored(cv), "data_analytics", "2nd")).toEqual({ gained: 0, lost: 0, dims: [] });
  });
  it("credits a rule that flips to pass, in its dimension", () => {
    const t = toTailored(cv);
    t.experience[0].bullets[0].text = "Organised 12 weekly socials for 80 members";
    t.experience[0].bullets[1].text = "Wrote 6 newsletter issues";
    const r = rulesGained(cv, t, "data_analytics", "2nd");
    expect(r.gained).toBeGreaterThan(0);
    expect(r.dims.find((d) => d.dimension === "impact")?.gained).toBeGreaterThan(0);
  });
  it("renders unresolved placeholders at the original wording and leaves dropped lines out", () => {
    const t = toTailored(cv);
    t.experience[0].bullets[0] = { ...t.experience[0].bullets[0], text: "Organised NEEDS_NUMBER socials", changeType: "rephrased" };
    t.experience[0].bullets[3] = { ...t.experience[0].bullets[3], changeType: "dropped" };
    const p = tailoredAsParsed(t, cv);
    expect(p.experience[0].bullets.map((b) => b.text)).toEqual(bullets.slice(0, 3));
    expect(p.email).toBe("a@b.co");
  });
});
