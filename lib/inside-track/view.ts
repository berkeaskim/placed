import type { Person } from "./parse";
import { GROUPS, type Found, type Group } from "./types";

export type Card = Person & { group: Group; draft: string | null; outreachId: string | null; status: string | null };
type Row = { id: string; target: string; recipient_name: string | null; body: string; status: string };

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? "";
/** A stored body is `<connection note>\n\n<coffee chat>`; the card shows the note. */
export const noteOf = (body: string) => body.split("\n\n")[0] ?? body;

/** People in group order, each with the newest stored draft for the same group and full name (rows arrive newest first). */
export function toCards(found: Found, rows: Row[]): Card[] {
  return GROUPS.flatMap((group) => found.groups[group].map((p) => {
    const row = rows.find((r) => r.target === group && r.recipient_name === p.name);
    return { ...p, group, draft: row ? noteOf(row.body) : null, outreachId: row?.id ?? null, status: row?.status ?? null };
  }));
}
