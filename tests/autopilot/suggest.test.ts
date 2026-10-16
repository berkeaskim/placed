import { describe, it, expect, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { contextLines, gateSuggestions } from "@/lib/autopilot/suggest";
import type { FormField } from "@/lib/autopilot/forms/types";

const F = (o: Partial<FormField> & Pick<FormField, "key" | "label" | "type">): FormField => ({ required: true, options: [], target: o.key, ...o });
const lines = ["languages: English, German (B1)", "Data Analyst Intern at Acme (2025)", "Programming: Python, SQL"];
const german = F({ key: "g", label: "Level of German?", type: "select", options: [{ label: "None", value: "0" }, { label: "Intermediate", value: "1" }] });
const tools = F({ key: "t", label: "Which tools do you use?", type: "text" });
const offices = F({ key: "o", label: "Offices?", type: "multiselect", options: [{ label: "London", value: "L" }, { label: "Dublin", value: "D" }] });
const relocate = F({ key: "r", label: "Happy to relocate?", type: "boolean" });

describe("gateSuggestions", () => {
  it("keeps cited answers that fit the field", () => {
    const out = gateSuggestions({ answers: [
      { key: "g", answer: "Intermediate", evidence: ["d:0"] },
      { key: "t", answer: "Python, SQL", evidence: ["d:2"] },
      { key: "o", answer: "London, Dublin", evidence: ["d:1"] },
      { key: "r", answer: "Yes", evidence: ["d:1"] },
    ] }, [german, tools, offices, relocate], lines);
    expect(out).toEqual({ g: "1", t: "Python, SQL", o: ["L", "D"], r: "true" });
  });
  it("drops uncited, badly cited, null, unknown and off-option answers", () => {
    const out = gateSuggestions({ answers: [
      { key: "g", answer: "Intermediate", evidence: [] },
      { key: "t", answer: "Python", evidence: ["d:99"] },
      { key: "r", answer: null, evidence: ["d:0"] },
      { key: "zzz", answer: "Yes", evidence: ["d:0"] },
      { key: "o", answer: "Paris", evidence: ["d:1"] },
    ] }, [german, tools, offices, relocate], lines);
    expect(out).toEqual({});
  });
  it("drops a text answer that is not in the cited lines", () => {
    expect(gateSuggestions({ answers: [{ key: "t", answer: "Kubernetes", evidence: ["d:2"] }] }, [tools], lines)).toEqual({});
  });
});

describe("contextLines", () => {
  it("never includes right to work, sponsorship or EEO answers", () => {
    const out = contextLines({ rtw_uk: "needs_sponsorship", needs_sponsorship: "yes", city: "London", country: "UK" }, { "what is your gender": "x", "level of german": "Intermediate" }, null).join("\n");
    expect(out).toContain("location: London, UK");
    expect(out).toContain("level of german: Intermediate");
    expect(out).not.toMatch(/sponsor|gender|rtw/i);
  });
});
