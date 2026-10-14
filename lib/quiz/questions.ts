import { ARCHETYPES, type Archetype, type ArchetypeScore } from "@/lib/types";

/**
 * The 1-minute interests quiz (spec §9 step 3). Pure data + deterministic scoring, safe to import from
 * client components. The deterministic ranking is the source of truth; the AI only rewrites "why" lines.
 */
export type QuizOption = { id: string; label: string; weights: Partial<Record<Archetype, number>> };
export type QuizQuestion = { id: string; prompt: string; options: QuizOption[] };

export const QUESTIONS: QuizQuestion[] = [
  { id: "fun", prompt: "Which sounds most fun?", options: [
    { id: "build", label: "Building an app people use", weights: { software_eng: 3, product: 1 } },
    { id: "patterns", label: "Finding patterns in messy data", weights: { data_analytics: 3, research: 1 } },
    { id: "puzzles", label: "Solving puzzles against the clock", weights: { quant_trading: 3, software_eng: 1 } },
    { id: "business", label: "Cracking a company's big problem", weights: { consulting: 3, finance_banking: 1 } },
    { id: "markets", label: "Following the markets", weights: { finance_banking: 3, quant_trading: 1 } },
    { id: "audience", label: "Growing an audience", weights: { marketing_growth: 3, product: 1 } },
  ] },
  { id: "tuesday", prompt: "Your ideal Tuesday at work", options: [
    { id: "flow", label: "Deep in code, headphones on", weights: { software_eng: 3 } },
    { id: "dash", label: "Spreadsheets turning into a dashboard", weights: { data_analytics: 2, finance_banking: 2 } },
    { id: "floor", label: "A fast-paced trading floor", weights: { quant_trading: 2, finance_banking: 2 } },
    { id: "client", label: "Running a client workshop", weights: { consulting: 3 } },
    { id: "users", label: "Talking to users about what they need", weights: { product: 2, marketing_growth: 2 } },
    { id: "lab", label: "Reading papers and running experiments", weights: { research: 3 } },
  ] },
  { id: "power", prompt: "Pick a superpower", options: [
    { id: "logic", label: "Flawless logic", weights: { software_eng: 2, quant_trading: 2 } },
    { id: "story", label: "Storytelling", weights: { marketing_growth: 2, consulting: 2 } },
    { id: "numbers", label: "Instant maths", weights: { data_analytics: 2, finance_banking: 2, quant_trading: 1 } },
    { id: "empathy", label: "Reading people", weights: { product: 2, marketing_growth: 1 } },
    { id: "curiosity", label: "Endless curiosity", weights: { research: 2, data_analytics: 2 } },
    { id: "persuasion", label: "Persuasion", weights: { consulting: 2, finance_banking: 2 } },
  ] },
  { id: "group", prompt: "In a group project you're usually the…", options: [
    { id: "builder", label: "Builder", weights: { software_eng: 3 } },
    { id: "analyst", label: "Analyst", weights: { data_analytics: 3 } },
    { id: "planner", label: "Planner", weights: { product: 2, consulting: 2 } },
    { id: "presenter", label: "Presenter", weights: { consulting: 2, marketing_growth: 2 } },
    { id: "researcher", label: "Researcher", weights: { research: 3 } },
    { id: "treasurer", label: "Money person", weights: { finance_banking: 3 } },
  ] },
  { id: "module", prompt: "Which module would you pick?", options: [
    { id: "algo", label: "Algorithms", weights: { software_eng: 2, quant_trading: 2 } },
    { id: "stats", label: "Statistics", weights: { data_analytics: 2, research: 2 } },
    { id: "corpfin", label: "Corporate finance", weights: { finance_banking: 3 } },
    { id: "mkt", label: "Marketing strategy", weights: { marketing_growth: 3 } },
    { id: "game", label: "Game theory", weights: { quant_trading: 2, consulting: 2 } },
    { id: "design", label: "Design thinking", weights: { product: 3 } },
  ] },
  { id: "matters", prompt: "What matters most in your first internship?", options: [
    { id: "ship", label: "Shipping real code", weights: { software_eng: 3 } },
    { id: "tools", label: "Learning tools like SQL and Python", weights: { data_analytics: 3 } },
    { id: "prestige", label: "Prestige and pay", weights: { finance_banking: 2, quant_trading: 2 } },
    { id: "variety", label: "A variety of problems", weights: { consulting: 3 } },
    { id: "own", label: "Owning a feature end to end", weights: { product: 3 } },
    { id: "creative", label: "Creative freedom", weights: { marketing_growth: 3 } },
    { id: "depth", label: "Going deep on one topic", weights: { research: 3 } },
  ] },
];

/** Top 3 archetypes (fewer if fewer scored), scores 0–100 relative to the leader. 0-score archetypes are never returned. */
export function scoreQuiz(answers: Record<string, string>): ArchetypeScore[] {
  const totals = Object.fromEntries(ARCHETYPES.map((a) => [a, 0])) as Record<Archetype, number>;
  const reasons = Object.fromEntries(ARCHETYPES.map((a) => [a, [] as { w: number; text: string }[]])) as Record<Archetype, { w: number; text: string }[]>;
  for (const q of QUESTIONS) {
    const o = q.options.find((x) => x.id === answers[q.id]);
    if (!o) continue;
    for (const [k, w] of Object.entries(o.weights) as [Archetype, number][]) {
      if (!w) continue;
      totals[k] += w;
      reasons[k].push({ w, text: `You picked “${o.label}”` });
    }
  }
  const max = Math.max(...Object.values(totals));
  if (max <= 0) return [];
  return ARCHETYPES
    .map((key) => ({
      key,
      score: Math.round((totals[key] / max) * 100),
      // Strongest signals first (stable sort keeps question order within a weight).
      why: [...reasons[key]].sort((a, b) => b.w - a.w).slice(0, 2).map((r) => r.text),
    }))
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}
