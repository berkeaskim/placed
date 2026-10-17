import { generateStructured, runAi } from "./provider";
import { SYSTEM_DISCOVER_COMPANIES } from "./prompts";
import { DiscoverCompaniesOutput, type DiscoverCompaniesOutputT } from "./schemas";

export type CompanySuggestion = DiscoverCompaniesOutputT["companies"][number];
export type DiscoverInput = { areas: string[]; regions: string[]; year: string | null; known: string[]; count?: number };

/** Employers the student isn't watching yet, with the AI's best guess at their ATS board. Unverified: see lib/ingest/discover.ts. */
export async function discoverCompanies(input: DiscoverInput): Promise<CompanySuggestion[]> {
  const count = input.count ?? 20;
  const prompt = [
    `Areas: ${input.areas.join(", ") || "any early-careers area"}`,
    `Where: ${input.regions.join(", ") || "London / anywhere in the UK"}`,
    input.year ? `Year of study: ${input.year}` : null,
    `Already watched (do not suggest): ${input.known.join(", ")}`,
    `Suggest ${count} employers.`,
  ].filter(Boolean).join("\n");
  return runAi({
    fn: "discoverCompanies",
    schema: DiscoverCompaniesOutput,
    fromFixture: (o) => o.companies,
    live: async () => (await generateStructured({
      tier: "smart",
      system: SYSTEM_DISCOVER_COMPANIES,
      parts: [{ type: "text", text: prompt }],
      schema: DiscoverCompaniesOutput,
      maxTokens: 6000,
      background: true,
    })).companies.slice(0, count),
    fallback: () => [],
  });
}
