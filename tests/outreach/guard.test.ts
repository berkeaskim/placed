import { describe, expect, it } from "vitest";
import ayse from "@/seed/demo/ayse.json";
import type { ParsedCV } from "@/lib/types";
import { CONNECTION_NOTE_MAX, checkOutreach, fitToLimit, removeSentences, type GuardSource } from "@/lib/outreach/guard";

const cv = ayse as unknown as ParsedCV;
const src = (note: string | null = null): GuardSource => ({ cv, cvText: "", facts: [], note, company: "Lendable", jobTitle: "Credit Analyst Intern (June 2027)" });

describe("checkOutreach passes honest messages", () => {
  it("allows CV facts, the target company and the job title", () => {
    const t = "Hi Sam, I'm a second-year Economics student at UCL applying for Lendable's Credit Analyst Intern role. " +
      "I built a London rent tracker in Python and SQL covering 1,200 listings. Could I ask you 15 minutes of questions about the team?";
    expect(checkOutreach(t, src())).toEqual([]);
  });
});

describe("checkOutreach blocks fabrication", () => {
  it.each([
    ["an invented skill", "I have built trading models in Kubernetes and Rust."],
    ["an invented number", "I managed a £50,000 budget for the society."],
    ["an invented employer", "I interned at Goldman Sachs last summer."],
    ["a claim about the recipient", "I read your article on credit risk and loved it."],
    ["a mutual connection", "We have a mutual friend from the society."],
    ["a claimed referral", "Alex recommended I reach out to you."],
  ])("%s", (_label, sentence) => {
    const issues = checkOutreach(`Hi Sam, I'm a UCL Economics student. ${sentence} Could we chat?`, src());
    expect(issues.length).toBeGreaterThan(0);
    expect(issues.some((i) => sentence.includes(i.sentence.trim()) || i.sentence.includes(sentence.trim().slice(0, 20)))).toBe(true);
  });

  it("note backs a 'we met' sentence", () => {
    const t = "Hi Sam, we met at the UCL Finance Society careers evening. Could I ask about your team?";
    expect(checkOutreach(t, src())).not.toEqual([]);
    expect(checkOutreach(t, src("We met at the UCL Finance Society careers evening last week"))).toEqual([]);
  });

  it("note does not launder an employer claim", () => {
    const t = "Hi Sam, I interned at Goldman Sachs. Could we chat?";
    expect(checkOutreach(t, src("I'm a Goldman Sachs intern"))).not.toEqual([]);
  });
});

describe("removeSentences and fitToLimit", () => {
  it("removes whole sentences and tidies spaces", () => {
    expect(removeSentences("One. Two bad. Three.", ["Two bad."])).toBe("One. Three.");
  });
  it("cuts at the last sentence boundary under the limit", () => {
    const long = `${"A short sentence. ".repeat(30)}`.trim();
    const out = fitToLimit(long);
    expect(out.length).toBeLessThanOrEqual(CONNECTION_NOTE_MAX);
    expect(out.endsWith(".")).toBe(true);
  });
  it("leaves a short note alone and hard-cuts one with no boundary", () => {
    expect(fitToLimit("Hi there.")).toBe("Hi there.");
    expect(fitToLimit("x".repeat(400)).length).toBeLessThanOrEqual(CONNECTION_NOTE_MAX);
  });
});

const wrap = (x: string) => `Hi Sam, I'm a UCL Economics student. ${x} Could we chat?`;
const ROLE = "Hi Sam, I'm a second-year Economics student at UCL applying for Lendable's Credit Analyst Intern role. ";

describe("checkOutreach blocks every probe sentence", () => {
  it.each([
    "I'm President of the UCL Finance Society.",
    "As Head of Events at the UCL Finance Society, I ran our flagship conference.",
    "I'm the sole Events Officer at the UCL Finance Society.",
    "I'm on track for a First-class degree.",
    "I'm predicted a First.",
    "I'm a dean's list student.",
    "I won the UCL Economics Prize last year.",
    "I hold a full scholarship at UCL.",
    "I'm graduating with a Master's in Finance.",
    "I'm CFA Level I certified.",
    "I'm fluent in Spanish and French.",
    "I interned at a hedge fund last summer.",
    "I have three years of experience in data analysis.",
    "I trained dozens of new staff at Marlowe Café.",
    "I managed a budget of fifty thousand pounds.",
    "I'm an expert in credit modelling.",
    "I was solely responsible for the society budget.",
    "I have 3 years of banking experience.",
    "I interned at Lendable last summer.",
    "I worked at Lendable last summer.",
    "I've been offered a place on Lendable's spring week.",
    "I spoke at your panel last month.",
    "I attended your talk at the careers fair.",
    "Priya said you'd be the right person to ask.",
    "I built dashboards for the whole team.",
    "I led a team of five analysts.",
  ])("%s", (sentence) => {
    const t = wrap(sentence);
    const issues = checkOutreach(t, src());
    expect(issues.some((i) => i.sentence === sentence)).toBe(true);
    // every attributed sentence really is in the text, so removeSentences can drop it
    for (const i of issues) expect(t).toContain(i.sentence);
    expect(removeSentences(t, issues.map((i) => i.sentence))).not.toContain(sentence);
  });

  it("blocks Goldman employment claims when Goldman is the target", () => {
    const g = { ...src(), company: "Goldman Sachs" };
    for (const x of ["I was a Goldman Sachs Spring Week intern.", "I interned at Goldman Sachs."]) {
      expect(checkOutreach(wrap(x), g).some((i) => i.sentence === x)).toBe(true);
    }
  });

  it("reports every fabricated sentence, not only the first of each kind", () => {
    const t = wrap("I won the UCL Economics Prize. I hold a full scholarship.");
    const sentences = checkOutreach(t, src()).map((i) => i.sentence);
    expect(sentences).toContain("I won the UCL Economics Prize.");
    expect(sentences).toContain("I hold a full scholarship.");
  });
});

describe("notes never launder the student's own claims", () => {
  it("a note number does not back a number claim", () => {
    const x = "I raised £50,000 for charity.";
    expect(checkOutreach(wrap(x), src("I raised £50,000 for charity")).some((i) => i.sentence === x)).toBe(true);
  });
  it("a negated note does not back 'we met'", () => {
    const x = "We met at the careers fair.";
    expect(checkOutreach(wrap(x), src("I never met him but talked to his colleague")).some((i) => i.sentence === x)).toBe(true);
  });
});

describe("checkOutreach passes honest messages", () => {
  it.each([
    ROLE + "I built a London rent tracker in Python and SQL covering 1,200 listings. Could I ask you two quick questions about the team?",
    ROLE + "Would you have time for a 10-minute call?",
    ROLE + "Any one or two pointers would be great.",
    "Hi Sam, I'm the Events Officer of the UCL Finance Society.",
    "Hi Sam, I'm fluent in English and a native Turkish speaker.",
    "Hi Sam, I'd love to learn more about Lendable's credit team.",
  ])("%s", (t) => {
    expect(checkOutreach(t, src())).toEqual([]);
  });
});

describe("fix round 2", () => {
  const has = (t: string, sentence: string, source: GuardSource = src()) => checkOutreach(t, source).some((i) => i.sentence === sentence);

  it("never blames an unrelated sentence (the greeting survives removal)", () => {
    const t = "Hi Sam, I'm a second-year Economics student at UCL. I led a team at the café. Could we chat?";
    const issues = checkOutreach(t, src());
    expect(issues.every((i) => i.sentence === "I led a team at the café.")).toBe(true);
    expect(removeSentences(t, issues.map((i) => i.sentence))).toContain("Hi Sam, I'm a second-year Economics student at UCL.");
  });

  it.each([
    "I won't take more than 15 minutes.",
    "I'm hoping to work at Lendable one day.",
    "I want to work at Lendable after I graduate.",
    "I've always wanted to intern at Lendable.",
    "I'd love to work at Lendable.",
    "I saw you joined Lendable after UCL.",
    "Keen to hear how you found the move to Lendable.",
    "Any advice for my internship applications would be great.",
    "I noticed Lendable won an award recently.",
    "I'm a member of the UCL Finance Society.",
    "I got A* in Maths.",
  ])("passes: %s", (x) => {
    expect(checkOutreach(`Hi Sam, ${x}`, src())).toEqual([]);
  });

  it.each([
    "I hold a Lendable offer for the summer.",
    "I've already passed the first round at Lendable.",
    "I have an interview with Lendable next week.",
    "I'm a member of the Oxford Chess Society.",
    "I was top of my class.",
    "I got A* in Further Maths.",
    "I tutor GCSE students.",
    "I volunteered at a food bank.",
    "I speak spanish at home.",
    "I told you I interned at Lendable.",
  ])("blocks: %s", (x) => {
    expect(has(wrap(x), x)).toBe(true);
  });

  it("interview claim at the target passes only with allowInterviewClaim", () => {
    const x = "I have an interview coming up at Lendable.";
    expect(has(wrap(x), x)).toBe(true);
    expect(checkOutreach(`Hi Sam, ${x}`, { ...src(), allowInterviewClaim: true })).toEqual([]);
    const o = "I hold a Lendable offer for the summer.";
    expect(has(wrap(o), o, { ...src(), allowInterviewClaim: true })).toBe(true);
  });

  it("does not split on decimals, initialisms or titles", () => {
    const x = "I'm at U.C.L. and raised £1.5m for charity.";
    const t = wrap(x);
    const issues = checkOutreach(t, src());
    expect(issues.some((i) => i.sentence === x)).toBe(true);
    expect(removeSentences(t, issues.map((i) => i.sentence))).not.toMatch(/£1|charity/);
    expect(removeSentences("Dear Mr. Patel, could we chat?", [])).toBe("Dear Mr. Patel, could we chat?");
    expect(removeSentences("Dear Mr. Patel, could we chat? Bad one.", ["Bad one."])).toBe("Dear Mr. Patel, could we chat?");
  });
});

describe("fix round 3", () => {
  const blocked = (x: string, source: GuardSource = src()) => {
    const t = wrap(x);
    const issues = checkOutreach(t, source);
    expect(issues.some((i) => i.sentence === x)).toBe(true);
    expect(removeSentences(t, issues.map((i) => i.sentence))).not.toContain(x);
  };
  it.each([
    // A: plural claims are the student's
    "We won the Economics Prize last year.", "Our team won the Economics Prize.", "We were ranked first in the UCL trading challenge.",
    "Our team took first place and a scholarship.", "We received a bursary for the project.", "We won a Distinction.",
    // B
    "I loved my internship.", "My internship taught me credit modelling.",
    // C: intent cannot cover a real claim
    "I wanted to intern at Lendable and did so last summer.", "I'd love to return to Lendable after my internship there.",
    "I wanted to work at Lendable after my internship at Lendable.", "I always wanted to work at Lendable, and last summer I did.",
    "I hoped to join Lendable and was lucky enough to intern there in 2025.", "I'd love to work at Lendable again.",
    "I'd love to rejoin Lendable.", "I'd like to build on my time at Lendable.",
    // D: recipient-phrased
    "Your team at Lendable hosted me as an intern last summer.", "You and I overlapped at Lendable.", "Same as you, I spent last summer at Lendable.",
    // F, G
    "As Head of Events at the UCL Finance Society, I ran our flagship conference.", "My Spanish is fluent.",
  ])("blocks: %s", (x) => blocked(x));

  it("blocks a Goldman target with the same intent cover", () => blocked("I wanted to intern at Goldman Sachs and did so last summer.", { ...src(), company: "Goldman Sachs" }));

  it.each([
    "I noticed Lendable won an award recently.", "Congrats on winning the award!",
    "Any advice for my internship applications would be great.",
    "I'm hoping to work at Lendable one day.", "I want to work at Lendable after I graduate.", "I'd love to work at Lendable.",
    "I saw you joined Lendable after UCL.",
    "I'm applying for the Credit Analyst Intern role at Lendable.", "I've applied for the Credit Analyst Intern (June 2027) position at Lendable.",
    "I'm interested in the intern role at Lendable.",
    "I noticed you were promoted to Head of Credit last year.",
    "My English is fluent.",
  ])("passes: %s", (x) => expect(checkOutreach(`Hi Sam, ${x}`, src())).toEqual([]));
});

describe("fix round 4", () => {
  const blocked = (x: string, source: GuardSource = src()) => {
    const t = wrap(x);
    const issues = checkOutreach(t, source);
    expect(issues.some((i) => i.sentence === x)).toBe(true);
    expect(removeSentences(t, issues.map((i) => i.sentence))).not.toContain(x);
  };
  const full = (x: string) => `Hi Sam, I'm a second-year Economics student at UCL. ${x} Could we chat?`;

  it.each([
    // R8: a first-person clause naming the target passes only in an allowed frame
    "Last year I shadowed the credit team at Lendable for a week.", "I currently work part-time at Lendable's London office.",
    "I work part-time at Lendable.", "I'm a contractor at Lendable.", "I've been helping Lendable's credit team with data cleaning since June.",
    "I'm on Lendable's graduate scheme already.", "I already completed the Lendable online tests and video stage.",
    "I was a summer analyst at Lendable in 2025.",
    "I'm applying to Lendable, where I worked last summer.", "I applied to Monzo and worked at Lendable last summer.",
    "I know Lendable well from my summer there.", "Worked at Lendable last summer as an analyst.",
    // referral, founding, committee, ranking
    "Your colleague Priya invited me to apply.", "We co-founded a fintech society at UCL.", "I sat on the UCL Economics Society committee.",
    "I placed second in the UCL trading challenge.", "We came second in the UCL trading challenge.",
  ])("blocks: %s", (x) => blocked(x));

  it.each([
    "Last summer I worked on my rent tracker, and now I'm applying to Lendable.",
    "I spent last summer building my rent tracker, which is why Lendable's credit work appeals to me.",
    "Last summer I joined the UCL Finance Society, and now I'm applying to Lendable.",
    "I'd love to know what a typical week looks like for an intern at Lendable.",
    "Did you join Lendable straight after UCL, or did you work somewhere else first?",
    "I'm hoping to apply to Lendable again next cycle if this one doesn't work out.",
    "My internship search has focused on fintech lenders like Lendable.",
    "I'm keen to return to London after my exchange and join a team like Lendable's.",
    "I noticed Lendable was named a top fintech employer, which is part of why I'm applying.",
    "I'm interested in the intern role at Lendable.", "I'd love to learn more about Lendable's credit team.",
    "What is it like working at Lendable?",
    "I'm applying to Lendable, which is a leader in fintech lending.", "I'm applying to Lendable and would love to work there.",
    "I'd love to learn about the team and the culture at Lendable.", "I've been following Lendable's growth for a while.",
  ])("passes: %s", (x) => expect(checkOutreach(full(x), src())).toEqual([]));

  it("blocks 'worked on credit data' only for the skill or number, never as a Lendable work claim", () => {
    const issues = checkOutreach(full("I worked on credit data in my rent tracker and I'm applying to Lendable."), src());
    expect(issues.filter((i) => /Lendable/.test(i.reason))).toEqual([]);
    const y = checkOutreach(full("I worked on credit data in 2025 and I'm applying to Lendable."), src());
    expect(y.filter((i) => /Lendable/.test(i.reason))).toEqual([]);
  });

  // Task 12 demo fixtures, filled for Lendable / Sam / the job title: they must stay clean.
  const fill = (x: string) => x.replace(/\{name\}/g, "Sam").replace(/\{company\}/g, "Lendable").replace(/\{role\}/g, "Credit Analyst Intern (June 2027)");
  it.each([
    ["alumni", "Hi {name}, I'm a second-year Economics student at UCL and I'm applying for {company}'s {role}. As a UCL student I'd really value 15 minutes of your advice on the team and the process.",
      "Hi {name}, thanks for connecting. I'm studying Economics at UCL and I'm applying to {company}. I've been working with data in my own time: I built a London rent tracker in Python and SQL that collected and cleaned 1,200 rental listings. I'd love 15 minutes of your time whenever suits you. A few things I'm curious about are below."],
    ["recent_joiner", "Hi {name}, I'm a UCL Economics student applying for {company}'s {role}. You joined fairly recently, so I'd be grateful for 15 minutes on what the process and first months were like.",
      "Hi {name}, thanks for accepting. I'm in my second year of Economics at UCL and I'm applying to {company}. I use Python, SQL and Excel, most recently on a project tracking rents across 12 London boroughs. Since you went through the process recently, I'd really value 15 minutes of your perspective."],
    ["team", "Hi {name}, I'm a UCL Economics student interested in the work your team does at {company}. Could I ask you a couple of questions about the role?",
      "Hi {name}, thanks for connecting. I'm studying Economics at UCL and I'm applying for {company}'s {role}. I enjoy working with data and built a rent tracker in Python and SQL that collected and cleaned 1,200 rental listings. I'd like to understand what the work in your team looks like day to day. Would you have 15 minutes in the next few weeks?"],
    ["recruiter", "Hi {name}, I'm a second-year Economics student at UCL applying for {company}'s {role}. I'd be grateful to connect and ask a quick question about the process.",
      "Hi {name}, thanks for connecting. I'm studying Economics at UCL and I'm applying for the {role} at {company}. I'd really appreciate 15 minutes, or a short reply, on a couple of questions about the process."],
    ["follow_up", "Hi {name}, I applied for {company}'s {role} a few weeks ago and wanted to check whether there's any update on the timeline. Thank you for your time.",
      "Hi {name}, I hope you're well. I applied for the {role} at {company} a few weeks ago and I'm still very interested. Could you let me know if there's an expected timeline for the next stage? Thank you for your help."],
    ["interview_prep", "Hi {name}, I'm a UCL Economics student with an upcoming interview at {company} for the {role}. As a UCL student, could I ask you two quick questions about preparing?",
      "Hi {name}, thanks for connecting. I have an interview coming up at {company} for the {role}. I'm in my second year of Economics at UCL and I've mostly worked with data in Python and SQL. I'd be very grateful for 15 minutes of advice on how to prepare."],
  ])("Task 12 %s fixture passes", (kind, note, chat) => {
    expect(checkOutreach(fill(`${note} ${chat}`), { ...src(), allowInterviewClaim: kind === "interview_prep" })).toEqual([]);
  });
});

describe("fix round 5", () => {
  const full = (x: string) => `Hi Sam, I'm a second-year Economics student at UCL. ${x} Could we chat?`;

  it.each([
    "I first heard about Lendable at a UCL careers fair.",
    "I'm looking forward to learning more about Lendable.",
    "I've been reading Lendable's engineering blog.",
    "I believe my skills would be a good fit for Lendable.",
    "I think Lendable would be a great place to start my career.",
    "Lendable stood out to me because of its focus on fair lending.",
    "I'm reaching out because of my interest in Lendable.",
    "I'd be thrilled to start my career at Lendable.",
    "I'd welcome the chance to contribute to Lendable.",
    "I learned about Lendable from a classmate.",
    "I came across Lendable through a friend's recommendation.",
    "I saw Lendable's post about the internship on LinkedIn.",
    "I visited Lendable's careers page and saw the internship.",
    "After researching Lendable, I'm keen to apply.",
    "My goal is to build a career at a fintech like Lendable.",
    "I use Lendable's app myself.",
    "I was at a careers fair where Lendable presented.",
    "My rent tracker gave me a feel for credit data, which is why I'm applying to Lendable.",
  ])("passes: %s", (x) => expect(checkOutreach(full(x), src())).toEqual([]));

  it.each([
    "I'm applying to Lendable, whose team hosted me last summer.",
    "Lendable's internship gave me my first taste of credit.",
    "Lendable hired me last summer.",
    "Lendable was my first employer.",
    "Lendable has employed me since June.",
    "Lendable's credit team trained me on SQL last summer.",
    "Lendable's team taught me a lot last summer.",
    "I'm interested in returning to Lendable's credit team.",
    "I'd love to come back to Lendable's credit team.",
    "I'm applying to Lendable after my spring week.",
    "I was part of Lendable's insight programme in 2025.",
    "I was on Lendable's insight programme last year.",
    "You hired me at Lendable last summer.",
    "Your team at Lendable onboarded me in June.",
    "I'd love to be back at Lendable.",
    "Lendable hosted me for a week in 2025, so I'm applying.",
  ])("blocks: %s", (x) => {
    const t = full(x);
    const issues = checkOutreach(t, src());
    expect(issues.some((i) => i.sentence === x)).toBe(true);
    expect(issues.every((i) => i.sentence === x)).toBe(true);
  });

  it("requests to the recipient that use 'me' still pass", () => {
    for (const x of ["Could you tell me what the Lendable credit team looks for?", "I'd be grateful if you could give me advice on applying to Lendable.",
      "Please let me know if Lendable runs a spring week."]) expect(checkOutreach(full(x), src())).toEqual([]);
  });

  it("a 20,000-char run of capitalised words completes in under 300 ms", () => {
    const t = `Hi Sam, ${"Abc ".repeat(5000)}committee.`;
    const start = performance.now();
    checkOutreach(t, src());
    expect(performance.now() - start).toBeLessThan(300);
  });
});
