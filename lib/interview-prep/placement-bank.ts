/**
 * Placement-year interview prep: a fixed 40-question bank (technicals by stream), format presets and the framing, in
 * the same shape as the spring bank (spring-bank.ts) so the video practice, STAR story matching and bank list are
 * shared. Deterministic: works with AI off. Shown alongside the web-researched pack, which adds what candidates
 * reported for this employer. Source: research/placement-year/05-application-content.md §4e. Reports are [R]/[U].
 */
import type { Archetype } from "@/lib/types";
import type { PrepQuestion, StoryTheme, VideoPreset } from "./spring-bank";

export type PlacementGroup = "motivation" | "competency" | "strengths" | "scenario" | "technical" | "curveball";
export type Stream = "software" | "data_economics" | "engineering" | "quality_manufacturing" | "pharma_chemistry" | "audit_tax" | "finance";

export type PlacementQuestionDef = {
  id: number;
  group: PlacementGroup;
  /** Placeholders: {firm}. */
  text: string;
  whyTheyAsk: string;
  prepTip: string;
  theme?: StoryTheme;
  /** Technical questions only: the stream it belongs to. */
  stream?: Stream;
};

export const PLACEMENT_GROUPS: { key: PlacementGroup; label: string }[] = [
  { key: "motivation", label: "Motivation" },
  { key: "competency", label: "Competency" },
  { key: "strengths", label: "Strengths" },
  { key: "scenario", label: "Scenario" },
  { key: "technical", label: "Technical" },
  { key: "curveball", label: "Close" },
];

const STAR = "STAR with a reflection line (STARR / CARL): Situation and Task in one sentence, most of the time on what you did, a result, then what you learned.";

export const PLACEMENT_QUESTIONS: PlacementQuestionDef[] = [
  // Motivation, placement-specific first
  { id: 1, group: "motivation", text: "Why do you want to do a placement year?",
    whyTheyAsk: "Asked almost everywhere (GSK, KCL guidance): they want a reason tied to your degree, not \"experience\".",
    prepTip: "One reason tied to your course (a module you want to apply), one about testing a career choice, one about what you'll be able to do afterwards." },
  { id: 2, group: "motivation", text: "Why a 12-month placement rather than a summer internship?",
    whyTheyAsk: "A year costs them training time: they want someone who'll use the whole of it.",
    prepTip: "Owning a piece of work end to end, seeing a full cycle (a release, an audit season, a shutdown), getting past the learning curve. Never \"a long internship\"." },
  { id: 3, group: "motivation", text: "What do you want to gain from this placement, and how does it fit your long-term goals?",
    whyTheyAsk: "Checks the placement fits a realistic plan.",
    prepTip: "Name two specific skills or a qualification step, and one realistic path after graduating." },
  { id: 4, group: "motivation", text: "What will you bring back to your final year?",
    whyTheyAsk: "Universities and employers both value the link back to study.",
    prepTip: "Name the final-year module, project or dissertation the placement feeds, plus one professional habit." },
  { id: 5, group: "motivation", text: "Why {firm}? Why this site or location?",
    whyTheyAsk: "A generic answer that fits any employer is the most common miss (GSK, TARGETjobs).",
    prepTip: "Two or three things only true of {firm}: a product or site, something about the scheme, a person or event. If a rival's name fits, it's too generic." },
  { id: 6, group: "motivation", text: "Why this stream or function, and not the one next to it?",
    whyTheyAsk: "They want a realistic choice from someone who knows what the team does day to day.",
    prepTip: "One line on what the team does, the module or project that drew you, and one fair line on why the adjacent stream fits you less." },
  { id: 7, group: "motivation", text: "What do you think a placement student does here day to day?",
    whyTheyAsk: "Tests research and realistic expectations.",
    prepTip: "Use the advert and anything a current or past placement student told you. Say which part you're most looking forward to." },
  { id: 8, group: "motivation", text: "Would you see yourself joining us after you graduate?",
    whyTheyAsk: "Many schemes are a graduate pipeline (J.P. Morgan: top performers may get graduate offers).",
    prepTip: "Be honest and positive: say what would make you want to come back, without over-promising." },
  { id: 9, group: "motivation", text: "What is one current issue facing this industry, or a problem {firm} faces?",
    whyTheyAsk: "Commercial awareness at placement level (Nissan, MBDA reports).",
    prepTip: "Pick one issue you've read about, say how it affects {firm}, and what you'd want to learn about it on placement." },

  // Competency (STARR / CARL)
  { id: 10, group: "competency", theme: "team", text: "Tell me about a time you worked well in a team with different skills, such as a group project.",
    whyTheyAsk: "Placements are team work from day one (Met Office criterion).", prepTip: `${STAR} Say "I" for your part.` },
  { id: 11, group: "competency", theme: "challenge", text: "Tell me about a time you solved a technical problem by finding its root cause.",
    whyTheyAsk: "Problem-solving is the core placement competency (Met Office).", prepTip: "Name the symptom, how you narrowed it down, the actual cause and the fix, with a number if you have one." },
  { id: 12, group: "competency", theme: "pressure", text: "Tell me about a time you planned your own work and then had to adapt to a change.",
    whyTheyAsk: "You'll manage your own tasks for a year (Met Office).", prepTip: "Show the plan, what changed, how you re-prioritised, and that it still landed." },
  { id: 13, group: "competency", theme: "influence", text: "Explain something technical to someone without a technical background.",
    whyTheyAsk: "Communicating technical work is assessed directly (Met Office, Bank of England).", prepTip: "Pick something from your course, use one analogy, check understanding. Practise it out loud in under 90 seconds." },
  { id: 14, group: "competency", theme: "challenge", text: "Tell me about a time you showed resilience.",
    whyTheyAsk: "Reported at GSK.", prepTip: `${STAR}` },
  { id: 15, group: "competency", theme: "failure", text: "Tell me about a time you took the lead, or a time you failed.",
    whyTheyAsk: "Reported at PwC: honesty and learning matter more than a perfect record.", prepTip: "For a failure, own it in one sentence and spend most of the answer on what you changed." },
  { id: 16, group: "competency", theme: "achievement", text: "What is your proudest achievement, or a project you managed?",
    whyTheyAsk: "Reported via TARGETjobs (Ten10).", prepTip: "Something with a clear bar you cleared or a number, and why it mattered to you." },
  { id: 17, group: "competency", theme: "learn", text: "Tell me about a time you improved how something was done.",
    whyTheyAsk: "Civil Service behaviour: Changing and Improving.", prepTip: "Name the behaviour in your first sentence for Civil Service interviews. Before, your change, after, with a number." },
  { id: 18, group: "competency", theme: "data", text: "Tell me about a time you made a decision with incomplete information.",
    whyTheyAsk: "Civil Service behaviour: Making Effective Decisions.", prepTip: "What you knew, what you didn't, how you weighed it, and how you checked afterwards." },
  { id: 19, group: "competency", theme: "pressure", text: "Tell me about a time you delivered to a tight deadline.",
    whyTheyAsk: "Civil Service behaviour: Delivering at Pace.", prepTip: "Show your system: how you prioritised, what you dropped, and that it arrived on time." },
  { id: 20, group: "competency", theme: "conflict", text: "Tell me about a time you worked with someone very different from you, or acted inclusively.",
    whyTheyAsk: "Bank of England behaviour: act inclusively.", prepTip: "Describe the difference fairly, what you did to include them, and what the team gained." },

  // Strengths
  { id: 21, group: "strengths", text: "What activities give you an energy buzz?",
    whyTheyAsk: "Strengths interviews (EY, Mott MacDonald, Civil Service) look for what energises you.", prepTip: "Answer quickly and honestly with a real example. There's no right answer." },
  { id: 22, group: "strengths", text: "What do you find quick to learn?",
    whyTheyAsk: "Strengths interviews test natural aptitude.", prepTip: "One thing, one example of learning it fast." },
  { id: 23, group: "strengths", text: "Are you a starter or a finisher?",
    whyTheyAsk: "Shows self-awareness about how you work.", prepTip: "Pick one, give an example, and say how you cover the other side." },
  { id: 24, group: "strengths", text: "How do you judge success?",
    whyTheyAsk: "Reported via TARGETjobs.", prepTip: "A personal measure with an example, not a generic one." },
  { id: 25, group: "strengths", text: "Do you find deadlines motivating?",
    whyTheyAsk: "Strengths interviews read the instinctive answer.", prepTip: "Be honest, then give an example of how you work with deadlines either way." },
  { id: 26, group: "strengths", text: "What do you do when you're curious about something?",
    whyTheyAsk: "Curiosity is a named strength in some frameworks (EY, reported).", prepTip: "A real example: what sparked it, what you read or built, what you found." },
  { id: 27, group: "strengths", theme: "learn", text: "Tell me about something you've taught yourself recently.",
    whyTheyAsk: "Learning agility (EY, reported).", prepTip: "How you learned it, how fast, and what you made with it." },

  // Scenario
  { id: 28, group: "scenario", text: "A project falls behind schedule and it's your fault. What do you do?",
    whyTheyAsk: "Reported via TARGETjobs (Ten10): ownership under pressure.", prepTip: "Tell your manager early, propose a recovery plan, say what you'd change next time." },
  { id: 29, group: "scenario", text: "How do you cope with a strict deadline when there isn't time to make everything perfect?",
    whyTheyAsk: "Reported at Alstom.", prepTip: "Agree what matters most, deliver that well, and flag what's left." },
  { id: 30, group: "scenario", text: "You spot an error in a senior colleague's work the day before it goes to a client or regulator. What do you do?",
    whyTheyAsk: "Integrity and judgement (Big 4 and Bank of England style).", prepTip: "Check you're right, raise it privately and quickly with evidence, and offer to help fix it." },

  // Technical, by stream (opt-in; employers vary)
  { id: 31, group: "technical", stream: "software", text: "Walk me through a project's architecture and one trade-off you made.",
    whyTheyAsk: "Bank tech and software placements (J.P. Morgan, IBM, BofA, reported).", prepTip: "Expect OOP and data-structure basics, a SQL join and the complexity of your solution. Have one project you can draw from memory." },
  { id: 32, group: "technical", stream: "data_economics", text: "Explain a regression you ran and how you checked it.",
    whyTheyAsk: "Bank of England data and economics streams; GES asks micro and macro.", prepTip: "State the question, the model, one diagnostic you checked and what you'd change. Expect an Excel task." },
  { id: 33, group: "technical", stream: "engineering", text: "Explain your design project's specification, constraints and test results.",
    whyTheyAsk: "Engineering placements (JLR and others, reported).", prepTip: "Expect material selection, tolerances or failure modes, and FMEA or root-cause tools. Know your numbers." },
  { id: 34, group: "technical", stream: "quality_manufacturing", text: "What is a non-conformance, and how would you reduce defects on a line?",
    whyTheyAsk: "Quality and manufacturing placements (reported).", prepTip: "Know 5 Whys and 8D well enough to walk through an example." },
  { id: 35, group: "technical", stream: "pharma_chemistry", text: "Walk me through a reaction or technique you've run, and its safety controls.",
    whyTheyAsk: "Pharma and chemistry placements (Glassdoor reports).", prepTip: "Expect mechanism questions and interpreting a spectrum. Lead with safety." },
  { id: 36, group: "technical", stream: "audit_tax", text: "What does an auditor do, and why does it matter?",
    whyTheyAsk: "Big 4 audit and tax placements (reported).", prepTip: "Know audit vs tax vs advisory, a recent business story's impact on a client, and what the ACA is." },
  { id: 37, group: "technical", stream: "finance", text: "Talk me through the three financial statements, and a market story you follow.",
    whyTheyAsk: "Bank industrial placements.", prepTip: "How the statements link, then one story with your own view." },

  // Close
  { id: 38, group: "curveball", text: "Tell me about yourself, or walk me through your CV.",
    whyTheyAsk: "Usually the opener.", prepTip: "60 to 90 seconds: course and why, two things you've done, and how they led you to apply." },
  { id: 39, group: "curveball", text: "What would your group-project teammates say about you?",
    whyTheyAsk: "A quick self-awareness check.", prepTip: "Two honest things with a short example each." },
  { id: 40, group: "curveball", text: "What questions do you have for us?",
    whyTheyAsk: "Always asked: it shows interest.", prepTip: "Ask about training, progression and what past placement students went on to do, beyond your immediate team." },
];

/** Placement video interviews: the Bank of England style allows no re-record; timings vary by employer. */
export const PLACEMENT_PRESET: VideoPreset = {
  questions: 5, prepSeconds: 30, answerSeconds: 120, reported: [],
  note: "Placement video interviews are usually 4 to 6 questions with about 30 seconds to prepare and 2 minutes to answer; some (Bank of England style) allow no re-record.",
};

export const PLACEMENT_FRAMING = {
  lead: "Placement interviews test why a year in industry, why this employer and stream, and your competencies, with a technical round for most STEM streams.",
  process: [
    { stage: "Form, CV and short answers", note: "Often 0 to 3 motivation or competency boxes (Civil Service: about 250 words each)." },
    { stage: "Online tests", note: "Numerical, verbal or situational judgement, sometimes a coding test." },
    { stage: "Video or phone interview", note: "Competency and motivation questions, or a strengths interview (EY, Mott MacDonald)." },
    { stage: "Assessment centre or final interview", note: "A group exercise, a technical interview for your stream, and a final interview." },
  ],
  formats: [
    "Video interview with no re-record (Bank of England style).",
    "Civil Service behaviour interview: STAR answers plus a strengths question.",
    "Rapid strengths interview (EY, Mott MacDonald): short, instinctive answers.",
    "Assessment centre group exercise.",
    "Technical interview for your stream.",
  ],
  tips: [
    "Add a reflection to every STAR answer (STARR / CARL): the Bank of England and the Met Office look for it.",
    "For Civil Service behaviours, name the behaviour in your first sentence.",
    "A technical answer names the method and the number.",
    "\"Why a placement\" names a module, project or your final-year plan.",
    "Practise out loud with a timer, using bullet cues, not a script.",
  ],
} as const;

const STREAM_WORDS: [Stream, RegExp][] = [
  ["audit_tax", /\b(audit|assurance|tax|accountan\w*|aca\b)/i],
  ["pharma_chemistry", /\b(pharma\w*|chemis\w*|biolog\w*|clinical|life sciences?|laborator\w*|formulation)/i],
  ["quality_manufacturing", /\b(quality|manufactur\w*|production|supply chain|operations|lean|six sigma)/i],
  ["engineering", /\b(engineer\w*|mechanical|electrical|civil|aerospace|structural)/i],
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

export type PlacementContext = { firm: string; stream: Stream | null; preset: VideoPreset };

export function placementContext(job: { company: string; title: string; archetype: Archetype | string | null; textLines?: string[] }): PlacementContext {
  return { firm: job.company.trim() || "this employer", stream: streamFor(job), preset: PLACEMENT_PRESET };
}

/** The bank for this job: [firm] filled in; technicals filtered to the job's stream (all of them when it's unknown). */
export function placementQuestions(c: PlacementContext): PrepQuestion[] {
  return PLACEMENT_QUESTIONS
    .filter((q) => !q.stream || !c.stream || q.stream === c.stream)
    .map((q) => ({
      id: q.id, group: q.group, theme: q.theme,
      text: q.text.replace(/\{firm\}/g, c.firm), whyTheyAsk: q.whyTheyAsk.replace(/\{firm\}/g, c.firm), prepTip: q.prepTip.replace(/\{firm\}/g, c.firm),
    }));
}

// A practice run mixes why-a-placement, why-us and competencies, like the real thing.
const CORE_ORDER = [1, 5, 10, 2, 11, 6, 13, 4, 15, 19, 3, 17];

/** One timed practice run; each `seed` pages on through the list, so "practise again" is a different interview. */
export function placementPracticeSet(c: PlacementContext, opts: { seed?: number } = {}): PrepQuestion[] {
  const all = new Map(placementQuestions(c).map((q) => [q.id, q]));
  const take = Math.min(7, Math.max(3, c.preset.questions));
  const start = (Math.abs(opts.seed ?? 0) * take) % CORE_ORDER.length;
  return Array.from({ length: take }, (_, i) => all.get(CORE_ORDER[(start + i) % CORE_ORDER.length])!);
}

/** A line for the AI pack's structure prompt so its questions suit a placement. Null otherwise. */
export function placementPrepNote(employmentType: string): string | null {
  return employmentType === "placement"
    ? "PROGRAMME: a 9-13 month industrial placement for second-year students who return to university afterwards. Include why-a-placement questions and the employer's competency framework; technical questions should match the stream."
    : null;
}
