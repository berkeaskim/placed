import { ATS_VALUES, TRANSPORT_VALUES, type AtsKind, type companies } from "@/lib/db/schema";

export type NewCompany = typeof companies.$inferInsert;

type SeedRow = { slug?: unknown; name?: unknown; ats?: unknown; apiHost?: unknown; employer?: unknown; transport?: unknown; enabled?: unknown };

const str = (v: unknown) => (typeof v === "string" && v ? v : null);

/** Maps parsed seed/companies.yml rows to company inserts. Rows with an unknown ats are dropped; an unknown transport becomes null. */
export function seedCompanyRows(yml: unknown[]): NewCompany[] {
  const out: NewCompany[] = [];
  for (const raw of yml) {
    const r = (raw ?? {}) as SeedRow;
    if (typeof r.slug !== "string" || typeof r.name !== "string") continue;
    if (!(ATS_VALUES as readonly unknown[]).includes(r.ats)) continue;
    const transport = (TRANSPORT_VALUES as readonly unknown[]).includes(r.transport) ? (r.transport as (typeof TRANSPORT_VALUES)[number]) : null;
    out.push({ slug: r.slug, name: r.name, ats: r.ats as AtsKind, api_host: str(r.apiHost), employer: str(r.employer), transport, enabled: r.enabled !== false });
  }
  return out;
}
