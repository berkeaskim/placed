/**
 * Motivation answers for spring weeks and placements (spring 05 §6c, placement 05 §4c). Pure, so it is shared by the
 * question flow, the draft prompt and the lint:
 * - firm hooks: at least two things only true of this firm (a dated research fact the student picked, a person or
 *   event they met, a product they used, or a detail they typed). With fewer, the card asks for one more before it
 *   writes, instead of writing filler.
 * - placement slots: why a placement, why a full year, and what the student will bring back to final year.
 * - a deterministic competitor-swap check: a sentence about the firm with nothing in it that is only true of the firm
 *   would read the same with a rival's name in it (the LLM judge runs the fuller version).
 */
import type { Track } from "@/lib/cv-rules/types";
import { namesCompany } from "./employers";
import type { Answer, Fact, LintHit } from "./types";

/** Hooks a spring or placement letter needs before the card drafts the why-them part. */
export const MIN_FIRM_HOOKS = 2;
/** A research fact counts as a hook only if the source dates it within this many months. */
export const HOOK_MAX_AGE_MONTHS = 12;

const PERSON_OR_EVENT = /\b(met|meet|meeting|spoke|speak|talked|chatted|event|webinar|panel|workshop|careers? fair|insight (?:day|week)|open day|networking|coffee chat|speaker|alumn\w*|recruiter|mentor|podcast|article|read)\b/i;

const monthIndex = (ym: string) => { const [y, m] = ym.split("-").map(Number); return y * 12 + (m - 1); };

/** The student's verifiable firm-specific hooks for this letter: dated picked facts plus their own firm touchpoints. */
export function firmHooks(i: { facts: Fact[]; answers: Answer[]; now: Date }): { count: number; sources: string[] } {
  const picked = new Set(i.answers.find((a) => a.question === "facts")?.pickedFactIds ?? []);
  const nowIdx = i.now.getUTCFullYear() * 12 + i.now.getUTCMonth();
  const dated = i.facts.filter((f) => picked.has(f.id) && f.date !== null && nowIdx - monthIndex(f.date) <= HOOK_MAX_AGE_MONTHS);
  const sources = dated.map((f) => `fact:${f.id}`);
  for (const a of i.answers) {
    if (!a.text?.trim()) continue;
    if (a.question === "touchpoint" || a.question === "product" || a.question === "hook") sources.push(`answer:${a.question}`);
    else if (a.question === "why_firm" && PERSON_OR_EVENT.test(a.text)) sources.push("answer:why_firm");
  }
  return { count: sources.length, sources };
}

/** Whether the hook question still has to be asked (or skipped) before a spring/placement draft. */
export function needsHook(track: Track, hooks: number, answers: Answer[]): boolean {
  return track !== "standard" && hooks < MIN_FIRM_HOOKS && !answers.some((a) => a.question === "hook");
}

/** Placement talking-point slots, asked in this order after the firm questions. */
export const PLACEMENT_SLOTS: { id: "why_placement" | "bring_back"; text: string }[] = [
  { id: "why_placement", text: "Why a placement year rather than a summer internship or going straight to final year? A module you want to apply, or a choice you want to test, is enough." },
  { id: "bring_back", text: "What will you bring back to your final year? Name the module, project or dissertation it feeds if you can." },
];

/** Most questions per letter: the standard four, one more for the spring hook, three more for placement slots. */
export function maxQuestions(track: Track): number {
  return track === "placement" ? 7 : track === "spring" ? 5 : 4;
}

// ---------------------------------------------------------------- draft prompt

export const SPRING_LETTER_BLOCK = `SPRING WEEK / INSIGHT MOTIVATION. The student is a first-year applying to a 1-5 day insight programme.
- Structure: a specific personal spark → what they did about it (evidence from <cv> or an <answer>) → why this firm (two or three reasons only true here, from <picked_facts>, the job posting or the student's answers) → why this division or programme → what they want to learn from the week.
- Voice: curious and concrete, never authoritative. Plain sentences, contractions allowed, nothing that sounds like a 30-year-old banker. Never claim deal experience or market expertise.
- Never write "leading global bank", "learn from the best", "fast-paced environment", "passionate about finance", "I have always been fascinated", "unique opportunity" or "leverage my skills".
- Every sentence about the firm must stop being true if a rival's name replaced the firm's. If there is nothing firm-specific to say, write less.`;

export const PLACEMENT_LETTER_BLOCK = `PLACEMENT YEAR MOTIVATION. The student is a second-year applying for a 9-13 month industrial placement and returns to university afterwards.
- Structure: role, stream and where they saw it → why a placement and why this function (a spark tied to their modules or projects) → why this employer (two or three hooks only true here) → what they bring (one project and one competency story from <cv> or an <answer>) → what they will take back to final year → close.
- Use the student's own reasons from the why_placement and bring_back <answer> blocks when given; never invent a module, project, dissertation topic or career plan.
- Why 12 months, if it is asked or there is room: time to own a piece of work end to end and see a full cycle. Never call it "a long internship".
- Never write "gain invaluable experience", "kick-start my career", "bridge the gap", "real-world experience" without saying what, or "put theory into practice" without naming the theory.`;

export function trackLetterBlock(track: Track): string | null {
  return track === "spring" ? SPRING_LETTER_BLOCK : track === "placement" ? PLACEMENT_LETTER_BLOCK : null;
}

// ---------------------------------------------------------------- lint

type Hit = Omit<LintHit, "scope">;
type Lex = { re: RegExp; label: string };

const SPRING_CLICHES: Lex[] = [
  { re: /\bleading global (?:bank|firm|investment bank)\b/gi, label: "Generic: \"leading global bank\" fits every bank" },
  { re: /\blearn from the best\b/gi, label: "Generic: \"learn from the best\"" },
  { re: /\bfast[- ]paced (?:environment|industry|world)\b/gi, label: "Generic: \"fast-paced environment\"" },
  { re: /\bI have always been (?:fascinated|interested|passionate)\b/gi, label: "Generic opener: \"I have always been fascinated\"" },
  { re: /\bleverage my skills\b/gi, label: "Generic: \"leverage my skills\"" },
  { re: /\bunique opportunity\b/gi, label: "Generic: \"unique opportunity\"" },
  { re: /\bI am confident that\b/gi, label: "Sounds older than a first-year: \"I am confident that\"" },
];
const PLACEMENT_CLICHES: Lex[] = [
  { re: /\bgain(?:ing)? invaluable experience\b/gi, label: "Generic: \"gain invaluable experience\"" },
  { re: /\bkick[- ]?start (?:my|your) career\b/gi, label: "Generic: \"kick-start my career\"" },
  { re: /\bbridge the gap\b/gi, label: "Generic: \"bridge the gap\"" },
  { re: /\breal[- ]world experience\b(?=\s*(?:[.,;]|and\b|$))/gi, label: "Say what real-world experience: a task, a product, a site" },
  { re: /\bput(?:ting)? (?:my )?(?:theory|theoretical knowledge|what I have learn(?:ed|t)) into practice\b(?!\s+(?:from|in|of)\s+[A-Z])/gi, label: "Name the theory or module you'd put into practice" },
];

const SENTENCE = /[^.!?\n]+[.!?]?/g;
const STOP = new Set("about after again also because before being between could during every first from have here into just more most other over really should since some such than that their them then there these they this those through under very want were what when where which while will with would your years year team role firm company programme bank work working".split(" "));
const words = (s: string) => s.toLowerCase().match(/[a-z][a-z'-]{4,}/g) ?? [];
/** Capitalised words that say nothing firm-specific even mid-sentence. */
const COMMON_CAPS = /^(?:I|I'm|I've|I'd|UK|British|London|English|Monday|Tuesday|Wednesday|Thursday|Friday|January|February|March|April|May|June|July|August|September|October|November|December|Spring|Insight|Week|Placement|Year|Programme|Graduate|Internship)$/;

/**
 * The firm-specific anchors in a sentence: a number, a picked-fact word, or a proper noun other than the firm's own
 * name, the role or a common capitalised word. A sentence about the firm with none of these is generic.
 */
function hasAnchor(sentence: string, company: string, role: string, factWords: Set<string>): boolean {
  if (/\d/.test(sentence)) return true;
  if (words(sentence).some((w) => factWords.has(w))) return true;
  const own = new Set([...company.split(/\s+/), ...role.split(/\s+/)].map((w) => w.replace(/[^\p{L}&.'-]/gu, "")).filter(Boolean));
  const tokens = sentence.trim().split(/\s+/).map((t) => t.replace(/^[^\p{L}]+|[^\p{L}&.'’-]+$/gu, "")).filter(Boolean);
  return tokens.slice(1).some((t) => /^\p{Lu}/u.test(t) && !own.has(t) && !COMMON_CAPS.test(t));
}

/**
 * Spring/placement lint (CL-80 swap test, CL-81 track clichés, CL-82 a why-placement passage with no module, project or
 * final-year plan). Offsets are into `text`. The standard track gets none of these.
 */
export function trackLintHits(text: string, o: { track: Track; company: string; role: string; rivals: string[]; pickedFacts: Fact[] }): Hit[] {
  if (o.track === "standard") return [];
  const hits: Hit[] = [];
  const lex = o.track === "spring" ? SPRING_CLICHES : PLACEMENT_CLICHES;
  for (const { re, label } of lex) {
    for (const m of text.matchAll(re)) hits.push({ ruleId: "CL-81", label, severity: "high", start: m.index!, end: m.index! + m[0].length });
  }
  const companyWords = new Set(words(o.company));
  const factWords = new Set(o.pickedFacts.flatMap((f) => words(f.claim)).filter((w) => !STOP.has(w) && !companyWords.has(w)));
  const rival = o.rivals.find((r) => r.trim()) ?? "a competitor";
  for (const m of text.matchAll(SENTENCE)) {
    const s = m[0];
    if (!s.trim() || !namesCompany(s, o.company)) continue;
    if (hasAnchor(s, o.company, o.role, factWords)) continue;
    const start = m.index! + (s.length - s.trimStart().length);
    hits.push({ ruleId: "CL-80", label: `Would read the same for ${rival}: add something only true of ${o.company}`, severity: "high", start, end: m.index! + s.trimEnd().length });
  }
  if (o.track === "placement") {
    for (const m of text.matchAll(SENTENCE)) {
      const s = m[0];
      if (!/\bplacement\b/i.test(s) || !/\b(why|because|want|chose|choose|reason|hope)\b/i.test(s)) continue;
      if (/\b(module|project|dissertation|final[- ]year|course|degree|lab|coursework)\b/i.test(s)) continue;
      const start = m.index! + (s.length - s.trimStart().length);
      hits.push({ ruleId: "CL-82", label: "Tie why a placement to a module, project or your final-year plan", severity: "high", start, end: m.index! + s.trimEnd().length });
    }
  }
  return hits;
}
