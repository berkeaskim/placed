/**
 * Curated placement interview question bank (placement 05 §4e: 40 questions, technicals by stream), shown with the
 * AI pack for placement jobs. Spring weeks have their own local prep (spring-bank.ts, SpringPrepPanel). Deterministic,
 * so it works with AI off and is never cached with a company's AI pack. Practice only: Placed never assists during a
 * real video interview, test or assessment centre, and at employers that ban AI in interviews the prep is coach-only.
 */
import type { Track } from "@/lib/cv-rules/types";
import type { Archetype } from "@/lib/types";
import { employerAiPolicy } from "@/lib/employer-policy";

export type BankTheme = "motivation" | "competency" | "commercial" | "strengths" | "scenario" | "technical" | "curveball";
export type Stream = "software" | "data_economics" | "engineering" | "quality_manufacturing" | "pharma_chemistry" | "audit_tax" | "finance";
export type BankQuestion = { question: string; theme: BankTheme; stream?: Stream };

export const THEME_LABELS: Record<BankTheme, string> = {
  motivation: "Motivation", competency: "Competency (STAR)", commercial: "Commercial awareness", strengths: "Strengths",
  scenario: "Scenarios", technical: "Technical", curveball: "Curveballs and close",
};

/** [firm] is replaced with the company. */
export const PLACEMENT_BANK: BankQuestion[] = [
  { theme: "motivation", question: "Why do you want to do a placement year?" },
  { theme: "motivation", question: "Why a 12-month placement rather than a summer internship?" },
  { theme: "motivation", question: "What do you want to gain from this placement, and how does it fit your long-term goals?" },
  { theme: "motivation", question: "What will you bring back to your final year?" },
  { theme: "motivation", question: "Why [firm]? Why this site or location?" },
  { theme: "motivation", question: "Why this stream or function, and not the one next to it?" },
  { theme: "motivation", question: "What do you think a placement student does here day to day?" },
  { theme: "motivation", question: "Would you see yourself joining us after you graduate?" },
  { theme: "motivation", question: "What is one current issue facing this industry, or a problem [firm] faces?" },
  { theme: "competency", question: "Tell me about a time you worked well in a team with different skills, such as a group project." },
  { theme: "competency", question: "Tell me about a time you solved a technical problem by finding its root cause." },
  { theme: "competency", question: "Tell me about a time you planned your own work and then had to adapt to a change." },
  { theme: "competency", question: "Explain something technical to someone without a technical background." },
  { theme: "competency", question: "Tell me about a time you showed resilience." },
  { theme: "competency", question: "Tell me about a time you took the lead, or a time you failed." },
  { theme: "competency", question: "What is your proudest achievement, or a project you managed?" },
  { theme: "competency", question: "Tell me about a time you improved how something was done." },
  { theme: "competency", question: "Tell me about a time you made a decision with incomplete information." },
  { theme: "competency", question: "Tell me about a time you delivered to a tight deadline." },
  { theme: "competency", question: "Tell me about a time you worked with someone very different from you, or acted inclusively." },
  { theme: "strengths", question: "What activities give you an energy buzz?" },
  { theme: "strengths", question: "What do you find quick to learn?" },
  { theme: "strengths", question: "Are you a starter or a finisher?" },
  { theme: "strengths", question: "How do you judge success?" },
  { theme: "strengths", question: "Do you find deadlines motivating?" },
  { theme: "strengths", question: "What do you do when you're curious about something?" },
  { theme: "strengths", question: "Tell me about something you've taught yourself recently." },
  { theme: "scenario", question: "A project falls behind schedule and it's your fault. What do you do?" },
  { theme: "scenario", question: "How do you cope with a strict deadline when there isn't time to make everything perfect?" },
  { theme: "scenario", question: "You spot an error in a senior colleague's work the day before it goes to a client or regulator. What do you do?" },
  { theme: "technical", stream: "software", question: "Walk me through a project's architecture and one trade-off you made. Then: OOP and data-structure basics, a SQL join, and the complexity of your solution." },
  { theme: "technical", stream: "data_economics", question: "Explain a regression you ran and how you checked it. Expect an Excel task, and a micro or macro policy question for economics streams." },
  { theme: "technical", stream: "engineering", question: "Explain your design project's spec, constraints and test results. Expect material selection, tolerances or failure modes, and FMEA or root-cause tools." },
  { theme: "technical", stream: "quality_manufacturing", question: "What is a non-conformance? How would you use 5 Whys or 8D, and how would you reduce defects on a line?" },
  { theme: "technical", stream: "pharma_chemistry", question: "Walk through a reaction or technique you've run and its safety controls. Expect mechanism questions and interpreting a spectrum." },
  { theme: "technical", stream: "audit_tax", question: "What does an auditor do and why does it matter? Audit vs tax vs advisory, a recent business story's impact on a client, and what you know about the ACA." },
  { theme: "technical", stream: "finance", question: "Talk me through the three financial statements, and a market story you follow." },
  { theme: "curveball", question: "Tell me about yourself, or walk me through your CV." },
  { theme: "curveball", question: "What would your group-project teammates say about you?" },
  { theme: "curveball", question: "What questions do you have for us?" },
];

export const PLACEMENT_PRESETS: string[] = [
  "Video interview with no re-record (Bank of England style).",
  "Civil Service behaviour interview: STAR answers plus a strengths question.",
  "Rapid strengths interview (EY, Mott MacDonald): short, instinctive answers.",
  "Assessment centre group exercise brief.",
  "Technical interview for your stream.",
];

export const PLACEMENT_RUBRIC: string[] = [
  "Specific, structured (STAR) and owned (\"I\" not \"we\").",
  "A reflection line (STARR or CARL), as the Bank of England and Met Office expect.",
  "For Civil Service behaviours, name the behaviour in your first sentence.",
  "A technical answer names the method and the number.",
  "\"Why a placement\" names a module, project or your final-year plan.",
  "Timed: 90 to 120 seconds, spoken, not read from a script.",
];

/**
 * Employers the research found banning AI during interviews or assessments, beyond lib/employer-policy's curated table
 * (Goldman Sachs, McKinsey, Bain). Interview prep for them is coach-only. Shared with the spring week panel.
 */
export const INTERVIEW_AI_BANS: { employer: string; aliases: string[]; source: string }[] = [
  { employer: "Barclays", aliases: ["barclays"], source: "research/spring-weeks/05-application-content.md §2 (Barclays bans third-party AI tools in interviews)" },
  { employer: "Bank of England", aliases: ["bank of england"], source: "research/placement-year/05-application-content.md §4c (no AI during interviews or group exercises)" },
];

const STREAM_WORDS: [Stream, RegExp][] = [
  ["audit_tax", /\b(audit|assurance|tax|accountan\w*|aca\b)/i],
  ["pharma_chemistry", /\b(pharma\w*|chemis\w*|biolog\w*|clinical|life sciences?|laborator\w*|formulation)/i],
  ["quality_manufacturing", /\b(quality|manufactur\w*|production|supply chain|operations|lean|six sigma)/i],
  ["engineering", /\b(engineer\w*|mechanical|electrical|civil|aerospace|structural|design engineer)/i],
  ["software", /\b(software|developer|programm\w*|computer science|devops|cyber|technology)/i],
  ["data_economics", /\b(data|analytics?|economi\w*|statistic\w*|research|actuar\w*)/i],
  ["finance", /\b(finance|banking|markets?|investment|trading|treasury)/i],
];
const ARCHETYPE_STREAM: Partial<Record<string, Stream>> = {
  software_eng: "software", data_analytics: "data_economics", research: "data_economics", quant_trading: "finance",
  finance_banking: "finance", product: "software",
};

/** The placement stream for a job: from its title first, then its archetype, then its text. */
export function streamFor(job: { title: string; archetype: Archetype | string | null; textLines?: string[] }): Stream | null {
  for (const [s, re] of STREAM_WORDS) if (re.test(job.title)) return s;
  const fromArchetype = job.archetype ? ARCHETYPE_STREAM[job.archetype] : undefined;
  if (fromArchetype) return fromArchetype;
  const text = (job.textLines ?? []).slice(0, 40).join("\n");
  for (const [s, re] of STREAM_WORDS) if (re.test(text)) return s;
  return null;
}

export type TrackBank = {
  track: "placement";
  stream: Stream | null;
  presets: string[];
  questions: BankQuestion[];
  rubric: string[];
  /** Always shown: practice before the interview, never during it. */
  practiceNotice: string;
  /** The employer bans AI in interviews or assessments: the pack is for practice and coaching only. */
  coachOnly: boolean;
};

/** Whether the employer bans AI during interviews or assessments (curated policy, the advert, or the research list). */
export function bansAiInInterviews(company: string, jdText: string): boolean {
  const p = employerAiPolicy({ company, jdText });
  if (p.entry?.assessments === "not_permitted" || p.policy === "banned_in_assessments" || p.policy === "not_permitted") return true;
  const c = company.toLowerCase().trim();
  return INTERVIEW_AI_BANS.some((b) => b.aliases.some((a) => c === a || c.startsWith(`${a} `) || c.includes(` ${a}`)));
}

/** The coach-only notice for an employer that bans AI in interviews and assessments. */
export const coachOnlyNotice = (company: string) =>
  `${company} doesn't allow AI tools during its interviews and assessments. Use this to practise beforehand only, in your own words, and never have Placed or any AI open during the real video interview, test or assessment centre.`;

/**
 * The curated bank for a placement job, with [firm] filled in and technicals filtered to the job's stream (all streams
 * when it is unknown). Null for every other track.
 */
export function trackBank(i: { track: Track; company: string; title: string; archetype: Archetype | string | null; jdText?: string }): TrackBank | null {
  if (i.track !== "placement") return null;
  const stream = streamFor({ title: i.title, archetype: i.archetype, textLines: i.jdText?.split("\n") });
  const questions = PLACEMENT_BANK
    .filter((q) => !q.stream || !stream || q.stream === stream)
    .map((q) => ({ ...q, question: q.question.replaceAll("[firm]", i.company) }));
  const coachOnly = bansAiInInterviews(i.company, i.jdText ?? "");
  const practiceNotice = coachOnly ? coachOnlyNotice(i.company)
    : "Practice only: rehearse these out loud before the interview. Never use Placed or any AI during a real video interview, test or assessment centre.";
  return { track: "placement", stream, presets: PLACEMENT_PRESETS, questions, rubric: PLACEMENT_RUBRIC, practiceNotice, coachOnly };
}

/** A line for the AI pack's structure prompt so its questions suit a placement. Null otherwise (spring weeks never get an AI pack). */
export function trackPrepNote(track: Track): string | null {
  if (track === "placement") return "PROGRAMME: a 9-13 month industrial placement for second-year students who return to university afterwards. Include why-a-placement questions and the employer's competency framework; technical questions should match the stream.";
  return null;
}
