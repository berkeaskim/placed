import "server-only";
import type { ArchetypeScore } from "@/lib/types";
import { QUESTIONS, scoreQuiz } from "@/lib/quiz/questions";
import { mergeQuizWhy } from "@/lib/quiz/view";
import { canonicalize } from "@/lib/skills/extract";
import { SKILLS } from "@/lib/skills/vocab";
import { generateStructured, runAi } from "./provider";
import { SYSTEM_QUIZ } from "./prompts";
import { QuizOutput, type QuizOutputT } from "./schemas";

/**
 * Quiz answers -> roles. scoreQuiz() decides the ranking and scores; the fast tier only adds friendlier
 * why lines and starter skills. Fixture mode (no AI key) and any AI failure use the deterministic result.
 * Prompt text is built only from our own question/option labels, never from free user input.
 */
export async function quizToArchetypes(answers: Record<string, string>): Promise<{ archetypes: ArchetypeScore[]; skills: string[] }> {
  const ranking = scoreQuiz(answers);
  const starter = (): string[] =>
    ranking[0] ? SKILLS.filter((s) => s.archetypes.includes(ranking[0].key)).slice(0, 5).map((s) => s.canonical) : [];
  const fallback = (): QuizOutputT => ({ archetypes: ranking, skills: starter() });
  if (!ranking.length) return fallback();

  let out: QuizOutputT;
  try {
    out = await runAi({
      fn: "quizToArchetypes",
      schema: QuizOutput,
      live: () => generateStructured({
        tier: "fast", system: SYSTEM_QUIZ, schema: QuizOutput, maxTokens: 1500,
        parts: [{
          type: "text",
          text: `Answers:\n${QUESTIONS.map((q) => `${q.prompt} -> ${q.options.find((o) => o.id === answers[q.id])?.label ?? "-"}`).join("\n")}\n\nRanking: ${JSON.stringify(ranking)}`,
        }],
      }),
      fallback,
    });
  } catch (e) {
    console.error("quizToArchetypes: AI failed, using deterministic result", e);
    out = fallback();
  }

  const skills = [...new Set(out.skills.map((s) => s.trim()).filter(Boolean).map((s) => canonicalize(s) ?? s))].slice(0, 5);
  return { archetypes: mergeQuizWhy(ranking, out.archetypes), skills: skills.length ? skills : starter() };
}
