import { describe, expect, it } from "vitest";
import { firstName, noteOf, toCards } from "@/lib/inside-track/view";

const found = { searched: true, groups: {
  alumni: [{ name: "Sam Lee", headline: "Analyst", url: "https://www.linkedin.com/in/sam-lee" }],
  team: [{ name: "Sam Park", headline: "Data", url: "https://www.linkedin.com/in/sam-park" }],
  recruiter: [],
} };

describe("toCards", () => {
  it("matches stored drafts on group + full name, not first name", () => {
    const cards = toCards(found, [{ id: "r1", target: "team", recipient_name: "Sam Park", body: "Hi Sam, note.\n\nLonger chat.", status: "sent" }]);
    expect(cards.map((c) => [c.name, c.draft, c.outreachId, c.status])).toEqual([
      ["Sam Lee", null, null, null],
      ["Sam Park", "Hi Sam, note.", "r1", "sent"],
    ]);
  });
  it("uses the newest row (rows arrive newest first) and keeps group order", () => {
    const cards = toCards(found, [
      { id: "new", target: "alumni", recipient_name: "Sam Lee", body: "new", status: "drafted" },
      { id: "old", target: "alumni", recipient_name: "Sam Lee", body: "old", status: "sent" },
    ]);
    expect(cards[0].outreachId).toBe("new");
    expect(cards.map((c) => c.group)).toEqual(["alumni", "team"]);
  });
});

describe("helpers", () => {
  it("firstName and noteOf", () => {
    expect(firstName("Seán O'Brien")).toBe("Seán");
    expect(noteOf("note\n\nchat")).toBe("note");
    expect(noteOf("only note")).toBe("only note");
  });
});
