import type { RawJob } from "@/lib/types";

type GhJob = { id: number; title: string; absolute_url: string; location?: { name?: string }; content?: string; first_published?: string; updated_at?: string };

// slug/host kept for a uniform provider signature; unused by the current payload shape.
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
export function normalizeGreenhouse(json: unknown, _slug: string, _host?: string): RawJob[] {
  const jobs = (json as { jobs?: GhJob[] } | null)?.jobs;
  if (!Array.isArray(jobs)) return [];
  return jobs.map((j) => {
    const location = j.location?.name ?? "";
    return {
      extId: String(j.id),
      title: j.title,
      url: j.absolute_url,
      location,
      remote: /remote/i.test(location),
      html: j.content ?? "",
      postedAt: j.first_published ?? j.updated_at ?? null,
    };
  });
}
