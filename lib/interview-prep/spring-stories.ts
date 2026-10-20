import type { Bank, BankEntry } from "@/lib/bank/types";
import { entryLabel } from "@/lib/bank/label";
import type { PrepQuestion, StoryTheme } from "./spring-bank";

/**
 * STAR story suggestions for spring week (and placement) competency questions, picked from the student's Experience Bank by keyword.
 * Deterministic and local: no model call, so it works with AI off and never sends the bank anywhere. The student's own
 * bullet is shown as the evidence; nothing is rewritten or invented.
 */

const THEME_WORDS: Record<StoryTheme, RegExp> = {
  lead: /\b(led|lead|leading|captain\w*|president|head|chair\w*|organi[sz]\w*|managed|manag\w+|founded|co-?founded|coordinat\w+|ran|mentor\w*|prefect|committee)\b/gi,
  team: /\b(team\w*|together|collaborat\w+|group|squad|partner\w*|colleagues?|peers?|volunteers?)\b/gi,
  failure: /\b(mistake\w*|fail\w*|lost|missed|setback|feedback|improv\w+|retook|rebuilt|lesson\w*)\b/gi,
  challenge: /\b(challeng\w+|difficult\w*|overc\w+|despite|problem\w*|obstacle\w*|tight|limited|turned\s+around)\b/gi,
  influence: /\b(persuad\w+|convinc\w+|negotiat\w+|propos\w+|influenc\w+|present\w*|lobb\w+|secured|won\s+over)\b/gi,
  learn: /\b(learn\w*|taught|self-taught|picked\s+up|course|certif\w+|trained|training|new\s+to|bloomberg|forage)\b/gi,
  data: /\b(data|analys\w+|analyz\w+|excel|python|sql|spreadsheet\w*|model\w*|statistic\w*|survey\w*|metrics?|dashboard\w*)\b/gi,
  conflict: /\b(conflict\w*|disagree\w*|mediat\w+|resolv\w+|complain\w*|tension\w*|dispute\w*|de-?escalat\w+)\b/gi,
  pressure: /\b(deadline\w*|pressure|exams?|balanc\w+|alongside|while\s+studying|simultaneous\w*|hours|shifts?|weekly|busy|peak)\b/gi,
  achievement: /\b(won|winner|award\w*|prize\w*|first\s+place|top\s+\d+|record|raised|achiev\w+|selected|scholarship\w*|olympiad|finalist|grade\s+\d)\b/gi,
  unique: /\b(founded|started|built|created|self-taught|hobby|blog|podcast|competition|club|music|sport\w*|travel\w*|languages?)\b/gi,
};

/** Numbers make a Result: "£2k", "30%", "12 students", "top 5". */
const HAS_RESULT = /(£|\$|€)\s?\d|\d+(\.\d+)?\s?(%|k\b|m\b)|\b\d{2,}\b|\btop\s+\d+/i;

export type StorySuggestion = {
  questionId: number;
  question: string;
  theme: StoryTheme;
  entryId: string;
  label: string;
  section: BankEntry["section"];
  dates: string;
  /** The student's own bullet that best fits, verbatim. */
  bullet: string;
  /** Whether that bullet already carries a number for the Result. */
  hasResult: boolean;
};

const hits = (re: RegExp, text: string) => (text.match(re) ?? []).length;

type Candidate = { entry: BankEntry; bullet: string; score: number };

/** Every visible bullet that speaks to the theme, scored on its own words plus its entry's title and section. */
function candidates(entries: BankEntry[], theme: StoryTheme): Candidate[] {
  const re = THEME_WORDS[theme];
  const out: Candidate[] = [];
  for (const entry of entries) {
    const head = hits(re, `${entry.title} ${entry.org}`);
    // Leadership-section entries are natural "led a team" stories even with sparse wording.
    const section = entry.section === "leadership" && (theme === "lead" || theme === "team") ? 1 : 0;
    for (const b of entry.bullets) {
      if (b.hidden || !b.text.trim()) continue;
      const own = hits(re, b.text);
      if (own + head + section === 0) continue;
      out.push({ entry, bullet: b.text, score: own * 2 + head + section + (HAS_RESULT.test(b.text) ? 0.5 : 0) + (b.pinned || entry.pinned ? 0.25 : 0) });
    }
  }
  return out;
}

/** A bullet answers at most this many questions: past that the student needs a new story, not the same one again. */
const MAX_BULLET_USES = 2;

/**
 * One story per competency question, spread across the bank: reuse is penalised and a bullet answers at most two
 * questions, so the student gets a varied set of stories. Questions with no matching bullet are left out.
 */
export function suggestStories(bank: Bank, questions: Pick<PrepQuestion, "id" | "text" | "theme">[], max = 10): StorySuggestion[] {
  const entries = bank.entries.filter((e) => !e.hidden);
  const entryUses = new Map<string, number>();
  const bulletUses = new Map<string, number>();
  const out: StorySuggestion[] = [];
  for (const q of questions) {
    if (!q.theme || out.length >= max) continue;
    const top = candidates(entries, q.theme)
      .filter((c) => (bulletUses.get(c.bullet) ?? 0) < MAX_BULLET_USES)
      // Reuse is allowed but costs: a used bullet much more than another bullet of a used entry.
      .map((c) => ({ ...c, score: c.score / (1 + 2 * (bulletUses.get(c.bullet) ?? 0) + 0.5 * (entryUses.get(c.entry.id) ?? 0)) }))
      .sort((a, b) => b.score - a.score)[0];
    if (!top) continue;
    entryUses.set(top.entry.id, (entryUses.get(top.entry.id) ?? 0) + 1);
    bulletUses.set(top.bullet, (bulletUses.get(top.bullet) ?? 0) + 1);
    out.push({
      questionId: q.id, question: q.text, theme: q.theme, entryId: top.entry.id, label: entryLabel(top.entry),
      section: top.entry.section, dates: top.entry.dates, bullet: top.bullet, hasResult: HAS_RESULT.test(top.bullet),
    });
  }
  return out;
}
