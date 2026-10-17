/** "title · org" for a bank entry, dropping the separator when either part is empty. Empty when both are. */
export function entryLabel(e: { title?: string | null; org?: string | null }): string {
  return [e.title, e.org].map((s) => (s ?? "").trim()).filter(Boolean).join(" · ");
}
