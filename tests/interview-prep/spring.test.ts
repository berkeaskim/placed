import { describe, expect, it, vi } from "vitest";
import { LOCAL_USER_ID } from "@/lib/auth/local-user";
import { insertEntry } from "@/lib/bank/store";
import type { Bank, BankEntry } from "@/lib/bank/types";
import { DEFAULT_PRESET, practiceSet, SPRING_QUESTIONS, springContext, springQuestions } from "@/lib/interview-prep/spring-bank";
import { suggestStories } from "@/lib/interview-prep/spring-stories";
import { withTempDb } from "../cv/temp-db";

vi.mock("server-only", () => ({}));
const { springPrep } = await import("@/lib/interview-prep/spring");

withTempDb();

let n = 0;
const entry = (over: Partial<Omit<BankEntry, "bullets">> & { bullets?: string[] }): BankEntry => ({
  id: `e${++n}`, section: "experience", org: "", title: "", dates: "", startYm: null, endYm: null, location: "",
  pinned: false, hidden: false, sourceIds: [], updatedAt: "",
  ...over,
  bullets: (over.bullets ?? []).map((text, i) => ({
    id: `b${n}-${i}`, entryId: `e${n}`, text, position: i, pinned: false, hidden: false, sourceIds: [], sourceText: text, updatedAt: "",
  })),
});

describe("spring question bank", () => {
  it("has the 30 questions from the research, numbered 1 to 30", () => {
    expect(SPRING_QUESTIONS.map((q) => q.id)).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    expect(SPRING_QUESTIONS.filter((q) => q.group === "technical").map((q) => q.id)).toEqual([27, 28, 29]);
  });

  it("fills firm, rival and division, and leaves no placeholder behind", () => {
    const c = springContext("Goldman Sachs", "Spring Week 2027 - Global Markets");
    expect(c).toMatchObject({ firm: "Goldman Sachs", rival: "Morgan Stanley", division: "Markets", adjacent: "Investment Banking", knownFirm: true });
    const qs = springQuestions(c);
    expect(qs[0].text).toBe("Why Goldman Sachs? And why not Morgan Stanley?");
    expect(qs.every((q) => !/[{}]/.test(q.text + q.whyTheyAsk + q.prepTip))).toBe(true);
  });

  it("uses neutral wording and the default timings for an unknown firm and division", () => {
    const c = springContext("Acme Capital", "Spring Insight Programme");
    expect(c).toMatchObject({ rival: "its closest competitor", division: "your chosen division", adjacent: "another division", knownFirm: false });
    expect(c.preset).toEqual(DEFAULT_PRESET);
    expect(c.preset).toMatchObject({ prepSeconds: 30, answerSeconds: 120 });
  });

  it("carries the reported firm timings (BofA ~90 s answers, J.P. Morgan ~3 questions)", () => {
    expect(springContext("Bank of America", "Spring Insight").preset).toMatchObject({ answerSeconds: 90, prepSeconds: 30 });
    expect(springContext("JPMorgan Chase & Co.", "Spring Week").preset.questions).toBe(3);
  });
});

describe("practiceSet", () => {
  it("puts the firm's reported questions first and sizes the run to the preset", () => {
    const c = springContext("Citi", "Spring Week - Banking");
    const set = practiceSet(c);
    expect(set).toHaveLength(4);
    expect(set.map((q) => q.id)).toEqual([1, 11, 12, 22]);
  });

  it("never includes technicals unless asked, and then exactly one", () => {
    const c = springContext("Acme", "Spring Week");
    for (let seed = 0; seed < 12; seed++) expect(practiceSet(c, { seed }).some((q) => q.group === "technical")).toBe(false);
    const withTech = practiceSet(c, { technicals: true });
    expect(withTech).toHaveLength(5);
    expect(withTech.filter((q) => q.group === "technical")).toHaveLength(1);
  });

  it("gives a different interview on the next seed, with no duplicates, even when reported questions fill the run", () => {
    for (const firm of ["Acme", "Citi"]) {
      const c = springContext(firm, "Spring Week");
      const a = practiceSet(c, { seed: 0 }).map((q) => q.id);
      const b = practiceSet(c, { seed: 1 }).map((q) => q.id);
      expect(b.some((id) => !a.includes(id))).toBe(true);
      expect(new Set(b).size).toBe(b.length);
    }
  });
});

describe("suggestStories", () => {
  const c = springContext("Goldman Sachs", "Spring Week");
  const qs = springQuestions(c);

  it("matches competency questions to the student's own bullets, verbatim", () => {
    const bank: Bank = { entries: [
      entry({ section: "leadership", title: "President", org: "Investment Society", bullets: ["Led a committee of 8 to run 12 events for 300 members"] }),
      entry({ title: "Sales Assistant", org: "Tesco", bullets: ["Worked weekend shifts alongside full-time A-levels", "Resolved customer complaints calmly at the tills"] }),
      entry({ section: "projects", title: "Stock pitch", bullets: ["Built an Excel model and analysed 5 years of data to pitch a stock"] }),
    ] };
    const s = suggestStories(bank, qs);
    const by = Object.fromEntries(s.map((x) => [x.theme, x]));
    expect(by.lead).toMatchObject({ label: "President · Investment Society", bullet: "Led a committee of 8 to run 12 events for 300 members", hasResult: true });
    expect(by.data.label).toBe("Stock pitch");
    expect(by.conflict.bullet).toBe("Resolved customer complaints calmly at the tills");
    expect(by.conflict.hasResult).toBe(false);
    expect(s.every((x) => qs.some((q) => q.id === x.questionId && q.text === x.question))).toBe(true);
  });

  it("spreads stories across entries rather than reusing one for everything", () => {
    const bank: Bank = { entries: [
      entry({ section: "leadership", title: "Captain", org: "Football", bullets: ["Led the team, organised training, won the league, managed a challenge under pressure"] }),
      entry({ title: "Tutor", bullets: ["Taught maths to a team of 4 students under exam pressure"] }),
    ] };
    const s = suggestStories(bank, qs);
    expect(new Set(s.map((x) => x.entryId)).size).toBe(2);
  });

  it("lets one bullet answer at most two questions, and prefers another bullet of the same entry", () => {
    const bank: Bank = { entries: [
      entry({ section: "projects", title: "Stock pitch", bullets: ["Led a team, analysed data, won first place, learned Excel under deadline pressure, resolved a disagreement"] }),
      entry({ section: "leadership", title: "Events Officer", bullets: ["Organised 10 events", "Persuaded two banks to co-sponsor a careers panel"] }),
    ] };
    const s = suggestStories(bank, qs);
    const uses = s.filter((x) => x.label === "Stock pitch").length;
    expect(uses).toBeLessThanOrEqual(2);
    expect(s.find((x) => x.theme === "influence")?.bullet).toBe("Persuaded two banks to co-sponsor a careers panel");
  });

  it("skips hidden entries and bullets, and returns nothing for an empty bank", () => {
    expect(suggestStories({ entries: [] }, qs)).toEqual([]);
    const bank: Bank = { entries: [entry({ title: "Secret", hidden: true, bullets: ["Led a team of 10"] })] };
    expect(suggestStories(bank, qs)).toEqual([]);
  });
});

describe("springPrep", () => {
  it("is null for anything that is not a spring week", () => {
    expect(springPrep(LOCAL_USER_ID, { employmentType: "internship", company: "Goldman Sachs", title: "Summer Analyst" })).toBeNull();
    expect(springPrep(LOCAL_USER_ID, { employmentType: "insight", company: "Goldman Sachs", title: "Insight Day" })).toBeNull();
  });

  it("reads the Experience Bank for a spring week", () => {
    expect(springPrep(LOCAL_USER_ID, { employmentType: "spring_week", company: "HSBC", title: "Spring Insight" })).toMatchObject({ bankEmpty: true, stories: [] });
    insertEntry(LOCAL_USER_ID, {
      section: "leadership", org: "UCL Finance Society", title: "Events Officer", dates: "2025", startYm: null, endYm: null, location: "",
      pinned: false, hidden: false, sourceIds: [],
      bullets: [{ text: "Organised a panel for 120 students with three banks", position: 0, pinned: false, hidden: false, sourceIds: [], sourceText: null }],
    });
    const p = springPrep(LOCAL_USER_ID, { employmentType: "spring_week", company: "HSBC", title: "Spring Insight" })!;
    expect(p.bankEmpty).toBe(false);
    expect(p.ctx.rival).toBe("Barclays");
    expect(p.stories[0]).toMatchObject({ label: "Events Officer · UCL Finance Society" });
  });
});
