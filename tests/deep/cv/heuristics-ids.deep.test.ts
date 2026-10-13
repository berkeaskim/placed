import { describe, it, expect } from "vitest";
import { heuristicParseCv } from "@/lib/ai/heuristics";
import { assignIds } from "@/lib/cv/ids";
import { isImageOnly } from "@/lib/cv/image-only";
import type { ParsedCV } from "@/lib/types";

const allIds = (cv: ParsedCV) => [
  ...cv.education.flatMap((e) => [e.id, ...e.details.map((d) => d.id)]),
  ...[...cv.experience, ...cv.projects, ...cv.leadership].flatMap((e) => [e.id, ...e.bullets.map((b) => b.id)]),
];

const MESSY = [
  "JANE DOE",
  "jane.doe+cv@example.co.uk | +44 (0) 7700 900123 | London, UK",
  "linkedin.com/in/jane-doe | https://github.com/janedoe",
  "PROFILE:",
  "Second-year economics student interested in markets.",
  "EDUCATION",
  "London School of Economics — BSc Economics, 2024–2027",
  "Predicted First (72%)",
  "• Modules: Econometrics, Game Theory",
  "WORK EXPERIENCE:",
  "Acme Bank — Spring Insight, 2025–2025",
  "• Shadowed the equity research desk",
  "– Built a DCF model in Excel",
  "* Presented findings to an MD",
  "- Wrote a market summary",
  "▪ Ran comps",
  "1. Numbered achievement",
  "Foo Ltd — Data Intern, 2024–present",
  "◦ Automated reporting in Python",
  "LEADERSHIP & ACTIVITIES",
  "Economics Society — Treasurer, 2025–present",
  "· Managed a £5k budget",
  "SKILLS & INTERESTS",
  "Languages: Python, SQL; Tools: Excel | Bloomberg",
  "INTERESTS",
  "Chess, running",
].join("\n");

describe("heuristicParseCv — messy real-world layouts", () => {
  const cv = heuristicParseCv(MESSY);

  it("recognises ALL-CAPS headings with trailing colons and '&' variants", () => {
    expect(cv.sectionOrder).toEqual(["education", "experience", "leadership", "skills", "interests"]);
    expect(cv.summary).toBe("Second-year economics student interested in markets.");
  });
  it("extracts contact details and links", () => {
    expect(cv.name).toBe("JANE DOE");
    expect(cv.email).toBe("jane.doe+cv@example.co.uk");
    expect(cv.phone).toMatch(/7700 900123/);
    expect(cv.location).toBe("London");
    expect(cv.links).toEqual(expect.arrayContaining(["linkedin.com/in/jane-doe", "https://github.com/janedoe"]));
  });
  it("treats •, –, *, -, ▪, ◦, · and '1.' as bullets", () => {
    expect(cv.experience.map((e) => e.org)).toEqual(["Acme Bank", "Foo Ltd"]);
    expect(cv.experience[0].bullets.map((b) => b.text)).toEqual([
      "Shadowed the equity research desk", "Built a DCF model in Excel", "Presented findings to an MD",
      "Wrote a market summary", "Ran comps", "Numbered achievement",
    ]);
    expect(cv.experience[1]).toMatchObject({ title: "Data Intern", dates: "2024–present" });
    expect(cv.experience[1].bullets[0].text).toBe("Automated reporting in Python");
    expect(cv.leadership[0].bullets[0].text).toBe("Managed a £5k budget");
  });
  it("parses education, grade and strips bullets from details", () => {
    expect(cv.education[0]).toMatchObject({ institution: "London School of Economics", degree: "BSc Economics, 2024–2027", dates: "2024–2027", grade: "Predicted First (72%)" });
    expect(cv.education[0].details.map((d) => d.text)).toEqual(["Predicted First (72%)", "Modules: Econometrics, Game Theory"]);
  });
  it("splits skills on , ; | and strips 'Group:' prefixes", () => {
    expect(cv.skills[0].items).toEqual(["Python", "SQL", "Excel", "Bloomberg"]);
  });
  it("hyphenated words are not bullets and don't create empty entries", () => {
    const r = heuristicParseCv("EXPERIENCE\nWell-known Co — Intern, 2024–2025\n-not a bullet without space");
    expect(r.experience[0].org).toBe("Well-known Co");
    expect(r.experience).toHaveLength(2);
  });
  it("no sections at all → empty structured lists, name from first line, no throw", () => {
    const r = heuristicParseCv("Just a paragraph about me and my love of data and python.\nAnother line");
    expect(r).toMatchObject({ education: [], experience: [], projects: [], leadership: [], skills: [], sectionOrder: [] });
    expect(r.name).toMatch(/^Just a paragraph/);
  });
  it("empty / whitespace-only / CRLF input", () => {
    expect(heuristicParseCv("").name).toBe("");
    expect(heuristicParseCv("   \n\n\t").archetypes).toEqual([]);
    const crlf = heuristicParseCv("A B\r\nEXPERIENCE\r\nX Co — Y, 2024–2025\r\n• did z");
    expect(crlf.experience[0].bullets[0].text).toBe("did z");
  });
  it("a bullet before any entry header creates a placeholder entry instead of being dropped", () => {
    const r = heuristicParseCv("PROJECTS\n• Built a chess engine in C++");
    expect(r.projects).toEqual([{ id: "", org: "", title: "", dates: "", location: "", bullets: [{ id: "", text: "Built a chess engine in C++" }] }]);
  });
  it("multi-page text (pages joined by newlines) keeps entries from both pages", () => {
    const page1 = "Sam\nEXPERIENCE\nA Co — Intern, 2023–2024\n• one";
    const page2 = "B Co — Analyst, 2024–2025\n• two\nSKILLS\nGit";
    const r = heuristicParseCv([page1, page2].join("\n"));
    expect(r.experience.map((e) => e.org)).toEqual(["A Co", "B Co"]);
    expect(r.skills[0].items).toEqual(["Git"]);
  });
  // BUG: a heading that appears twice (e.g. "EXPERIENCE" repeated at the top of page 2) resets the section
  // (`sections[current] = []`), silently discarding everything parsed under the first occurrence.
  it.fails("a repeated section heading appends rather than discarding earlier entries", () => {
    const r = heuristicParseCv("Sam\nEXPERIENCE\nA Co — Intern, 2023–2024\n• one\nEXPERIENCE\nB Co — Analyst, 2024–2025\n• two");
    expect(r.experience.map((e) => e.org)).toEqual(["A Co", "B Co"]);
  });
  // BUG: "●" (U+25CF, Word's default bullet) and "" (Symbol-font PUA) are not in BULLET, so each bullet
  // becomes its own entry and the role loses all its bullets.
  it.fails("treats ● and  (common Word/Symbol-font bullets) as bullets", () => {
    const r = heuristicParseCv("EXPERIENCE\nA Co — Intern, 2023–2024\n● Built models\n Presented");
    expect(r.experience).toHaveLength(1);
    expect(r.experience[0].bullets.map((b) => b.text)).toEqual(["Built models", "Presented"]);
  });
  it("is deterministic and never throws on adversarial input", () => {
    const evil = "<script>alert(1)</script>\nEXPERIENCE\n" + "• ".repeat(5000) + "\n" + "word ".repeat(20_000);
    const a = heuristicParseCv(evil);
    expect(heuristicParseCv(evil)).toEqual(a);
    expect(a.name).toBe("<script>alert(1)</script>"); // raw text is data; escaping is the renderer's job
  });
  // BUG: EMAIL_RE (/[\w.+-]+@.../ in lib/text/regex.ts) backtracks quadratically on a long run of word chars with
  // no "@": 50k chars ≈ 1.2s, 100k ≈ 4.7s of blocked event loop per parse. A crafted PDF text layer can stall the server.
  it.fails("parses a 100k-char unbroken token in well under a second (no quadratic email regex)", () => {
    const t0 = Date.now();
    heuristicParseCv("Sam\n" + "a".repeat(100_000));
    expect(Date.now() - t0).toBeLessThan(500);
  });
  it("archetypes: at most 3, all score > 0, sorted descending", () => {
    for (const t of [MESSY, "software engineer data quant trading consulting product marketing research banking", "nothing relevant"]) {
      const a = heuristicParseCv(t).archetypes;
      expect(a.length).toBeLessThanOrEqual(3);
      expect(a.every((x) => x.score > 0 && x.score <= 100)).toBe(true);
      expect([...a].sort((x, y) => y.score - x.score)).toEqual(a);
    }
  });
});

describe("assignIds — stable, deterministic, unique", () => {
  const cv = heuristicParseCv(MESSY);
  it("is deterministic across calls and idempotent", () => {
    const a = assignIds(cv);
    expect(assignIds(cv)).toEqual(a);
    expect(assignIds(a)).toEqual(a);
  });
  it("produces globally unique ids across all sections", () => {
    const ids = allIds(assignIds(cv));
    expect(ids.every((id) => id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("uses the documented prefix scheme", () => {
    const a = assignIds(cv);
    expect(a.education[0].id).toBe("e0");
    expect(a.education[0].details[1].id).toBe("e0-d1");
    expect(a.experience[1].id).toBe("x1");
    expect(a.experience[0].bullets[5].id).toBe("x0-b5");
    expect(a.leadership[0].bullets[0].id).toBe("l0-b0");
  });
  it("stays unique with ≥10 entries/bullets (no 'x1'+'1' vs 'x11' collisions)", () => {
    const lines = ["N", "EXPERIENCE"];
    for (let i = 0; i < 12; i++) { lines.push(`Org${i} — Role, 2020–2021`); for (let j = 0; j < 12; j++) lines.push(`• b${i}-${j}`); }
    lines.push("PROJECTS"); for (let i = 0; i < 12; i++) lines.push(`• p${i}`);
    const ids = allIds(assignIds(heuristicParseCv(lines.join("\n"))));
    expect(ids.length).toBe(12 + 144 + 1 + 12);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("overwrites any model-supplied (possibly duplicate) ids and does not mutate input", () => {
    const dup = { ...cv, experience: cv.experience.map((e) => ({ ...e, id: "same", bullets: e.bullets.map((b) => ({ ...b, id: "same" })) })) };
    const snap = JSON.stringify(dup);
    const out = assignIds(dup);
    expect(JSON.stringify(dup)).toBe(snap);
    expect(new Set(allIds(out)).size).toBe(allIds(out).length);
  });
  it("ids depend only on position: identical structure → identical ids, independent of text", () => {
    const a = assignIds(heuristicParseCv("N\nEXPERIENCE\nA — B, 2020–2021\n• x"));
    const b = assignIds(heuristicParseCv("M\nEXPERIENCE\nC — D, 2022–2023\n• y"));
    expect(allIds(a)).toEqual(allIds(b));
  });
});

describe("isImageOnly boundaries", () => {
  it("threshold is 200 non-whitespace chars per page on average", () => {
    expect(isImageOnly(["a".repeat(199)])).toBe(true);
    expect(isImageOnly(["a".repeat(200)])).toBe(false);
    expect(isImageOnly([" a ".repeat(199)])).toBe(true); // whitespace doesn't count
    expect(isImageOnly([])).toBe(true);
    expect(isImageOnly([""])).toBe(true);
    // two pages: one rich, one scanned → average 150 → image-only
    expect(isImageOnly(["a".repeat(300), ""])).toBe(true);
    expect(isImageOnly(["a".repeat(400), ""])).toBe(false);
  });
});
