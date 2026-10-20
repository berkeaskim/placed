/**
 * Spring week interview prep: a fixed 30-question bank, firm video-interview presets and the motivation-first framing.
 * A separate experience from internship prep: no technicals, no superday, nothing from the generic web-researched pack.
 * Deterministic on purpose: spring week interviews are short and motivational, the questions barely vary by firm, and
 * a student should be able to practise with AI turned off. Source: research/spring-weeks/05-application-content.md
 * (§2 per-firm reports, §5 differentiators, §6e question bank). Firm reports are student accounts [R], not official.
 */

export type SpringGroup = "motivation" | "competency" | "commercial" | "curveball";
/** Competency themes the STAR matcher looks for in the Experience Bank. */
export type StoryTheme =
  | "lead" | "team" | "failure" | "challenge" | "influence" | "learn" | "data" | "conflict" | "pressure" | "achievement" | "unique";

export type SpringQuestionDef = {
  id: number;
  group: SpringGroup;
  /** Placeholders: {firm}, {rival}, {division}, {adjacent}. */
  text: string;
  whyTheyAsk: string;
  prepTip: string;
  theme?: StoryTheme;
};

export type SpringQuestion = Omit<SpringQuestionDef, "text"> & { text: string };

export const SPRING_GROUPS: { key: SpringGroup; label: string }[] = [
  { key: "motivation", label: "Motivation" },
  { key: "competency", label: "Competency" },
  { key: "commercial", label: "Commercial" },
  { key: "curveball", label: "Curveball" },
];

export const SPRING_QUESTIONS: SpringQuestionDef[] = [
  // Motivation
  { id: 1, group: "motivation", text: "Why {firm}? And why not {rival}?",
    whyTheyAsk: "The most-cited reason applications fail is a generic answer that would be just as true of a competitor.",
    prepTip: "Give three reasons only true of {firm}: a recent deal or business line, something about the programme, and a person you spoke to or an event you went to. Swap in {rival}'s name: if it still reads true, it is too generic." },
  { id: 2, group: "motivation", text: "Why {division}, and not {adjacent}?",
    whyTheyAsk: "They want a realistic division choice from someone who knows what the team actually does day to day.",
    prepTip: "One line on what {division} does, one on why it suits how you work, and one honest line on why {adjacent} fits you less." },
  { id: 3, group: "motivation", text: "Why finance? And why now, in your first year?",
    whyTheyAsk: "First-years have no track record, so the story of how your interest started is the evidence.",
    prepTip: "Origin story: the specific moment your interest sparked, what you did next (a society, a stock pitch, reading, a virtual internship), and what you want to learn." },
  { id: 4, group: "motivation", text: "Why this programme? What do you want to get out of the week?",
    whyTheyAsk: "Spring weeks are a recruiting pipeline: they want people who will use the week, not just list it.",
    prepTip: "Name what you want to find out (which division suits you, what an analyst's day looks like) and one programme feature you read about." },
  { id: 5, group: "motivation", text: "What do you already know about {firm}?",
    whyTheyAsk: "A quick test of real research. One Citi interviewer reportedly asked for the CEO's name.",
    prepTip: "Know the CEO, the main divisions, one recent result or deal, and what {firm} is known for compared with {rival}." },
  { id: 6, group: "motivation", text: "Which division do you like least, and why?",
    whyTheyAsk: "Reported at Bank of America: it checks you understand the divisions well enough to compare them.",
    prepTip: "Pick a real division, say what it does fairly, then explain why your strengths fit elsewhere. Never dismiss it." },

  // Competency (STAR)
  { id: 7, group: "competency", theme: "lead", text: "Tell me about a time you led a team through a difficulty.",
    whyTheyAsk: "Leadership at school or university is the main signal they have for a first-year.",
    prepTip: "Keep Situation and Task under 20% of the answer. Spend it on what you did, and end with a result and what you'd do differently." },
  { id: 8, group: "competency", theme: "team", text: "Tell me about a time you worked in a team, or with someone new.",
    whyTheyAsk: "The week itself is group work with strangers; they want to know how you'll fit in.",
    prepTip: "Say \"I\", not \"we\", for your part. Show how you got the team working, not just that it worked." },
  { id: 9, group: "competency", theme: "failure", text: "Tell me about a time you failed or made a mistake.",
    whyTheyAsk: "They're testing honesty and whether you learn, not looking for a perfect record.",
    prepTip: "Pick a real mistake with a small cost, own it in one sentence, and spend most of the answer on what you changed afterwards." },
  { id: 10, group: "competency", theme: "challenge", text: "Tell me about a challenge you faced and how you reacted.",
    whyTheyAsk: "Resilience: interview processes and junior jobs both involve setbacks.",
    prepTip: "Choose a challenge where your own action changed the outcome, and give a concrete result." },
  { id: 11, group: "competency", theme: "influence", text: "Tell me about a time you persuaded someone, ideally someone more senior.",
    whyTheyAsk: "Reported at Citi and Morgan Stanley: juniors who can make a case clearly are valuable.",
    prepTip: "Show how you understood their view first, what evidence you used, and what changed because of it." },
  { id: 12, group: "competency", theme: "learn", text: "Tell me about a time you had to learn something new quickly.",
    whyTheyAsk: "Every spring week throws you into unfamiliar material; they want fast learners.",
    prepTip: "Say how you learned it (what you read, who you asked), how fast, and what you produced with it." },
  { id: 13, group: "competency", theme: "data", text: "Tell me about a time you used data to solve a problem.",
    whyTheyAsk: "Reported at J.P. Morgan; numbers are the job in most divisions.",
    prepTip: "Name the data, what you did with it (a spreadsheet, a survey, a script), and the decision it led to, with a number." },
  { id: 14, group: "competency", theme: "conflict", text: "Tell me about a time you resolved a conflict.",
    whyTheyAsk: "Teams under pressure disagree; they want to see you handle it calmly.",
    prepTip: "Describe both views fairly, what you did to find common ground, and how the relationship ended up." },
  { id: 15, group: "competency", theme: "pressure", text: "Tell me about a time you worked under pressure or juggled deadlines.",
    whyTheyAsk: "Analyst hours are long; they look for organisation, not heroics.",
    prepTip: "Show your system: how you prioritised, what you dropped or delegated, and that everything landed." },
  { id: 16, group: "competency", theme: "achievement", text: "What is your biggest achievement outside your studies?",
    whyTheyAsk: "Reported at Bank of America and Morgan Stanley: it shows what you care about and how hard you push.",
    prepTip: "Pick something with a number or a clear bar you cleared, and say why it mattered to you." },
  { id: 17, group: "competency", theme: "unique", text: "Tell me something about you that isn't on your CV.",
    whyTheyAsk: "Reported at Nomura and BlackRock: they want a person, not a list.",
    prepTip: "A genuine interest or responsibility with a short story attached. Make it memorable, and tie it lightly to the job." },
  { id: 18, group: "competency", text: "What are your strengths, and a real weakness?",
    whyTheyAsk: "Self-awareness: they can tell a disguised strength from an honest weakness.",
    prepTip: "Give one strength with evidence, and a real weakness with what you're already doing about it." },
  { id: 19, group: "competency", text: "Walk me through your CV, or tell me about yourself.",
    whyTheyAsk: "Usually the opener: it sets the tone and gives them hooks to ask about.",
    prepTip: "About 60 to 90 seconds: where you study and why, two or three things you've done, and how they led you to apply." },

  // Commercial awareness
  { id: 20, group: "commercial", text: "Tell me about a recent news story or economic event and its impact on {firm} or {division}.",
    whyTheyAsk: "Asked at most banks (HSBC, Nomura, BofA, Barclays): it shows you follow markets beyond the headlines.",
    prepTip: "Follow one story for a few weeks and take notes. Say what happened, why it matters for {division}, and your own view." },
  { id: 21, group: "commercial", text: "Tell me about a deal you've followed. For banking roles, a recent {firm} deal.",
    whyTheyAsk: "Reported at UBS, Citi and Goldman Sachs: a quick test of genuine interest.",
    prepTip: "Rough size, the parties, why they did it, how the market reacted, and whether you think it was a good idea." },
  { id: 22, group: "commercial", text: "What's happening in markets right now, and what's your view?",
    whyTheyAsk: "Mostly a Markets question (reported at Citi and Lazard): they want a view, not a summary.",
    prepTip: "Pick one theme (rates, inflation, a sector), state a view in one sentence, then give two reasons." },
  { id: 23, group: "commercial", text: "Which industry or company do you follow, and why?",
    whyTheyAsk: "Reported at J.P. Morgan: it shows sustained curiosity.",
    prepTip: "Choose one you genuinely read about, and say what's changing in it and what you'd watch next." },
  { id: 24, group: "commercial", text: "Describe one aspect of an asset class you recently learned about.",
    whyTheyAsk: "Reported at Goldman Sachs: it tests whether you learn on your own.",
    prepTip: "Keep it simple and correct: what the asset is, who buys it, and one thing that moves its price." },
  { id: 25, group: "commercial", text: "What are {firm}'s greatest strengths? What sets it apart?",
    whyTheyAsk: "Reported at UBS: a sharper version of \"Why us?\".",
    prepTip: "Two strengths with evidence (a ranking, a result, a business line), each tied to why it matters to you." },
  { id: 26, group: "commercial", text: "How does a recent macro development (rates, inflation, a geopolitical event) affect {firm}?",
    whyTheyAsk: "Connects the news to the business, which is what the job is.",
    prepTip: "Pick one development and trace it to one {firm} business line: revenue, costs or clients." },

  // Curiosity and first-year experience
  { id: 27, group: "motivation", text: "What have you done so far to find out whether finance is for you?",
    whyTheyAsk: "Spring weeks reward curiosity you've acted on, not experience you can't have yet.",
    prepTip: "List what you've actually done: a society talk, an insight evening, a virtual experience, a book, a conversation with someone in the industry. Pick the one that changed your mind about something." },
  { id: 28, group: "competency", theme: "learn", text: "How has your first term at university gone, and what has it taught you about how you work?",
    whyTheyAsk: "They're hiring first-years: settling in, juggling new commitments and reflecting on it is the evidence they have.",
    prepTip: "One honest adjustment you had to make (workload, independence, a new society role), what you changed, and what it says about how you'll handle the week." },
  { id: 29, group: "motivation", text: "If you could ask an analyst at {firm} one question on day one, what would it be?",
    whyTheyAsk: "A good question shows genuine curiosity and that you've thought about the job, not just the logo.",
    prepTip: "Ask about something you've read or heard about {firm} or {division}, and say briefly why you want to know." },

  // Curveball
  { id: 30, group: "curveball", text: "What makes a great spring week intern? Or: if you were a company, which would you be?",
    whyTheyAsk: "Tests whether you can think on your feet without a script.",
    prepTip: "Pause, pick one answer, give one reason, and link it back to yourself. Short is fine." },
];

/** Video interview format for one firm. Timings are student reports (research 05 §2), not official guidance. */
export type VideoPreset = {
  questions: number;
  prepSeconds: number;
  answerSeconds: number;
  /** Bank ids candidates reported for this firm, practised first. */
  reported: number[];
  note: string;
};

export const DEFAULT_PRESET: VideoPreset = {
  questions: 5, prepSeconds: 30, answerSeconds: 120, reported: [],
  note: "Most spring week video interviews are 3 to 7 questions, about 30 seconds to prepare and 90 to 120 seconds to answer, one take.",
};

type Firm = { match: RegExp; name: string; rival: string; preset: Partial<VideoPreset> };

const FIRMS: Firm[] = [
  { match: /goldman/i, name: "Goldman Sachs", rival: "Morgan Stanley",
    preset: { questions: 5, answerSeconds: 120, reported: [10, 24, 21, 1], note: "Goldman Sachs: students report 5 to 6 behavioural questions, 30 seconds to prepare, 2 minutes to answer." } },
  { match: /j\.?\s?p\.?\s?morgan|jpmorgan|chase/i, name: "J.P. Morgan", rival: "Goldman Sachs",
    preset: { questions: 3, answerSeconds: 120, reported: [1, 4, 13, 23], note: "J.P. Morgan: students report about 3 questions, 2 minutes each, due within about 2 business days of applying." } },
  { match: /morgan\s+stanley/i, name: "Morgan Stanley", rival: "Goldman Sachs",
    preset: { questions: 5, reported: [1, 5, 8, 16], note: "Morgan Stanley: students report 5 to 7 video questions." } },
  { match: /\bciti(group|bank)?\b/i, name: "Citi", rival: "J.P. Morgan",
    preset: { questions: 4, answerSeconds: 120, reported: [1, 11, 12, 22], note: "Citi: students report 4 to 5 questions of about 2 minutes each." } },
  { match: /bank\s+of\s+america|\bbofa\b/i, name: "Bank of America", rival: "Citi",
    preset: { questions: 5, answerSeconds: 90, reported: [19, 10, 1, 20, 6, 16], note: "Bank of America: students report 5 to 6 questions with about 90 seconds each." } },
  { match: /barclays/i, name: "Barclays", rival: "HSBC",
    preset: { questions: 5, reported: [4, 1, 3, 20], note: "Barclays: students report 5 to 6 recorded answers. Barclays bans third-party AI tools in interviews." } },
  { match: /\bhsbc\b/i, name: "HSBC", rival: "Barclays",
    preset: { reported: [1, 10, 20], note: "HSBC: the video sits inside an immersive job simulation, reportedly about 45 minutes in total." } },
  { match: /nomura/i, name: "Nomura", rival: "Mizuho",
    preset: { reported: [1, 17, 20], note: "Nomura: no CV or cover letter; the same three themes come up in the questions." } },
  { match: /blackrock/i, name: "BlackRock", rival: "Vanguard",
    preset: { reported: [1, 17], note: "BlackRock: a short pre-interview assessment shortly after applying." } },
  { match: /\bubs\b/i, name: "UBS", rival: "Deutsche Bank",
    preset: { reported: [1, 3, 21, 25, 14, 19] } },
  { match: /lazard/i, name: "Lazard", rival: "Evercore", preset: { reported: [1, 22, 19] } },
  { match: /rothschild/i, name: "Rothschild & Co", rival: "Lazard", preset: {} },
  { match: /deutsche\s+bank/i, name: "Deutsche Bank", rival: "Barclays", preset: {} },
  { match: /evercore/i, name: "Evercore", rival: "Lazard", preset: {} },
];

type Division = { match: RegExp; name: string; adjacent: string };
const DIVISIONS: Division[] = [
  { match: /investment\s+banking|\bibd?\b|corporate\s+finance|m&a|advisory/i, name: "Investment Banking", adjacent: "Markets" },
  { match: /markets|sales\s*(&|and)\s*trading|\btrading\b|\bs&t\b/i, name: "Markets", adjacent: "Investment Banking" },
  { match: /asset\s+management|investment\s+management|\bam\b/i, name: "Asset Management", adjacent: "Wealth Management" },
  { match: /wealth|private\s+bank/i, name: "Wealth Management", adjacent: "Asset Management" },
  { match: /research/i, name: "Research", adjacent: "Markets" },
  { match: /technology|engineering|\btech\b|software|data/i, name: "Technology", adjacent: "Operations" },
  { match: /operations|\bops\b/i, name: "Operations", adjacent: "Technology" },
  { match: /risk|compliance/i, name: "Risk", adjacent: "Operations" },
];

export type SpringContext = { firm: string; rival: string; division: string; adjacent: string; preset: VideoPreset; knownFirm: boolean };

/** Firm, closest competitor, division and video preset for a spring week posting. Unknown parts get neutral wording. */
export function springContext(company: string, title: string): SpringContext {
  const f = FIRMS.find((x) => x.match.test(company));
  const d = DIVISIONS.find((x) => x.match.test(title));
  return {
    firm: company.trim() || "this firm",
    rival: f?.rival ?? "its closest competitor",
    division: d?.name ?? "your chosen division",
    adjacent: d?.adjacent ?? "another division",
    preset: { ...DEFAULT_PRESET, ...f?.preset },
    knownFirm: Boolean(f),
  };
}

const fill = (s: string, c: SpringContext) =>
  s.replace(/\{firm\}/g, c.firm).replace(/\{rival\}/g, c.rival).replace(/\{division\}/g, c.division).replace(/\{adjacent\}/g, c.adjacent);

export function renderQuestion(q: SpringQuestionDef, c: SpringContext): SpringQuestion {
  return { ...q, text: fill(q.text, c), whyTheyAsk: fill(q.whyTheyAsk, c), prepTip: fill(q.prepTip, c) };
}

export function springQuestions(c: SpringContext): SpringQuestion[] {
  return SPRING_QUESTIONS.map((q) => renderQuestion(q, c));
}

// Without firm reports, a practice set still mixes the three things spring week interviews test.
const CORE_ORDER = [1, 2, 10, 4, 20, 8, 3, 16, 12, 13, 21, 7];

/**
 * The questions for one timed practice run: the firm's reported questions first, then the core mix. Each `seed` pages
 * on through that list, so "practise again" is a different interview.
 */
export function practiceSet(c: SpringContext, opts: { seed?: number } = {}): SpringQuestion[] {
  const take = Math.min(7, Math.max(3, c.preset.questions));
  const pool = [...new Set([...c.preset.reported, ...CORE_ORDER])];
  const start = (Math.abs(opts.seed ?? 0) * take) % pool.length;
  const ids = Array.from({ length: take }, (_, i) => pool[(start + i) % pool.length]);
  return ids.map((id) => renderQuestion(SPRING_QUESTIONS.find((q) => q.id === id)!, c));
}

/** The short, motivation-first framing shown instead of the generic process and tips. */
export const SPRING_FRAMING = {
  lead: "Spring week interviews are short and about motivation: why this firm, why this division, and what you've already done about your curiosity as a first-year.",
  process: [
    { stage: "Online form and CV", note: "Plus one to five short answers. Rarely a cover letter." },
    { stage: "Online tests", note: "Numerical, verbal or a situational judgement test. Invites often expire in 3 to 5 days." },
    { stage: "Recorded video interview", note: "3 to 7 questions, about 30 seconds to prepare and 90 to 120 seconds to answer, usually one take." },
    { stage: "Offer, then the week itself", note: "Places fill on a rolling basis. The week is talks, shadowing and a group task, and can lead to a fast-track summer interview." },
  ],
  tips: [
    "Pass the substitution test: three reasons only true of this firm (a deal, a business line, a person you spoke to).",
    "Formula: one specific fact about the firm, one honest personal link, and a realistic division with one line on what that team does.",
    "Have 8 to 10 STAR stories ready, each tagged to a question type, and keep Situation and Task short.",
    "Follow one deal or market story for a few weeks, with notes and a view of your own.",
    "Practise out loud with a timer, but use bullet cues, not a script: memorised answers fall apart off-script.",
  ],
} as const;
