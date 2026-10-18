/**
 * Employer AI policy (audit 2026-10-18: 02 #1, 05 #13, 09 #1). Some employers limit how candidates may use AI on a CV
 * or application: Bain London allows it only for spelling and grammar, Anthropic asks for your own first draft. Placed
 * checks this before any AI rewrite (CV tailoring and cover letters) and says so before it writes anything.
 *
 * Two sources, most restrictive wins:
 * 1. A curated table. Every entry quotes its source and records the URL and the date it was read. `verified: "primary"`
 *    means the quote was read on the employer's own page; "reported" means a named outlet reported it because the
 *    employer's page could not be fetched. Re-check entries every September (start of the UK recruiting cycle).
 * 2. A detector for the job advert's own wording ("AI tools are not permitted", "must not use generative AI", "create
 *    your first draft yourself").
 *
 * Pure: no I/O. `aiPolicyLine` is the short student-facing line other features (CV rule FCQ-12) can reuse.
 */

/**
 * - allowed: AI help is fine on the CV/application (still never invent facts).
 * - banned_in_assessments: fine on the CV/application; not in online tests, video or live interviews.
 * - draft_yourself_first: write it yourself first, then AI may refine it.
 * - grammar_only: AI only to check spelling and grammar.
 * - not_permitted: the advert says not to use AI for the application at all (from the advert only, never curated).
 */
export type AiPolicy = "allowed" | "banned_in_assessments" | "draft_yourself_first" | "grammar_only" | "not_permitted";

export type EmployerPolicyEntry = {
  employer: string;
  /** Lowercase names that identify the employer in a job's company field. */
  aliases: string[];
  /** Offices the entry is about, when the source is office-specific (Bain's FAQ is the London office's). */
  scope?: string;
  policy: AiPolicy;
  /** What the policy says about assessments and interviews, when the source says it. */
  assessments?: "not_permitted" | "not_permitted_unless_told";
  quote: string;
  url: string;
  accessed: string;
  verified: "primary" | "reported";
};

export const EMPLOYER_AI_POLICIES: EmployerPolicyEntry[] = [
  {
    employer: "Bain & Company", aliases: ["bain", "bain & company", "bain and company", "bain & co"], scope: "London office",
    policy: "grammar_only", assessments: "not_permitted",
    quote: "We'd ask that you only use AI, such as Chat GPT or Claude, to check grammar and spelling in your CV.",
    url: "https://www.bain.com/careers/recruiting/london-recruiting/", accessed: "2026-10-18", verified: "primary",
  },
  {
    employer: "Anthropic", aliases: ["anthropic"],
    policy: "draft_yourself_first", assessments: "not_permitted_unless_told",
    quote: "Please create your first draft yourself, then use Claude to refine it.",
    url: "https://www.anthropic.com/candidate-ai-guidance", accessed: "2026-10-18", verified: "primary",
  },
  {
    employer: "Boston Consulting Group", aliases: ["bcg", "boston consulting group", "the boston consulting group"],
    policy: "allowed",
    quote: "We encourage you to use it as a tool to assist with your application, but not as a substitute for your personal insights, voice, or experiences.",
    url: "https://careers.bcg.com/global/en/careers-in-ai/using-ai-application-process", accessed: "2026-10-18", verified: "primary",
  },
  {
    employer: "McKinsey & Company", aliases: ["mckinsey", "mckinsey & company", "mckinsey and company"],
    policy: "banned_in_assessments", assessments: "not_permitted",
    quote: "Candidates may use AI to refine résumés and practise interview questions; using it during assessments, to generate interview answers, or to embellish is not permitted (Fortune's summary of McKinsey's careers page).",
    url: "https://fortune.com/2026/01/14/how-to-get-hired-at-mckinsey-ai-tools-liberal-arts-creativity", accessed: "2026-10-18", verified: "reported",
  },
  {
    employer: "Goldman Sachs", aliases: ["goldman sachs", "goldman", "goldman sachs group", "gs"],
    policy: "banned_in_assessments", assessments: "not_permitted",
    quote: "Goldman Sachs prohibits the use of any external sources, including ChatGPT or Google search engine, during the interview process (campus recruiting email, confirmed for all campus applicants by a Goldman spokesperson).",
    url: "https://fortune.com/2025/06/11/goldman-sachs-students-ai-chatgpt-interviews-amazon-anthropic", accessed: "2026-10-18", verified: "reported",
  },
];

// ---------------------------------------------------------------- advert detector

/** Advert phrasings, most restrictive first. Real wordings from the 09 audit's tests plus Anthropic's and Bain's. */
const JD_PATTERNS: [AiPolicy, RegExp][] = [
  ["grammar_only", /\b(?:only|solely)\s+(?:use\s+)?(?:AI|generative AI|ChatGPT|AI tools?)(?:,?\s+such as [^.]{0,40})?\s+(?:to|for)\s+(?:check(?:ing)?\s+)?(?:spelling|grammar|proofread)|\b(?:AI|generative AI)\s+(?:for|to check)\s+(?:spelling and grammar|grammar and spelling)\s+only\b|\bspelling and grammar only\b/i],
  ["not_permitted", new RegExp([
    String.raw`\b(?:must|should|may)\s+not\s+use\s+(?:any\s+)?(?:generative\s+)?(?:AI|ChatGPT|LLMs?|large language models?)\b`,
    String.raw`\b(?:do\s+not|don't|please\s+don't|please\s+do\s+not)\s+use\s+(?:any\s+)?(?:AI|generative\s+AI|ChatGPT|AI\s+assistants?|AI\s+tools?)\b`,
    String.raw`\b(?:use\s+of\s+)?(?:generative\s+)?AI(?:\s+tools?)?\s+(?:is|are)\s+(?:not\s+permitted|prohibited|not\s+allowed|forbidden|banned)\b`,
    String.raw`\b(?:use\s+of\s+)?(?:generative\s+)?AI(?:\s+tools?)?\s+(?:is|are)\s+strictly\s+(?:prohibited|forbidden)\b`,
    String.raw`\bnot\s+use\s+AI\s+(?:assistants?|tools?)\b`,
    String.raw`\bwithout\s+(?:the\s+)?(?:help|assistance|use)\s+of\s+(?:generative\s+)?AI\b`,
    String.raw`\bAI[- ]generated\s+[^.]{0,40}(?:not\s+(?:be\s+)?(?:permitted|accepted|allowed|considered)|prohibited|rejected)`,
    String.raw`\b(?:we|will)\s+(?:do\s+not|don't|not)\s+accept\s+(?:applications?|answers?|responses?)\s+(?:generated|written)\s+(?:by|using|with)\s+AI\b`,
  ].join("|"), "i")],
  ["draft_yourself_first", /\b(?:create|write)\s+your\s+(?:own\s+)?(?:first|initial)\s+draft\s+yourself\b|\b(?:first|initial)\s+draft\s+yourself\b|\bdraft\s+(?:it|your\s+answers?)\s+yourself\s+first\b/i],
  ["banned_in_assessments", /\b(?:AI|ChatGPT|external (?:sources|tools))\b[^.]{0,60}\b(?:not\s+(?:be\s+)?(?:permitted|allowed)|prohibited)\b[^.]{0,40}\b(?:assessments?|tests?|interviews?|video)\b|\b(?:during|in|for)\s+(?:the\s+|any\s+|all\s+)?(?:online\s+|virtual\s+|video\s+)?(?:assessments?|tests?|interviews?)\b[^.]{0,40}\b(?:AI|ChatGPT)\b[^.]{0,30}\b(?:not\s+(?:be\s+)?(?:permitted|allowed)|prohibited)\b/i],
];

/** The advert's own AI-policy wording, if it has any: the strictest phrasing found and the words that matched. */
export function detectJdAiPolicy(jdText: string): { policy: AiPolicy; matched: string } | null {
  // Assessment-only bans are checked before the general ban, so "AI is not permitted during interviews" isn't read as a full ban.
  const assessment = JD_PATTERNS.find(([p]) => p === "banned_in_assessments")![1].exec(jdText);
  for (const [policy, re] of JD_PATTERNS) {
    if (policy === "banned_in_assessments") continue;
    const m = re.exec(jdText);
    if (!m) continue;
    if (policy === "not_permitted" && assessment && assessment.index <= m.index + m[0].length && m.index <= assessment.index + assessment[0].length) break;
    return { policy, matched: m[0] };
  }
  return assessment ? { policy: "banned_in_assessments", matched: assessment[0] } : null;
}

// ---------------------------------------------------------------- lookup

const normCompany = (s: string) => s.toLowerCase().replace(/[.,]/g, "").replace(/\b(?:plc|ltd|llc|inc|llp|limited|group|holdings|the|uk|london|emea|international)\b/g, " ").replace(/\s+/g, " ").trim();

/** The curated entry for a company name ("Bain & Company London", "JPMorgan Chase & Co."), or null. */
export function findEmployerPolicy(company: string): EmployerPolicyEntry | null {
  const c = normCompany(company);
  if (!c) return null;
  return EMPLOYER_AI_POLICIES.find((e) => e.aliases.some((a) => {
    const n = normCompany(a);
    return c === n || new RegExp(`(?:^| )${n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?: |$)`).test(c);
  })) ?? null;
}

const RANK: Record<AiPolicy, number> = { allowed: 0, banned_in_assessments: 1, draft_yourself_first: 2, grammar_only: 3, not_permitted: 4 };

export type AiPolicyResult = {
  policy: AiPolicy | null;
  source: "curated" | "advert" | null;
  entry: EmployerPolicyEntry | null;
  /** The advert's words, when the advert set the policy. */
  matched: string | null;
  /** Shown before any AI rewrite; null when nothing limits AI writing help. */
  notice: string | null;
  /** How CV tailoring may run: a full tailor, spelling and grammar only, or (advert ban) not at all. */
  tailorMode: "full" | "grammar_only" | "none";
  /** How the cover-letter writer may run. */
  letterMode: "full" | "draft_first" | "proofread_only" | "feedback_only";
};

/** The employer's AI policy for one job: curated table first, the advert's wording second; the strictest applies. */
export function employerAiPolicy(i: { company: string; jdText: string }): AiPolicyResult {
  const entry = findEmployerPolicy(i.company);
  const jd = detectJdAiPolicy(i.jdText);
  const fromEntry = entry?.policy ?? null;
  const useJd = jd && (fromEntry === null || RANK[jd.policy] > RANK[fromEntry]);
  const policy = useJd ? jd.policy : fromEntry;
  const source = useJd ? "advert" : entry ? "curated" : null;
  const who = entry?.employer ?? i.company;
  const where = entry?.scope ? ` (${entry.scope})` : "";
  const cite = useJd ? "The job advert says" : entry?.verified === "reported" ? `${who}${where} reportedly asks` : `${who}${where} asks`;
  let notice: string | null = null;
  if (policy === "grammar_only") notice = `${cite} applicants to use AI only to check spelling and grammar. So Placed will only fix spelling and grammar here: no rewording, reordering or new wording.`;
  else if (policy === "draft_yourself_first") notice = `${cite} applicants to write their own first draft, then use AI to refine it. Placed will only polish wording you have written; it won't write new content for you.`;
  else if (policy === "not_permitted") notice = `${cite} not to use AI for this application ("${jd!.matched}"). Placed won't rewrite anything here; you can still check your own text against the rules.`;
  else if (policy === "banned_in_assessments") notice = `${cite} candidates not to use AI in online tests or interviews. Help with your CV and written answers is fine, but practise answering on your own.`;
  const tailorMode = policy === "not_permitted" ? "none" : policy === "grammar_only" ? "grammar_only" : "full";
  const letterMode = policy === "not_permitted" ? "feedback_only" : policy === "grammar_only" ? "proofread_only" : policy === "draft_yourself_first" ? "draft_first" : "full";
  return { policy, source, entry, matched: useJd ? jd.matched : null, notice, tailorMode, letterMode };
}

/** True when the student should see the notice and agree before an AI rewrite runs. */
export const needsAiPolicyAck = (r: AiPolicyResult) => r.policy !== null && r.policy !== "allowed" && r.policy !== "banned_in_assessments";

/**
 * One short line for other features to show (e.g. CV rule FCQ-12, which today tells everyone "AI can help you polish").
 * Null when nothing is known, so the caller keeps its general copy.
 */
export function aiPolicyLine(company: string, jdText = ""): string | null {
  const r = employerAiPolicy({ company, jdText });
  if (!r.policy) return null;
  if (r.policy === "allowed") return `${r.entry?.employer ?? company} allows AI help with applications, as long as everything stays true and in your own voice.`;
  return r.notice;
}
