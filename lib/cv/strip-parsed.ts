const ZW = /[\u200B-\u200D\u2060\uFEFF\u202A-\u202E\u2066-\u2069]/g;
const norm = (s: string) => s.replace(ZW, "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Defence in depth: removes anything in a parsed CV that contains a flagged safety span.
 * Walks every string field. Array items (strings, or objects with a flagged string field such as a bullet's text) are dropped;
 * a scalar string field containing one is set to null. Spans under 4 chars are ignored.
 */
export function dropFlaggedContent<T>(cv: T, spans: string[]): T {
  const needles = [...new Set(spans.map(norm).filter((s) => s.length >= 4))];
  if (!needles.length) return cv;
  const bad = (s: string) => { const n = norm(s); return needles.some((x) => n.includes(x)); };
  const dirty = (v: unknown): boolean =>
    typeof v === "string" ? bad(v) : v && typeof v === "object" && !Array.isArray(v)
      ? Object.entries(v as Record<string, unknown>).some(([k, x]) => k !== "id" && typeof x === "string" && bad(x))
      : false;
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.filter((x) => !dirty(x)).map(walk);
    if (v && typeof v === "object") {
      return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) =>
        [k, typeof x === "string" ? (k !== "id" && bad(x) ? null : x) : walk(x)]));
    }
    return v;
  };
  return walk(cv) as T;
}
