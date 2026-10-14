import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseLinkedInExport } from "@/lib/linkedin/parse-export";

// Synthetic export for the FICTIONAL demo persona (seed/demo/ayse.json). Not a real LinkedIn export:
// replace with real "Save to PDF" fixtures before trusting the parser (playbook §10).
const TEXT = readFileSync(path.join(__dirname, "fixtures", "ayse-synthetic-export.txt"), "utf8");

describe("parseLinkedInExport (single text stream, sidebar first)", () => {
  const li = parseLinkedInExport(TEXT, { knownName: "Ayşe Demir" });

  it("reads the top card", () => {
    expect(li.name).toBe("Ayşe Demir");
    expect(li.headline).toBe("Student at University College London");
    expect(li.location).toBe("London, England, United Kingdom");
  });

  it("reads the sidebar sections and stops the last one at the name", () => {
    expect(li.profileUrl).toBe("www.linkedin.com/in/ayse-demir-4b7a91c2");
    expect(li.email).toBe("ayse.demir.demo@example.com");
    expect(li.topSkills).toEqual(["Microsoft Excel", "Teamwork", "Python"]);
    expect(li.languages).toHaveLength(2);
    expect(li.certifications).toEqual(["Google Data Analytics Professional Certificate"]);
  });

  it("reads About, Experience and Education and drops page footers", () => {
    expect(li.about).toBe("Passionate and driven Economics student who loves data.");
    expect(li.experience).toHaveLength(2);
    expect(li.experience[0]).toMatchObject({
      company: "UCL Finance Society", title: "Events Officer", start: { year: 2024, month: 9 }, end: null,
      location: "London, England, United Kingdom",
    });
    expect(li.experience[0].description).toBe("Organised weekly society events.\nManaged a £2,000 events budget.");
    expect(li.experience[1]).toMatchObject({ company: "Marlowe Café", title: "Barista", start: { year: 2024, month: null }, end: { year: 2025, month: null } });
    expect(li.education).toEqual([
      { school: "University College London", degree: "Bachelor of Science - BSc, Economics", startYear: 2025, endYear: 2028, details: "" },
    ]);
    expect(li.sections).toEqual(expect.arrayContaining(["Contact", "Top Skills", "Summary", "Experience", "Education"]));
  });

  it("guesses the top card without a known name and says so", () => {
    const guess = parseLinkedInExport(TEXT);
    expect(guess.headline).toBe("Student at University College London");
    expect(guess.certifications).toEqual(["Google Data Analytics Professional Certificate"]);
    expect(guess.warnings).toContain("top_card_guessed");
  });
});

describe("parseLinkedInExport (positioned lines)", () => {
  it("splits columns by x and takes the largest text as the name", () => {
    const li = parseLinkedInExport([
      { text: "Contact", x: 30, size: 13, page: 1 },
      { text: "Jo Bloggs", x: 220, size: 26, page: 1 },
      { text: "jo@example.com", x: 30, size: 10, page: 1 },
      { text: "Maths @ Warwick | Python, C++ | Seeking Summer 2027 quant internships", x: 220, size: 12, page: 1 },
      { text: "Top Skills", x: 30, size: 13, page: 1 },
      { text: "Coventry, England, United Kingdom", x: 220, size: 10, page: 1 },
      { text: "Python", x: 30, size: 10, page: 1 },
      { text: "Experience", x: 220, size: 15, page: 1 },
      { text: "Optiver", x: 220, size: 12, page: 1 },
      { text: "1 year 2 months", x: 220, size: 10, page: 1 },
      { text: "Insight Day Participant", x: 220, size: 11, page: 1 },
      { text: "March 2026 - March 2026 (1 month)", x: 220, size: 10, page: 1 },
    ]);
    expect(li.name).toBe("Jo Bloggs");
    expect(li.headline).toBe("Maths @ Warwick | Python, C++ | Seeking Summer 2027 quant internships");
    expect(li.location).toBe("Coventry, England, United Kingdom");
    expect(li.topSkills).toEqual(["Python"]);
    expect(li.experience[0]).toMatchObject({ company: "Optiver", title: "Insight Day Participant" });
  });
});
