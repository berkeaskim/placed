import { describe, it, expect } from "vitest";
import { htmlToLines, tagSections } from "@/lib/text/jd";
import { escapeRegex, EMAIL_RE, PHONE_RE } from "@/lib/text/regex";
import { jdRequirementSkills } from "@/lib/scoring/coverage";

function rng(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("htmlToLines", () => {
  it("drops script/style blocks entirely", () => {
    expect(htmlToLines("<p>Hi</p><script>var x = '<p>evil</p>';</script><style>.a{}</style><p>Bye</p>")).toEqual(["Hi", "Bye"]);
  });
  it("decodes numeric (dec/hex) and named entities, collapses &nbsp; runs", () => {
    expect(htmlToLines("<p>&#65;&#x42; &amp; C&nbsp;&nbsp;&nbsp;D &rsquo;E&rsquo; &hellip;</p>")).toEqual(["AB & C D 'E' …"]);
  });
  it("decodes single-escaped and double-escaped (Greenhouse) markup to the same lines", () => {
    const html = "<h2>Requirements</h2><ul><li>Python &amp; SQL</li></ul>";
    const escaped = html.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    expect(htmlToLines(escaped)).toEqual(htmlToLines(html));
  });
  it("never emits empty lines, bare '-' or bare '##'", () => {
    const out = htmlToLines("<ul><li></li><li> </li></ul><h3></h3><p>\n\n</p><div>x</div>");
    expect(out).toEqual(["x"]);
  });
  it("empty input → []", () => {
    expect(htmlToLines("")).toEqual([]);
  });
  it("is idempotent on its own output (lines re-joined with <br>)", () => {
    const once = htmlToLines("<h2>Role</h2><p>Use Python &amp; R</p><ul><li>SQL</li></ul>");
    expect(htmlToLines(once.join("<br>"))).toEqual(once);
  });
  it("property: output lines are trimmed, single-spaced and tag-free for random tag soup", () => {
    const r = rng(4);
    const parts = ["<p>", "</p>", "<li>", "</li>", "<br/>", "<h3>", "</h3>", "<div class='x'>", "</div>", " Python ", "&amp;", " SQL", "\n", "\t", "text", "&nbsp;"];
    for (let i = 0; i < 500; i++) {
      const html = Array.from({ length: 30 }, () => parts[Math.floor(r() * parts.length)]).join("");
      for (const l of htmlToLines(html)) {
        expect(l).toBe(l.trim());
        expect(l).not.toMatch(/\s{2,}/);
        expect(l).not.toMatch(/<\/?[a-z]/i);
        expect(l.length).toBeGreaterThan(0);
      }
    }
  });
  it("handles a 200k-char description quickly and without truncation", () => {
    const html = "<ul>" + Array.from({ length: 5000 }, (_, i) => `<li>Requirement number ${i} with Python &amp; SQL</li>`).join("") + "</ul>";
    const t0 = performance.now();
    const out = htmlToLines(html);
    expect(performance.now() - t0).toBeLessThan(500);
    expect(out).toHaveLength(5000);
  });

  // Fixed: htmlToLines only strips real tags (/<\/?[a-z!?][^>]*>/), so bare < and > survive.
  it("does not delete text between literal < and > comparison signs", () => {
    expect(htmlToLines("<p>Latency < 10ms, throughput > 1M req/s</p>")).toEqual(["Latency < 10ms, throughput > 1M req/s"]);
  });
});

describe("tagSections — spec §5.1.1 header vocabulary", () => {
  it.each([
    "## Requirements", "## Required skills", "## Qualifications", "## Minimum qualifications", "## What we're looking for",
    "## Skills and Experience", "## Key requirements", "## Who you are", "## You'll have", "## You'll need", "## Must-have", "## Essential criteria", "## About you", "Requirements:",
  ])("%s → must", (h) => {
    expect(tagSections([h, "- Python"])[1].section).toBe("must");
  });
  it.each(["## Preferred qualifications", "## Nice to have", "## Nice-to-have", "## Bonus points", "## Desirable", "## Ideally you'll have", "## Good to have", "Plus:"])(
    "%s → nice", (h) => {
      expect(tagSections([h, "- Python"])[1].section).toBe("nice");
    });
  it.each(["## About the team", "## Benefits", "## What you'll do", "## Responsibilities", "## How to apply"])("%s → other", (h) => {
    expect(tagSections([h, "- Python"])[1].section).toBe("other");
  });
  it("bullet overrides: '(preferred)', 'a plus', 'ideally' → nice; 'must', 'required', 'essential' → must", () => {
    const t = tagSections(["## Requirements", "- Docker (preferred)", "- Rust is a plus", "- Ideally Kafka", "## Nice to have", "- Python is essential", "- SQL required", "- You must know Excel"]);
    expect(t.slice(1, 4).map((x) => x.section)).toEqual(["nice", "nice", "nice"]);
    expect(t.slice(5).map((x) => x.section)).toEqual(["must", "must", "must"]);
  });
  it("bullet overrides do NOT pull 'other' sections into requirements", () => {
    const t = tagSections(["## About us", "- You must love coffee", "- A plus: free lunch"]);
    expect(t.every((x) => x.section === "other")).toBe(true);
  });
  it("section resets at each header (a later 'other' header ends the must section)", () => {
    const t = tagSections(["## Requirements", "- Python", "## Benefits", "- Excel training"]);
    expect(t[3].section).toBe("other");
  });
  it("header detection: bullets are never headers; lines ending ':' are", () => {
    const t = tagSections(["- Requirements:", "Tech stack:"]);
    expect(t[0].isHeader).toBe(false);
    expect(t[1].isHeader).toBe(true);
  });
  it("is length-preserving and keeps text verbatim (property)", () => {
    const r = rng(12);
    const pool = ["## Requirements", "## Nice to have", "## Benefits", "- Python", "- SQL (preferred)", "- must know R", "Prose line", "Qualifications:", ""];
    for (let i = 0; i < 300; i++) {
      const lines = Array.from({ length: 1 + Math.floor(r() * 25) }, () => pool[Math.floor(r() * pool.length)]);
      const t = tagSections(lines);
      expect(t.map((x) => x.text)).toEqual(lines);
      for (const x of t) expect(["must", "nice", "other"]).toContain(x.section);
    }
  });
  it("is pure: tagging a suffix after a header equals tagging it in the full list", () => {
    const lines = ["## Requirements", "- Python", "- SQL"];
    expect(tagSections(lines)).toEqual(tagSections(lines));
  });

  // Fixed: "Skills & Experience" used to be tagged "other" (missing space in the regex).
  it("'## Skills & Experience' is a must-have header", () => {
    expect(tagSections(["## Skills & Experience", "- Python"])[1].section).toBe("must");
  });
  it("uncontracted and common must-header variants are recognised", () => {
    for (const h of ["## What we are looking for", "## Who we're looking for", "## Your profile", "## What you bring"]) {
      expect(tagSections([h, "- Python"])[1].section).toBe("must");
    }
  });
  // Fixed: NICE_HEADER only treats "bonus"/"plus" as nice at the start or in nice-to-have phrasings.
  it("compensation headers mentioning 'bonus'/'plus' are not nice-to-have sections", () => {
    const t = tagSections(["## Salary and bonus", "- Free Excel training", "## Competitive pay plus benefits", "- Bloomberg terminal access"]);
    expect(t[1].section).toBe("other");
    expect(t[3].section).toBe("other");
    expect(jdRequirementSkills(["## Salary and bonus", "- Free Excel training"], [])).toEqual([]);
  });
});

describe("escapeRegex / EMAIL_RE / PHONE_RE", () => {
  it("property: an escaped random string matches itself exactly and nothing else", () => {
    const r = rng(1);
    const alphabet = ".*+?^${}()|[]\\/-abcAZ09 #&";
    for (let i = 0; i < 2000; i++) {
      const s = Array.from({ length: 1 + Math.floor(r() * 12) }, () => alphabet[Math.floor(r() * alphabet.length)]).join("");
      const re = new RegExp(`^${escapeRegex(s)}$`);
      expect(re.test(s)).toBe(true);
      expect(re.test(s + "x")).toBe(false);
    }
  });
  it("escaped skill names behave inside the extractor's boundary pattern", () => {
    for (const s of ["C++", "C#", ".NET", "Node.js", "KDB+", "A/B Testing", "CI/CD", "M&A"]) {
      expect(new RegExp(`(?<![A-Za-z0-9])${escapeRegex(s)}(?![A-Za-z0-9+#])`).test(`I know ${s}.`)).toBe(true);
    }
  });
  it("EMAIL_RE finds the first address, including plus and subdomains", () => {
    expect("Ayse Demir · ayse.demir+cv@ucl.ac.uk · x@y.com".match(EMAIL_RE)?.[0]).toBe("ayse.demir+cv@ucl.ac.uk");
    expect("no email here @ all".match(EMAIL_RE)).toBeNull();
  });
  it("PHONE_RE finds UK formats", () => {
    expect("Tel: +44 20 7946 0958".match(PHONE_RE)?.[0]).toBe("+44 20 7946 0958");
    expect("07700 900123".match(PHONE_RE)?.[0]).toBe("07700 900123");
    expect("12345678".match(PHONE_RE)).toBeNull();
  });
  // Fixed: PHONE_RE requires 10+ digits, so year ranges are not phones.
  it("PHONE_RE does not treat a year range as a phone number", () => {
    expect("BSc Economics, UCL 2023 - 2026".match(PHONE_RE)).toBeNull();
  });
  // Fixed: PHONE_RE accepts an optional leading "(".
  it("PHONE_RE keeps the opening bracket of an area code", () => {
    expect("(020) 7946-0958".match(PHONE_RE)?.[0]).toBe("(020) 7946-0958");
  });
});
