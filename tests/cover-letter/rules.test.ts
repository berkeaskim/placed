import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { RULES, countChars, countWords, letterWords, lintLetter, lintParagraph, lintParagraphScoped } from "@/lib/cover-letter/rules";

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
    expect(ids(lintParagraph("The salary is what attracts me."))).toContain("CL-71");
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
    expect(lintParagraph("One \u2014 two.").some((h) => h.label.includes("Dash"))).toBe(false);
    expect(lintParagraph("One \u2014 two \u2014 three.").some((h) => h.label.includes("Dash"))).toBe(true);
    // 09 #25: the spaced en dash counts too, and three dashes are high, not block
    expect(lintParagraph("One \u2013 two \u2013 three \u2013 four.").find((h) => h.label.includes("Dash"))?.severity).toBe("high");
    expect(lintParagraph("It was not only fast but also cheap. It was not just red but blue.").some((h) => h.label.includes("Not only"))).toBe(true);
    expect(lintParagraph("I enjoy leading teams, building models and presenting to clients. I like reading books, running races and cooking dinner.").some((h) => h.label.includes("triplet"))).toBe(true);
    // 09 #24: a list of tools is just a list
    expect(lintParagraph("I use Python, SQL and Excel. I know Stata, R and Tableau.").some((h) => h.label.includes("triplet"))).toBe(false);
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
  it("counts a letter's words as the length band does: the body, without salutation, sign-off or name", () => {
    const letter = "Dear Hiring Manager,\n\nOne two three.\n\nFour five.\n\nYours faithfully,\nAlex Morgan";
    expect(letterWords(letter, "full_letter")).toBe(5);
    expect(letterWords(letter, "short_letter")).toBe(5);
    expect(letterWords("One two three.", "field_answer")).toBe(3);
    expect(letterWords("Hello,\n\nOne two.\n\nBest,\nAlex", "short_note")).toBe(countWords("Hello,\n\nOne two.\n\nBest,\nAlex"));
    const band = lintLetter(letter, { mode: "full_letter", limit: null, company: "", role: "", otherEmployers: [], ownSpans: [] }).find((h) => h.ruleId === "CL-03");
    expect(band?.label).toMatch(/\(5\)$/);
  });
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

  // 09 #21: no source for 85%; short is fine, so under 60% is a low nudge and never auto-repaired
  it("nudges a field_answer under 60% of the limit as CL-03 low, and accepts 65%", () => {
    const o = { ...base, mode: "field_answer" as const, limit: { unit: "words" as const, max: 100 }, company: "", role: "" };
    expect(lintLetter(words(50), o).find((h) => h.ruleId === "CL-03")).toMatchObject({ severity: "low" });
    expect(lintLetter(words(65), o).some((h) => h.ruleId === "CL-03" || h.ruleId === "CL-02")).toBe(false);
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

// audit 09 #2: CL-21 names must be written as names
describe("CL-21 capital initial", () => {
  it("fires on 'Barclays' but not on the word 'next' or 'wise'", async () => {
    const { lintLetter } = await import("@/lib/cover-letter/rules");
    const opts = { mode: "field_answer" as const, limit: null, company: "Citi", role: "Analyst", otherEmployers: ["Barclays", "Next", "Wise"], ownSpans: [] };
    const hits = (t: string) => lintLetter(t, opts).filter((h) => h.ruleId === "CL-21").map((h) => h.label);
    expect(hits("At Citi I want to learn from Barclays alumni.")).toEqual(["Another employer named: Barclays"]);
    expect(hits("At Citi I want to learn what comes next and choose wise trades.")).toEqual([]);
  });
});

// audit 09 #5/#18: false positives on ordinary student prose
describe("lexicon false positives", () => {
  const blocks = (t: string) => lintParagraph(t).filter((h) => h.severity === "block" || h.severity === "high").map((h) => h.label);
  it.each(["Overall, the project cut processing time by 40%.", "Ultimately, the client chose the second option.", "It's not easy, but it's worth it.",
    "I worked at Yahoo! as an intern.", "I benchmarked executive compensation for FTSE 250 clients.", "I built a bonus-pool allocation model.",
    "I tested three pricing models before deciding on a binomial tree.", "I wrote a Python program to clean the data."])("no block or high: %s", (t) => expect(blocks(t)).toEqual([]));
  it("still blocks 'In conclusion,' and a real negative parallelism", () => {
    expect(blocks("In conclusion, I am a fit.")).toContain("Formulaic transition");
    expect(blocks("It's not about the money, it's about the impact.")).toContain("Negative parallelism");
  });
  it("Dear Sir/Madam is low; To whom it may concern is med", () => {
    expect(lintParagraph("Dear Sir/Madam").find((h) => h.ruleId === "CL-42")?.severity).toBe("low");
    expect(lintParagraph("To whom it may concern").find((h) => h.ruleId === "CL-42")?.severity).toBe("med");
  });
  it("'program' is not flagged as a US spelling", () => expect(lintParagraph("I wrote a program.").some((h) => h.ruleId === "CL-51")).toBe(false));
});

// audit 09 #19: a full-name greeting is a named recipient
describe("named salutation", () => {
  it("'Dear Priya Patel' with 'Yours faithfully' asks for 'Yours sincerely'; 'Dear Hiring Manager' does not", () => {
    const o = { ...base, company: "", role: "" };
    const named = lintLetter("Dear Priya Patel,\n\nBody text here.\n\nYours faithfully,\nA", o).map((h) => h.label);
    expect(named).toContain("Named recipient needs 'Yours sincerely'");
    const team = lintLetter("Dear Hiring Manager,\n\nBody text here.\n\nYours faithfully,\nA", o).map((h) => h.label);
    expect(team).not.toContain("Named recipient needs 'Yours sincerely'");
  });
});

// audit 09 #7: CL-20 matches a company's aliases and the role's head noun phrase, so the opening never needs string-stuffing
describe("CL-20 company aliases and role head", () => {
  const letter = (opening: string) => `Dear Hiring Manager,\n\n${opening}\n\nMore.\n\nYours faithfully\nA B`;
  const cl20 = (opening: string, company: string, role: string, mode: "full_letter" | "field_answer" = "full_letter") =>
    lintLetter(mode === "full_letter" ? letter(opening) : opening, { ...base, mode, limit: mode === "field_answer" ? { unit: "words", max: 150 } : null, company, role })
      .filter((h) => h.ruleId === "CL-20");

  it.each([
    ["JPMorgan Chase & Co.", "I am applying for the Summer Analyst role at J.P. Morgan."],
    ["JPMorgan Chase & Co.", "I am applying for the Summer Analyst role at JPMorgan."],
    ["JPMorgan Chase & Co.", "I am applying for the Summer Analyst role at JPMorganChase."],
    ["J.P. Morgan", "I am applying for the Summer Analyst role at JPMorgan Chase."],
    ["Goldman Sachs Group, Inc.", "I am applying for the Summer Analyst role at Goldman."],
    ["PricewaterhouseCoopers LLP", "I am applying for the Summer Analyst role at PwC."],
    ["PwC UK", "I am applying for the Summer Analyst role at PricewaterhouseCoopers."],
    ["Ernst & Young LLP", "I am applying for the Summer Analyst role at EY."],
    ["The Boston Consulting Group", "I am applying for the Summer Analyst role at BCG."],
    ["Bank of America", "I am applying for the Summer Analyst role at BofA."],
  ])("company %s is named by an alias", (company, opening) => {
    expect(cl20(opening, company, "Summer Analyst").map((h) => h.label)).toEqual([]);
  });

  it("still blocks when the opening names no form of the company", () => {
    expect(cl20("I am applying for the Summer Analyst role at your firm.", "JPMorgan Chase & Co.", "Summer Analyst").map((h) => h.label)).toEqual(["Company not named in the opening"]);
    expect(cl20("I am applying for the Summer Analyst role because they offer rotations.", "EY", "Summer Analyst").map((h) => h.label)).toEqual(["Company not named in the opening"]);
  });

  it("a long scraped title needs only its head noun phrase in a full letter", () => {
    const role = "2027 Summer Analyst Programme – Global Banking & Markets – London";
    expect(cl20("I am applying for the Summer Analyst programme in Global Banking at Barclays.", "Barclays", role)).toEqual([]);
    expect(cl20("I am applying for a Summer Analyst internship at Barclays.", "Barclays", role)).toEqual([]);
    expect(cl20("I am applying for a summer internship at Barclays.", "Barclays", role).map((h) => h.label)).toEqual(["Role not named in the opening"]);
    expect(cl20("I am applying to the Software Engineering Intern role at Monzo.", "Monzo", "Software Engineer Intern (Summer 2027), London")).toEqual([]);
  });

  it("a form answer needs only the company, as a medium note, and never the role", () => {
    expect(cl20("Barclays' graduate training appeals to me.", "Barclays", "2027 Summer Analyst Programme – Global Banking & Markets – London", "field_answer")).toEqual([]);
    const miss = cl20("The graduate training appeals to me.", "Barclays", "Summer Analyst", "field_answer");
    expect(miss.map((h) => [h.label, h.severity])).toEqual([["Company not named in the opening", "med"]]);
  });
});
