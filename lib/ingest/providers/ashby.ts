import type { RawJob } from "@/lib/types";

type AshbyJob = {
  id: string; title: string; jobUrl: string; location?: string; isRemote?: boolean; workplaceType?: string;
  secondaryLocations?: { location?: string }[]; descriptionHtml?: string; publishedAt?: string; isListed?: boolean;
};

export function normalizeAshby(json: unknown): RawJob[] {
  const jobs = (json as { jobs?: AshbyJob[] } | null)?.jobs;
  if (!Array.isArray(jobs)) return [];
  return jobs.filter((j) => j && j.isListed !== false && j.id && j.title && j.jobUrl).map((j) => {
    const locs = [j.location ?? "", ...(j.secondaryLocations ?? []).map((s) => s.location ?? "")].filter(Boolean);
    return {
      extId: j.id,
      title: j.title,
      url: j.jobUrl,
      location: locs.join("; "),
      remote: Boolean(j.isRemote) || j.workplaceType === "Remote",
      html: j.descriptionHtml ?? "",
      postedAt: j.publishedAt ?? null,
    };
  });
}
