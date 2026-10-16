/** Pure (no database): safe to import from client components. */
/** Common names students and LinkedIn use for big UK universities; anything else falls back to its own name. */
const SHORT: [RegExp, string][] = [
  [/^university college london$/i, "UCL"],
  [/^london school of economics/i, "LSE"],
  [/^imperial college/i, "Imperial"],
  [/^king'?s college london$/i, "KCL"],
  [/^(the )?university of oxford$/i, "Oxford"],
  [/^(the )?university of cambridge$/i, "Cambridge"],
  [/^queen mary/i, "QMUL"],
  [/^(the )?university of warwick$/i, "Warwick"],
  [/^(the )?university of edinburgh$/i, "Edinburgh"],
  [/^(the )?university of manchester$/i, "Manchester"],
];

/** A label short enough for chips and buttons: "UCL", "LSE", "Bristol" ("University of Bristol"), else the name itself. */
export function shortSchool(name: string): string {
  const n = name.replace(/\s+/g, " ").trim();
  for (const [re, short] of SHORT) if (re.test(n)) return short;
  const of = n.match(/^(?:the )?university of (.+)$/i);
  return of ? of[1] : n;
}
