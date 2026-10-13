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

    const exact = (s.caseSensitive && /[A-Z]/.test(a)) || (s.caseSensitiveAliases?.includes(a) ?? false);
    if (exact) {
      // Exact-case alias: excluded from the case-insensitive pass, matched only as written
      CASE_SENSITIVE_KEYS.add(lower);
      const regex = new RegExp(`(?<![A-Za-z0-9])${escapeRegex(a)}(?![A-Za-z0-9+#])`, "g");
      CASE_SENSITIVE_PATTERNS.push({ term: a, canonical: s.canonical, re: regex });
    }
  }
}

export function canonicalize(name: string): string | null {
  return ALIAS.get(name.trim().toLowerCase()) ?? null;
}

// Boundaries that work for C++, C#, Node.js: not preceded/followed by a letter/digit.
// "++" terms may carry a standard-version suffix (C++17, C++11/14).
function termRegex(term: string): RegExp {
  const right = term.endsWith("++") ? "(?![A-Za-z+#])" : "(?![A-Za-z0-9+#])";
  return new RegExp(`(?<![A-Za-z0-9])${escapeRegex(term)}${right}`, "gi");
}

// R: after in/with/using/and/","/":", or before ","/and/programming/studio/language, or in "/" or "(R)". Not R&D, R-squared.
const R_ = "R(?![A-Za-z0-9&\\-])";
const SINGLE_LETTER_CONTEXT = new RegExp(
  `(?:\\b(?:in|with|using|and)|[,:])\\s+${R_}|\\b${R_}\\s*,|\\b${R_}\\s+(?:and|programming|studio|language)\\b|\\b${R_}\\s*\\/|\\/\\s*${R_}\\b|\\b${R_}\\)`,
);

// Ambiguous language names ("C", "Go") count only in a list next to an unambiguous language ("C and C++",
// "Go, Rust", "Rust (Go)"), possibly chained through other ambiguous ones ("C, Go, Python").
const LANGS = ["Python", "JavaScript", "TypeScript", "Java", "C++", "C#", "Rust", "Kotlin", "Swift", "Scala", "Haskell",
  "OCaml", "SQL", "MATLAB", "Julia", "VBA", "Golang", "Ruby", "PHP", "Perl", "Fortran", "Assembly", "Bash", "Lua", "Dart"];
const LANG_ALT = LANGS.map(escapeRegex).join("|");
const AMBIG: Record<string, RegExp> = {
  C: /(?<![A-Za-z0-9.'&+#\-])C(?![A-Za-z0-9+#&'\-]|\.[A-Za-z0-9])/g,
  Go: /(?<![A-Za-z0-9.'&+#\-])Go(?![A-Za-z0-9+#&'\-]|\.[A-Za-z0-9])/g,
};
const VER = String.raw`(?:\d{1,2}(?:\/\d{1,2})*)?`; // C++17, C++11/14, Python3
const SEP = String.raw`\s*(?:,|\/|&|\(|\)|\band\b|\bor\b)\s*`;
const NEXT_LANG = new RegExp(`^${SEP}(?:(?<lang>(?<![A-Za-z0-9])(?:${LANG_ALT})${VER}(?![A-Za-z0-9+#]))|(?<amb>(?:C|Go|R)(?![A-Za-z0-9+#&'\\-])))`, "i");
const PREV_LANG = new RegExp(`(?:(?<lang>(?<![A-Za-z0-9])(?:${LANG_ALT})${VER})|(?<amb>(?<![A-Za-z0-9.'&+#\\-])(?:C|Go|R)))${SEP}$`, "i");

function inLanguageList(text: string, index: number, end: number): boolean {
  for (const dir of [1, -1] as const) {
    let i = index, e = end;
    for (let hop = 0; hop < 4; hop++) {
      const m = dir === 1 ? NEXT_LANG.exec(text.slice(e, e + 40)) : PREV_LANG.exec(text.slice(Math.max(0, i - 40), i));
      if (!m) break;
      if (m.groups?.lang) return true;
      // Ambiguous neighbour keeps the chain going only if written exactly ("go" / "c" do not)
      const amb = m.groups!.amb;
      if (amb !== "C" && amb !== "Go" && amb !== "R") break;
      if (dir === 1) { const s = e + m[0].length - amb.length; i = s; e = s + amb.length; }
      else { const s = Math.max(0, i - 40) + m.index; i = s; e = s + amb.length; }
    }
  }
  return false;
}

const PATTERNS: { canonical: string; re: RegExp; term: string }[] = [...ALIAS.entries()]
  .filter(([term]) => !CASE_SENSITIVE_KEYS.has(term) && (term.length > 1 || term === "r"))
  .sort((a, b) => b[0].length - a[0].length)
  .map(([term, canonical]) => ({ term, canonical, re: termRegex(term) }));

const IMPLIED_PARENTS = new Set(["JavaScript", "React"]);

export function extractSkills(text: string): string[] {
  const found: { canonical: string; index: number; end: number }[] = [];

  // First, try case-sensitive patterns
  for (const p of CASE_SENSITIVE_PATTERNS) {
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text)) !== null) {
      found.push({ canonical: p.canonical, index: m.index, end: m.index + m[0].length });
    }
  }

  // Then, try case-insensitive patterns
  for (const p of PATTERNS) {
    if (p.term === "r") {
      // Find all matches of R in skill-like context
      const regex = new RegExp(SINGLE_LETTER_CONTEXT.source, "g");
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        found.push({ canonical: p.canonical, index: m.index, end: m.index + m[0].length });
      }
      continue;
    }
    if (p.term === "go") {
      // "Go" only when capitalised and in a list with another language
      const regex = new RegExp(AMBIG.Go.source, "g");
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        if (inLanguageList(text, m.index, m.index + 2)) found.push({ canonical: p.canonical, index: m.index, end: m.index + 2 });
      }
      continue;
    }
    p.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = p.re.exec(text)) !== null) {
      found.push({ canonical: p.canonical, index: m.index, end: m.index + m[0].length });
    }
  }

  // "C" (single letter, excluded from PATTERNS): only in a language list
  const cRe = new RegExp(AMBIG.C.source, "g");
  let cm: RegExpExecArray | null;
  while ((cm = cRe.exec(text)) !== null) {
    if (inLanguageList(text, cm.index, cm.index + 1)) found.push({ canonical: "C", index: cm.index, end: cm.index + 1 });
  }

  // A term inside a longer matched term is not a separate skill ("search engine optimisation" is SEO, not also
  // "Optimisation"), except parents the longer skill genuinely implies (Node.js → JavaScript, React Native → React).
  const nested = (f: (typeof found)[number]) =>
    !IMPLIED_PARENTS.has(f.canonical) &&
    found.some((g) => g !== f && g.canonical !== f.canonical && g.index <= f.index && g.end >= f.end && g.end - g.index > f.end - f.index);
  const kept = found.filter((f) => !nested(f));
  const seen = new Set<string>();
  return kept.sort((a, b) => a.index - b.index).filter((f) => !seen.has(f.canonical) && seen.add(f.canonical)).map((f) => f.canonical);
}
