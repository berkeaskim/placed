/** True only when the typed value is exactly "DELETE" (case-sensitive, surrounding whitespace ignored). */
export function isDeleteConfirmed(value: unknown): boolean {
  return typeof value === "string" && value.trim() === "DELETE";
}
