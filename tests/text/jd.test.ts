import { describe, it, expect } from "vitest";
import { htmlToLines, tagSections } from "@/lib/text/jd";

describe("htmlToLines", () => {
  it("decodes double-escaped Greenhouse HTML and keeps structure", () => {
    const html = "&lt;h3&gt;Requirements&lt;/h3&gt;&lt;ul&gt;&lt;li&gt;Python &amp;amp; SQL&lt;/li&gt;&lt;li&gt;Excel&lt;/li&gt;&lt;/ul&gt;";
    expect(htmlToLines(html)).toEqual(["## Requirements", "- Python & SQL", "- Excel"]);
  });
  it("splits paragraphs and <br> into lines and drops empties", () => {
    expect(htmlToLines("<p>Hello<br/>world</p><p></p><div>Bye</div>")).toEqual(["Hello", "world", "Bye"]);
  });
  it("does not truncate long descriptions", () => {
    const long = "<p>" + "a".repeat(9000) + "</p>";
    expect(htmlToLines(long)[0].length).toBe(9000);
  });
  it("guards against malformed numeric entities like &#99999999;", () => {
    const html = "<p>Test &#99999999; entity</p>";
    expect(htmlToLines(html)).toEqual(["Test &#99999999; entity"]);
  });
});

describe("tagSections", () => {
  it("tags bullets under requirement headers as must and preferred headers as nice", () => {
    const lines = ["## About the role", "- You will analyse data", "## Requirements", "- Python", "## Preferred qualifications", "- Tableau", "## Benefits", "- Free lunch"];
    const tagged = tagSections(lines);
    expect(tagged.find((l) => l.text === "- You will analyse data")!.section).toBe("other");
    expect(tagged.find((l) => l.text === "- Python")!.section).toBe("must");
    expect(tagged.find((l) => l.text === "- Tableau")!.section).toBe("nice");
    expect(tagged.find((l) => l.text === "- Free lunch")!.section).toBe("other");
  });
  it("detects plain-text headers ending with a colon", () => {
    const tagged = tagSections(["What we're looking for:", "- SQL", "Nice to have:", "- dbt"]);
    expect(tagged[1].section).toBe("must");
    expect(tagged[3].section).toBe("nice");
  });
  it("applies bullet-level overrides", () => {
    const tagged = tagSections(["## Requirements", "- Experience with R is a plus", "## Bonus", "- You must have the right to work in the UK"]);
    expect(tagged[1].section).toBe("nice");
    expect(tagged[3].section).toBe("must");
  });
  it("returns all 'other' when there are no headers (prose-only JD)", () => {
    const tagged = tagSections(["We are a fast-growing startup looking for an intern to help with everything."]);
    expect(tagged.every((l) => l.section === "other")).toBe(true);
  });
  it("does not treat 'Strong communication essential' as a header when not anchored", () => {
    const lines = ["We seek a great candidate.", "Strong communication essential"];
    const tagged = tagSections(lines);
    expect(tagged[1].isHeader).toBe(false);
    expect(tagged[1].section).toBe("other");
  });
  it("does not treat 'Minimum 2:1 degree preferred in any subject' as a header in 'other' section", () => {
    const lines = ["General info", "Minimum 2:1 degree preferred in any subject"];
    const tagged = tagSections(lines);
    expect(tagged[1].isHeader).toBe(false);
    expect(tagged[1].section).toBe("other");
  });
  it("keeps 'Python and SQL' as a regular line under '## Requirements', staying in 'must' section", () => {
    const lines = ["## Requirements", "Python and SQL"];
    const tagged = tagSections(lines);
    expect(tagged[1].isHeader).toBe(false);
    expect(tagged[1].section).toBe("must");
  });
  it("recognizes 'What we're looking for:' (no ##) as a must header", () => {
    const lines = ["What we're looking for:", "- Strong technical skills"];
    const tagged = tagSections(lines);
    expect(tagged[0].isHeader).toBe(true);
    expect(tagged[0].section).toBe("must");
    expect(tagged[1].section).toBe("must");
  });
});
