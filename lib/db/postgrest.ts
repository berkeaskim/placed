/**
 * The one sanctioned way to put values into a PostgREST filter string (.not(col, "in", ...) has no argument form).
 * Each value is double-quoted with `\` and `"` backslash-escaped, so a value like `a"),id.neq.(x` stays one literal
 * instead of rewriting the filter. The no-restricted-syntax lint rule blocks hand-built filter strings everywhere else.
 */
export function pgInList(values: readonly string[]): string {
  return `(${values.map((v) => `"${v.replace(/[\\"]/g, (c) => `\\${c}`)}"`).join(",")})`;
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
/** Guards a YYYY-MM-DD value before it is used in an .or() filter. */
export function isoDay(v: string): string {
  if (!ISO_DAY.test(v)) throw new Error("expected a YYYY-MM-DD date");
  return v;
}
