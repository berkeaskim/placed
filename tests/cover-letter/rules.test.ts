import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RULES, countChars, countWords, lintLetter, lintParagraph, lintParagraphScoped } from "@/lib/cover-letter/rules";

// Examples A-E from docs/research/cover-letter/02-structure-craft.md section 3.
const WEAK: string[] = [
  "I am writing to apply for the Summer Internship at your company, which I saw advertised on your website. I am a hard-working and motivated second-year student who is passionate about finance, and I believe I would be a great fit for this role.",
  "I have strong analytical and teamwork skills, which I have developed through my degree and extracurricular activities. I am also an excellent communicator and work well under pressure. My CV shows that I have been involved in many societies and have held various positions of responsibility.",
  "Northbridge Capital is a world-leading investment bank with a strong reputation and excellent culture. I am impressed by your commitment to innovation and diversity, and I would love the opportunity to work for such a prestigious firm.",
  "Although I don't have any professional experience yet, I am very eager to learn and I think this spring week would be a great opportunity for me to develop my skills.",
  "Thank you for taking the time to read my application. I hope to hear from you soon. Please do not hesitate to contact me if you require any further information."
];
const STRONG: string[] = [
  "I am applying for Northbridge Capital's 2027 Summer Analyst Programme in Markets (ref. SA-MKT-27). Running the trading desk of UCL's student investment fund this year taught me that the hardest part of a trade is not the idea but sizing it, and Northbridge's emphasis on risk ownership from week one is the reason I want to learn that discipline with you.",
  "The role asks for rigorous analysis under time pressure. In the Warwick Trading Challenge, my team of four had 48 hours to build a macro thesis. I built the rates scenario model in Excel, stress-tested it against the 2022 gilt sell-off, and presented the downside case that changed our position size; we placed 3rd of 62 teams. The same pressure applies in my part-time role at a café on Saturdays, where I train new staff during the busiest shift. Explaining a process clearly to someone overwhelmed is a skill I would bring to an analyst desk that supports traders in real time.",
  "At your Spring Insight Day in March, a Markets associate explained how Northbridge rotates summer analysts across both flow and structured desks before placement. Having only seen the flow side through our society fund, I want that comparison before I specialise. Your recent expansion of the sterling rates desk is also directly relevant to the gilt-market work I have been doing in my dissertation proposal.",
  "My first term studying Mathematics with Economics has been where I learned how I work best: I set up a weekly problem-solving group for our Probability module that grew from three to fourteen students, and I now write the solution sheets. I would bring that habit of breaking complex problems into steps others can follow to the case exercises on your Spring Week.",
  "I would bring a trading-desk habit of sizing risk before acting, and the communication skills to explain it quickly. I would welcome the chance to discuss how I could contribute to the Markets team this summer, and I am available for interview at any point after 2 December. Thank you for your consideration."
];

type LetterOpts = Parameters<typeof lintLetter>[1];
const base: LetterOpts = { mode: "full_letter", limit: null, company: "Northbridge Capital", role: "Summer Analyst", otherEmployers: [], ownSpans: [] };
const ids = (hits: { ruleId: string }[]) => hits.map((h) => h.ruleId);
const words = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

describe("rules.json", () => {
  it("is identical to the research copy", () => {
    expect(readFileSync("lib/cover-letter/rules.json", "utf8")).toBe(readFileSync("docs/research/cover-letter/cover-letter-rules.json", "utf8"));
    expect(RULES.lexicon.flags).toBe("im");
  });
});

describe("lintParagraph", () => {
  it.each(WEAK)("weak paragraph %# gets at least one hit", (p) => expect(lintParagraph(p).length).toBeGreaterThan(0));
  it.each(STRONG)("strong paragraph %# has no lexicon hits", (p) =>
    expect(lintParagraph(p).filter((h) => h.ruleId === "CL-50" || h.ruleId === "CL-51")).toEqual([]));

  it("maps special hard labels to their own rules", () => {
    expect(ids(lintParagraph("Dear Sir/Madam"))).toContain("CL-42");
    expect(ids(lintParagraph("It is a stepping-stone for me."))).toContain("CL-70");
    expect(ids(lintParagraph("The salary matters."))).toContain("CL-71");
    expect(ids(lintParagraph("Although I don't have experience."))).toContain("CL-35");
    expect(ids(lintParagraph("I work at [Company]."))).toContain("CL-21");
    expect(ids(lintParagraph("Delving into it."))).toContain("CL-50");
  });

  it("reports soft hits as CL-51 med with offsets", () => {
    const t = "I will leverage this.";
    const [h] = lintParagraph(t);
    expect(h).toMatchObject({ ruleId: "CL-51", severity: "med", scope: "ai" });
    expect(t.slice(h.start, h.end)).toBe("leverage");
  });

  it("flags repeated em dashes, not-only-but and triplets", () => {
    expect(lintParagraph("One \u2014 two.").some((h) => h.label.includes("Em dash"))).toBe(false);
    expect(lintParagraph("One \u2014 two \u2014 three.").some((h) => h.label.includes("Em dash"))).toBe(true);
    expect(lintParagraph("It was not only fast but also cheap. It was not just red but blue.").some((h) => h.label.includes("Not only"))).toBe(true);
    expect(lintParagraph("I like a, b, and c. I like d, e, and f.").some((h) => h.label.includes("triplet"))).toBe(true);
  });
});

describe("lexicon scope", () => {
  it("applies opening patterns only to the first body paragraph", () => {
    const opener = "I am thrilled to apply for the role.";
    const hits = lintLetter(`Dear Hiring Manager,\n\nBody one about Northbridge Capital Summer Analyst.\n\n${opener}\n\nYours faithfully\nA`, base);
    expect(hits.filter((h) => h.label === "Cliché opener").some((h) => h.start > 60)).toBe(false);
    const first = lintLetter(`Dear Hiring Manager,\n\n${opener}\n\nMore.\n\nYours faithfully\nA`, base);
    expect(first.some((h) => h.label === "Cliché opener")).toBe(true);
  });
  it("applies close patterns only to the last body paragraph", () => {
    const close = "I look forward to discussing how my skills fit.";
    const a = lintLetter(`Dear Hiring Manager,\n\n${close}\n\nMore.\n\nYours faithfully\nA`, base);
    expect(a.some((h) => h.label === "Formulaic close")).toBe(false);
    const b = lintLetter(`Dear Hiring Manager,\n\nMore.\n\n${close}\n\nYours faithfully\nA`, base);
    expect(b.some((h) => h.label === "Formulaic close")).toBe(true);
  });
});

describe("counting", () => {
  it("counts characters with newlines", () => expect(countChars("ab\ncd ")).toBe(6));
  it("counts words", () => expect(countWords("  one two\nthree  ")).toBe(3));
});

describe("lintLetter", () => {
  it("flags another employer and missing company", () => {
    const hits = lintLetter("Dear Hiring Manager,\n\nI am applying to Goldman Sachs.", { ...base, company: "Morgan Stanley", role: "Analyst", otherEmployers: ["Goldman Sachs"] });
    expect(ids(hits)).toEqual(expect.arrayContaining(["CL-20", "CL-21"]));
  });

  it("accepts company and role named in the first paragraph", () => {
    const hits = lintLetter("Dear Hiring Manager,\n\nI am applying for the Summer Analyst role at Northbridge Capital.\n\nYours faithfully\nA B", base);
    expect(ids(hits)).not.toContain("CL-20");
  });

  it("field_answer must not have Dear/Yours", () => {
    const hits = lintLetter("Dear team, I want this. Yours sincerely", { ...base, mode: "field_answer", limit: { unit: "words", max: 150 }, company: "X", role: "Y" });
    expect(hits.some((h) => h.ruleId === "CL-04")).toBe(true);
  });

  it("marks hits inside own spans as theirs", () => {
    const t = "I am a team player at Acme.";
    expect(lintParagraphScoped(t, [{ start: 0, end: t.length, kind: "theirs", refs: [] }])[0].scope).toBe("theirs");
    expect(lintParagraphScoped(t, [])[0].scope).toBe("ai");
  });

  it("offsets are relative to the whole letter and own spans apply", () => {
    const letter = "Dear Hiring Manager,\n\nNorthbridge Capital Summer Analyst. I am a team player.\n\nYours faithfully\nA";
    const start = letter.indexOf("team player");
    const hits = lintLetter(letter, { ...base, ownSpans: [{ start: 0, end: letter.length, kind: "theirs", refs: [] }] });
    const h = hits.find((x) => x.label === "Clich\u00e9")!;
    expect(h.start).toBe(start);
    expect(h.scope).toBe("theirs");
  });

  it("flags length over the limit as CL-02 block (chars)", () => {
    const hits = lintLetter("a".repeat(120), { ...base, mode: "field_answer", limit: { unit: "chars", max: 100 }, company: "", role: "" });
    expect(hits.find((h) => h.ruleId === "CL-02")).toMatchObject({ severity: "block", scope: "letter" });
  });

  it("flags field_answer under 85% of the limit as CL-03 high, and accepts 90%", () => {
    const o = { ...base, mode: "field_answer" as const, limit: { unit: "words" as const, max: 100 }, company: "", role: "" };
    expect(lintLetter(words(50), o).find((h) => h.ruleId === "CL-03")).toMatchObject({ severity: "high" });
    expect(lintLetter(words(90), o).some((h) => h.ruleId === "CL-03" || h.ruleId === "CL-02")).toBe(false);
  });

  it("applies word bands per mode", () => {
    const wrap = (n: number) => `Dear Hiring Manager,\n\n${words(n)}\n\nYours faithfully\nA`;
    const o = { ...base, company: "", role: "" };
    expect(ids(lintLetter(wrap(100), o))).toContain("CL-03");
    expect(ids(lintLetter(wrap(460), o))).toContain("CL-02");
    expect(ids(lintLetter(wrap(300), o))).not.toContain("CL-02");
    expect(ids(lintLetter("Hi team\n\n" + words(20) + "\n\nBest\nA", { ...o, mode: "short_note" }))).toContain("CL-03");
  });

  it("checks salutation and sign-off pairing for letter modes", () => {
    const o = { ...base, company: "", role: "" };
    expect(ids(lintLetter(`${words(10)}\n\nYours sincerely\nA`, o))).toContain("CL-42");
    expect(ids(lintLetter(`Dear Hiring Manager,\n\n${words(10)}`, o))).toContain("CL-43");
    expect(ids(lintLetter(`Dear Ms Patel,\n\n${words(10)}\n\nYours faithfully\nA`, o))).toContain("CL-43");
    expect(ids(lintLetter(`Dear Ms Patel,\n\n${words(10)}\n\nYours sincerely\nA`, o))).not.toContain("CL-43");
    expect(ids(lintLetter(`Dear Ms. Patel,\n\n${words(10)}\n\nYours sincerely\nA`, o))).toContain("CL-42");
  });

  it("soft density: more than 3 distinct soft hits per 300 words", () => {
    const soft = "We leverage robust, holistic, meticulous and pivotal methods.";
    const hits = lintLetter(`Dear Hiring Manager,\n\n${soft}\n\nYours faithfully\nA`, { ...base, company: "", role: "" });
    expect(hits.some((h) => h.ruleId === "CL-51" && h.scope === "letter")).toBe(true);
  });

  it("rhythm: uniform long sentences and I-starts raise low-severity hits", () => {
    const sentence = "I have worked on a project with a great deal of detail and many other people around me throughout the whole of the year.";
    const para = [sentence, sentence, sentence].join(" ");
    const hits = lintLetter(`Dear Hiring Manager,\n\n${para}\n\n${para}\n\nYours faithfully\nA`, { ...base, company: "", role: "" });
    expect(ids(hits)).toEqual(expect.arrayContaining(["CL-53", "CL-55"]));
    expect(hits.some((h) => h.ruleId === "CL-55" && h.label.includes("Consecutive"))).toBe(true);
    expect(hits.filter((h) => ["CL-53", "CL-54", "CL-55"].includes(h.ruleId)).every((h) => h.severity === "low")).toBe(true);
  });

  it("skip mode produces no hits at all", () => {
    expect(lintLetter("", { ...base, mode: "skip", company: "", role: "" })).toEqual([]);
    expect(lintLetter("Dear Sir/Madam, I am a team player at Goldman Sachs!", { ...base, mode: "skip", otherEmployers: ["Goldman Sachs"] })).toEqual([]);
  });

  it("keeps CL-20 at scope letter even when ownSpans cover paragraph 1", () => {
    const letter = "Dear Hiring Manager,\n\nI love finance.\n\nYours faithfully\nA";
    const hits = lintLetter(letter, { ...base, ownSpans: [{ start: 0, end: letter.length, kind: "theirs", refs: [] }] });
    const cl20 = hits.filter((h) => h.ruleId === "CL-20");
    expect(cl20.length).toBeGreaterThan(0);
    expect(cl20.every((h) => h.scope === "letter")).toBe(true);
  });
});
