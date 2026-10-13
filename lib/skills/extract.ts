import { escapeRegex } from "@/lib/text/regex";
import { SKILLS, type SkillEntry } from "./vocab";

export { SKILLS };
export type { SkillEntry };

const ALIAS = new Map<string, string>();
const CASE_SENSITIVE_PATTERNS: Array<{ term: string; canonical: string; re: RegExp }> = [];
const CASE_SENSITIVE_KEYS = new Set<string>(); // Lowercase keys to exclude from case-insensitive patterns

for (const s of SKILLS) {
  const canonicalLower = s.canonical.toLowerCase();

  // Check for collision on canonical name
  if (ALIAS.has(canonicalLower) && ALIAS.get(canonicalLower) !== s.canonical) {
    throw new Error(`Collision: "${canonicalLower}" already maps to "${ALIAS.get(canonicalLower)}", cannot map to "${s.canonical}"`);
  }
  ALIAS.set(canonicalLower, s.canonical);

  if (s.caseSensitive) {
    CASE_SENSITIVE_KEYS.add(canonicalLower);
    // Add case-sensitive pattern for the canonical name
    const regex = new RegExp(`(?<![A-Za-z0-9])${escapeRegex(s.canonical)}(?![A-Za-z0-9+#])`, "g");
    CASE_SENSITIVE_PATTERNS.push({ term: s.canonical, canonical: s.canonical, re: regex });
  }

  // Check for collisions on aliases
  for (const a of s.aliases) {
    const lower = a.toLowerCase();
    if (ALIAS.has(lower) && ALIAS.get(lower) !== s.canonical) {
      throw new Error(`Collision: "${lower}" (alias "${a}") already maps to "${ALIAS.get(lower)}", cannot map to "${s.canonical}"`);
    }
    ALIAS.set(lower, s.canonical);

    if (s.caseSensitive) {
      // Mark the lowercase form as case-sensitive to exclude from case-insensitive patterns
      CASE_SENSITIVE_KEYS.add(lower);
      // Only add case-sensitive pattern for aliases with meaningful capitalization (not pure lowercase)
      if (a !== lower) {
        const regex = new RegExp(`(?<![A-Za-z0-9])${escapeRegex(a)}(?![A-Za-z0-9+#])`, "g");
        CASE_SENSITIVE_PATTERNS.push({ term: a, canonical: s.canonical, re: regex });
      }
    }
  }
}

export function canonicalize(name: string): string | null {
  return ALIAS.get(name.trim().toLowerCase()) ?? null;
}

// Boundaries that work for C++, C#, Node.js: not preceded/followed by a letter/digit
function termRegex(term: string): RegExp {
  return new RegExp(`(?<![A-Za-z0-9])${escapeRegex(term)}(?![A-Za-z0-9+#])`, "gi");
}

const SINGLE_LETTER_CONTEXT = /\b(in|with|using|and|,)\s+R(?![A-Za-z0-9&])|\bR(?![A-Za-z0-9&])\s+(and|,|programming|studio|language)\b|\bR(?![A-Za-z0-9&])\s*\/|\/\s*R(?![A-Za-z0-9&])\b|\bR(?![A-Za-z0-9&])\)/;

const PATTERNS: { canonical: string; re: RegExp; term: string }[] = [...ALIAS.entries()]
  .filter(([term]) => !CASE_SENSITIVE_KEYS.has(term) && (term.length > 1 || term === "r"))
  .sort((a, b) => b[0].length - a[0].length)
  .map(([term, canonical]) => ({ term, canonical, re: termRegex(term) }));

export function extractSkills(text: string): string[] {
  const found: { canonical: string; index: number }[] = [];

  // First, try case-sensitive patterns
  for (const p of CASE_SENSITIVE_PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text)) !== null) {
      found.push({ canonical: p.canonical, index: m.index });
    }
  }

  // Then, try case-insensitive patterns
  for (const p of PATTERNS) {
    if (p.term === "r") {
      // Find all matches of R in skill-like context
      const regex = new RegExp(SINGLE_LETTER_CONTEXT.source, "g");
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        found.push({ canonical: p.canonical, index: m.index });
      }
      continue;
    }
    if (p.term === "go") {
      // "Go" only when capitalised and adjacent to other languages
      const regex = /(?<![A-Za-z])Go(?![A-Za-z])(?=\s*[,/)]|\s+and\s)/g;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        found.push({ canonical: p.canonical, index: m.index });
      }
      continue;
    }
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text)) !== null) {
      found.push({ canonical: p.canonical, index: m.index });
    }
  }

  const seen = new Set<string>();
  return found.sort((a, b) => a.index - b.index).filter((f) => !seen.has(f.canonical) && seen.add(f.canonical)).map((f) => f.canonical);
}
