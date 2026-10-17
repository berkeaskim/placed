import { describe, expect, it } from "vitest";
import { findPersons, maskPersons } from "@/lib/cover-letter/person";

const AVOID = ["Northbridge Capital", "Summer Analyst – Markets"];

describe("findPersons", () => {
  it("finds a single first name before from / at / who, and a surname after a title", () => {
    expect(findPersons("At the Insight Day, Priya from the rates desk told me about it.", AVOID)).toEqual(["Priya"]);
    expect(findPersons("James at Northbridge said rotations are real.", AVOID)).toEqual(["James"]);
    expect(findPersons("Dr. Patel told me", AVOID)).toEqual(["Dr. Patel"]);
    expect(findPersons("I emailed Prof Okafor after the talk.", AVOID)).toEqual(["Prof Okafor"]);
    expect(findPersons("I met Tom, who runs the desk, at the fair.", AVOID)).toEqual(["Tom"]);
  });

  it("keeps finding full names, once each, without splitting them again", () => {
    expect(findPersons("I spoke to Sarah Khan at the fair.", AVOID)).toEqual(["Sarah Khan"]);
    expect(findPersons("I met Sarah Khan and James Patel at the fair.", AVOID)).toEqual(["Sarah Khan", "James Patel"]);
  });

  it("does not take I, the company, months, places or stock words for a name", () => {
    for (const t of [
      "I am at Northbridge Capital in May.",
      "In May at the fair I met the team.",
      "Northbridge at its best is fast.",
      "At the Spring Insight Day Northbridge Capital showed us the Markets floor.",
      "London in the summer was busy.",
      "Everyone at the event was kind, and Markets in London is my aim.",
      "Working at a café taught me patience.",
    ]) expect(findPersons(t, AVOID), t).toEqual([]);
  });
});

describe("maskPersons", () => {
  it("masks a titled name without touching other titles", () => {
    expect(maskPersons("Dr. Patel told me, and Dr. Lee agreed.", ["Dr. Patel"], "Northbridge Capital", ["Dr. Lee"]))
      .toBe("a Northbridge Capital associate told me, and Dr. Lee agreed.");
  });
});
