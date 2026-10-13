const ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ",
  "&rsquo;": "'", "&lsquo;": "'", "&ldquo;": '"', "&rdquo;": '"', "&ndash;": "–", "&mdash;": "—", "&hellip;": "…",
};

function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (match, n) => {
      try {
        const codePoint = Number(n);
        return String.fromCodePoint(codePoint);
      } catch {
        return match;
      }
    })
    .replace(/&#x([0-9a-f]+);/gi, (match, n) => {
      try {
        const codePoint = parseInt(n, 16);
        return String.fromCodePoint(codePoint);
      } catch {
        return match;
      }
    })
    .replace(/&[a-z]+;|&#39;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

export function htmlToLines(html: string): string[] {
  let s = html;
  // Greenhouse returns HTML-escaped HTML; decode until no escaped tags remain (max 2 passes)
  for (let i = 0; i < 2 && /&lt;\/?[a-z]/i.test(s); i++) s = decodeEntities(s);
  s = s
    .replace(/<\s*(script|style)[^>]*>[\s\S]*?<\/\s*\1\s*>/gi, "")
    .replace(/<\s*h[1-6][^>]*>/gi, "\n## ")
    .replace(/<\s*li[^>]*>/gi, "\n- ")
    .replace(/<\s*br\s*\/?>/gi, "\n")
    .replace(/<\/\s*(p|div|h[1-6]|li|ul|ol|tr|section)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  return s
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0 && l !== "-" && l !== "##");
}

export type TaggedLine = { text: string; isHeader: boolean; section: "must" | "nice" | "other" };

const NICE_HEADER = /(preferred|nice[\s-]to[\s-]have|bonus|\bplus\b|it would be great|desirable|ideally|good to have)/i;
const MUST_HEADER = /(required|requirements|qualifications|must[\s-]have|you'?ll (have|need|bring)|what we('?re| are) looking for|who we('?re| are) looking for|who you are|minimum|essential|about you|what you'?ll need|what you bring|your profile|skills( and| ?&) experience|you have)/i;
const NICE_HEADER_START = /^(preferred|nice[\s-]to[\s-]have|bonus|desirable|good to have)\b/i;
const MUST_HEADER_START = /^(requirements|minimum[\s-]requirements|qualifications|what we('?re| are) looking for|you'?ll (have|need|bring)|about you|essential|must[\s-]have)\b/i;
const NICE_BULLET = /\((preferred|a plus|bonus|desirable)\)|\ba plus\b|\bideally\b|\bdesirable\b|\bbonus\b|\bnice to have\b/i;
const MUST_BULLET = /\bmust\b|\brequired\b|\bessential\b/i;

function isHeaderLine(line: string): boolean {
  if (line.startsWith("## ")) return true;
  if (line.startsWith("- ")) return false;
  // A non-"## " line is a header only if it ends with ":" or starts with a must/nice header phrase
  return /:$/.test(line) || MUST_HEADER_START.test(line) || NICE_HEADER_START.test(line);
}

export function tagSections(lines: string[]): TaggedLine[] {
  let current: TaggedLine["section"] = "other";
  return lines.map((text) => {
    if (isHeaderLine(text)) {
      const h = text.replace(/^## /, "");
      current = NICE_HEADER.test(h) ? "nice" : MUST_HEADER.test(h) ? "must" : "other";
      return { text, isHeader: true, section: current };
    }
    let section = current;
    if (current !== "other") {
      if (NICE_BULLET.test(text)) section = "nice";
      else if (MUST_BULLET.test(text)) section = "must";
    }
    return { text, isHeader: false, section };
  });
}
