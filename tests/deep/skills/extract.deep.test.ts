import { describe, it, expect } from "vitest";
import { extractSkills, canonicalize, SKILLS } from "@/lib/skills/extract";

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const CANONICALS = new Set(SKILLS.map((s) => s.canonical));
// Terms that intentionally need special context (single letters / "Go" / "q").
const CONTEXTUAL = new Set(["C", "R", "Go", "q"]);

describe("vocabulary round-trip", () => {
  it("every canonical name and alias (except contextual single-letter ones) extracts to its canonical", () => {
    const misses: string[] = [];
    for (const s of SKILLS) for (const term of [s.canonical, ...s.aliases]) {
      if (CONTEXTUAL.has(term)) continue;
      if (!extractSkills(`Experience with ${term} daily.`).includes(s.canonical)) misses.push(term);
    }
    expect(misses).toEqual([]);
  });
  it("canonicalize is idempotent on canonicals and case/whitespace-insensitive on aliases", () => {
    for (const s of SKILLS) {
      expect(canonicalize(s.canonical)).toBe(s.canonical);
      expect(canonicalize(`  ${s.canonical.toUpperCase()}  `)).toBe(s.canonical);
      for (const a of s.aliases) expect(canonicalize(a.toLowerCase())).toBe(s.canonical);
    }
  });
  it("canonicalize returns null for empty / whitespace / unknown", () => {
    expect(canonicalize("")).toBeNull();
    expect(canonicalize("   ")).toBeNull();
    expect(canonicalize("node js")).toBeNull();
  });
  it("case-insensitive entries match in UPPER, lower and Title case", () => {
    const misses: string[] = [];
    for (const s of SKILLS) {
      if (s.caseSensitive || s.caseSensitiveAliases || CONTEXTUAL.has(s.canonical)) continue;
      for (const v of [s.canonical.toUpperCase(), s.canonical.toLowerCase()]) {
        if (!extractSkills(`Experience with ${v} daily.`).includes(s.canonical)) misses.push(v);
      }
    }
    expect(misses).toEqual([]);
  });
});

describe("symbol-heavy and punctuation variants", () => {
  it.each([
    ["C++", "C++"], ["cpp", "C++"], ["C#", "C#"], ["c sharp", "C#"], ["csharp", "C#"],
    [".NET", ".NET"], [".net", ".NET"], ["ASP.NET", ".NET"], ["asp.net core", ".NET"], ["C#.NET", ".NET"],
    ["Node.js", "Node.js"], ["Node.JS", "Node.js"], ["nodejs", "Node.js"], ["NodeJS", "Node.js"],
    ["React.js", "React"], ["ReactJS", "React"], ["react", "React"], ["Next.js", "Next.js"], ["nextjs", "Next.js"],
    ["C++/Python", "C++"], ["TypeScript/JavaScript", "TypeScript"], ["T-SQL", "SQL"], ["PL/SQL", "SQL"],
    ["A/B testing", "A/B Testing"], ["AB testing", "A/B Testing"], ["CI/CD", "CI/CD"], ["KDB+", "KDB+"], ["P&L", "PnL"], ["M&A", "M&A"],
  ])("%s → %s", (text, canonical) => {
    expect(extractSkills(`We use ${text} here`)).toContain(canonical);
  });
  it("surrounding unicode punctuation does not block matches", () => {
    expect(extractSkills("Python—SQL")).toEqual(["Python", "SQL"]);
    expect(extractSkills("Python•SQL")).toEqual(["Python", "SQL"]);
    expect(extractSkills("「Python」")).toEqual(["Python"]);
    expect(extractSkills("Python and SQL")).toEqual(["Python", "SQL"]);
    expect(extractSkills("café python")).toEqual(["Python"]);
    expect(extractSkills("Python's ecosystem; Python-based tools")).toEqual(["Python"]);
  });
  it("accented look-alikes are not the skill", () => {
    expect(extractSkills("Pythön")).toEqual([]);
  });
});

describe("skills inside other words (false-positive guards)", () => {
  it.each([
    ["JavaScript only", "Java"], ["Javanese", "Java"], ["scalable systems", "Scala"], ["trust and rusty", "Rust"],
    ["Sass styling", "SAS"], ["download the file", "Deep Learning"], ["HTML and xml", "Machine Learning"],
    ["NoSQL stores", "SQL"], ["excellent results", "Excel"], ["digital", "Git"], ["boss and loss", "Open Source"],
    ["Flora", "Fine-tuning"], ["spring term", "Spring Boot"], ["R&D department", "R"], ["R-squared of 0.9", "R"],
    ["Rapport", "R"], ["go-to person", "Go"], ["Go-to-market plan", "Go"], ["We go and do it", "Go"],
    ["C-suite exposure", "C"], ["Objective-C", "C"], ["Q1 2026 results", "KDB+"], ["a q&a session", "KDB+"],
    ["I like music", "Machine Learning"],
  ])("%s does not yield %s", (text, skill) => {
    expect(extractSkills(text)).not.toContain(skill);
  });
  it("Java and JavaScript are distinguished in the same sentence", () => {
    expect(extractSkills("JavaScript and Java")).toEqual(["JavaScript", "Java"]);
    expect(extractSkills("JavaScript only")).toEqual(["JavaScript"]);
  });
  it("R in genuine language-list contexts", () => {
    for (const t of ["Python and R.", "Python, R", "R/Python", "skills in R", "(R)", "R and SQL", "R programming"]) {
      expect(extractSkills(t)).toContain("R");
    }
  });
  it("Go in genuine language-list contexts", () => {
    for (const t of ["Go, Rust", "Go and Python", "Go/Rust", "Rust (Go)", "golang"]) expect(extractSkills(t)).toContain("Go");
  });

  // BUG: lib/skills/extract.ts:54 SINGLE_LETTER_CONTEXT — "R" at the start of a list ("R, Python") or after a colon
  // ("Languages: R") is missed, because the "R followed by ," branch requires whitespace before the comma and
  // ":" is not an accepted left context. Typical CV/JD skills lines lose R entirely.
  it.fails("R at the start of a comma list or after a colon is extracted", () => {
    expect(extractSkills("Skills: R, Python, SQL")).toContain("R");
    expect(extractSkills("Languages: R")).toContain("R");
  });
  // GAP: lib/skills/extract.ts:57 — single-letter terms other than "r" are filtered out of PATTERNS, so the
  // "C" vocabulary entry is unreachable from text: "Proficient in C and C++" yields only C++.
  it.fails("C language is extractable in an unambiguous language list", () => {
    expect(extractSkills("Proficient in C and C++")).toEqual(["C", "C++"]);
    expect(extractSkills("Languages: C, Python")).toContain("C");
  });
  // BUG (low): "Go" heuristic fires on any capitalised "Go," — e.g. sentence-initial prose.
  it.fails("sentence-initial 'Go,' in prose is not the Go language", () => {
    expect(extractSkills("Let's Go, team! Go and see the office.")).not.toContain("Go");
  });
  // BUG: lib/skills/extract.ts:23,39,51 — the right boundary (?![A-Za-z0-9+#]) rejects a digit after "C++", so the
  // very common quant/SWE spelling "C++11/14/17" or "C++20" yields nothing.
  it.fails("C++ with a standard version suffix (C++17, C++11/14) is extracted", () => {
    expect(extractSkills("Modern C++17 required")).toContain("C++");
    expect(extractSkills("C++11/14 experience")).toContain("C++");
  });
  // GAP: "node js" (space) — explicitly listed variant, not in vocab; only the bare "js" alias fires.
  it.fails("'node js' with a space maps to Node.js", () => {
    expect(extractSkills("Backend in node js")).toContain("Node.js");
  });
  // GAP (low): hyphenated "machine-learning" is not matched (the alias set only has the spaced form).
  it.fails("hyphenated 'machine-learning' maps to Machine Learning", () => {
    expect(extractSkills("built machine-learning models")).toContain("Machine Learning");
  });
});

describe("overlapping matches (longest match should win)", () => {
  // BUG: lib/skills/extract.ts:101 — matches are de-duplicated by canonical name only, never by text span,
  // so a sub-term inside a longer matched term is ALSO emitted. A marketing JD asking for "search engine
  // optimisation" therefore gains a phantom must-have "Optimisation" (a quant/research skill), which a student
  // who wrote "SEO" will show as a gap. The PostgreSQL→SQL case is already guarded by word boundaries;
  // multi-word phrases are not.
  it.fails("'search engine optimisation' and 'conversion rate optimisation' do not also yield 'Optimisation'", () => {
    expect(extractSkills("Search engine optimisation and conversion rate optimisation")).toEqual(["SEO", "Conversion Rate Optimisation"]);
  });
  it.fails("'stakeholder communication' yields only Stakeholder Management", () => {
    expect(extractSkills("stakeholder communication")).toEqual(["Stakeholder Management"]);
  });
  it("documents current overlap behaviour for '.js' frameworks and React Native (implied parents emitted)", () => {
    // Characterisation, not an assertion of desired behaviour: the 'js' alias fires on the '.js' suffix.
    expect(extractSkills("Node.js")).toEqual(["Node.js", "JavaScript"]);
    expect(extractSkills("React Native")).toEqual(["React Native", "React"]);
  });
});

describe("extractSkills invariants (seeded property loops)", () => {
  const terms = SKILLS.flatMap((s) => [s.canonical, ...s.aliases]).filter((t) => !CONTEXTUAL.has(t));
  const filler = ["and", "with", "using", "the", "team", "data", "we", "built", "a", ",", ";", "(", ")", "/", "-", "\n", "•", "—"];
  function randomText(r: () => number, n = 40) {
    const out: string[] = [];
    for (let i = 0; i < n; i++) out.push(r() < 0.3 ? terms[Math.floor(r() * terms.length)] : filler[Math.floor(r() * filler.length)]);
    return out.join(" ");
  }
  it("outputs are canonical, unique, deterministic; input is not mutated", () => {
    const r = rng(123);
    for (let i = 0; i < 800; i++) {
      const t = randomText(r);
      const a = extractSkills(t);
      expect(new Set(a).size).toBe(a.length);
      for (const s of a) expect(CANONICALS.has(s)).toBe(true);
      expect(extractSkills(t)).toEqual(a);
    }
  });
  it("re-extracting from the joined canonical output finds at least the same skills (idempotence ⊇)", () => {
    const r = rng(321);
    for (let i = 0; i < 500; i++) {
      const a = extractSkills(randomText(r)).filter((s) => !CONTEXTUAL.has(s));
      const b = extractSkills(a.join(", "));
      for (const s of a) expect(b).toContain(s);
    }
  });
  it("output is ordered by first occurrence", () => {
    expect(extractSkills("Tableau then Excel then Python then Excel")).toEqual(["Tableau", "Excel", "Python"]);
  });
  it("adding text never removes a previously found skill (monotone in text)", () => {
    const r = rng(77);
    for (let i = 0; i < 500; i++) {
      const a = randomText(r, 20), b = randomText(r, 20);
      const base = extractSkills(a);
      const more = extractSkills(`${a}\n${b}`);
      for (const s of base) expect(more).toContain(s);
    }
  });
  it("empty / whitespace / pathological inputs return []", () => {
    for (const t of ["", " ", "\n\n\t", "!!!???", "+++###", "R", "C", "Go", "q", "...", "\u0000​"]) expect(extractSkills(t)).toEqual([]);
  });
});

describe("performance", () => {
  it("extracts from a 50k-char JD in < 200ms", () => {
    const words = ["We", "are", "seeking", "Python", "SQL", "Excel", "and", "R", "C++", "team", "Node.js", "React", "data", "financial", "modelling", "with", "AWS", "Docker", "the", "of", "machine", "learning", "R&D", "go-to"];
    let s = "";
    for (let i = 0; s.length < 50_000; i++) s += words[(i * 7 + 3) % words.length] + (i % 13 === 0 ? ".\n- " : " ");
    extractSkills("warm up");
    const t0 = performance.now();
    const out = extractSkills(s);
    const ms = performance.now() - t0;
    expect(out.length).toBeGreaterThan(5);
    expect(ms).toBeLessThan(200);
  });
  it("is linear-ish: a pathological single 50k token is fast (no catastrophic backtracking)", () => {
    for (const s of ["R".repeat(50_000), "a".repeat(50_000), ", ".repeat(25_000), "in R ".repeat(10_000), "C+".repeat(25_000)]) {
      const t0 = performance.now();
      extractSkills(s);
      expect(performance.now() - t0).toBeLessThan(200);
    }
  });
});
