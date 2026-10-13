import type { RawJob } from "@/lib/types";

type LeverJob = {
  id: string; text: string; hostedUrl: string; createdAt?: number; workplaceType?: string;
  categories?: { location?: string; allLocations?: string[] };
  description?: string; lists?: { text: string; content: string }[]; additional?: string;
};

export function normalizeLever(json: unknown): RawJob[] {
  if (!Array.isArray(json)) return [];
  return (json as LeverJob[]).map((j) => {
    const location = j.categories?.allLocations?.join("; ") || j.categories?.location || "";
    const lists = (j.lists ?? []).map((l) => `<h3>${l.text}</h3><ul>${l.content}</ul>`).join("");
    return {
      extId: j.id,
      title: j.text,
      url: j.hostedUrl,
      location,
      remote: j.workplaceType === "remote" || /remote/i.test(location),
      html: `${j.description ?? ""}${lists}${j.additional ?? ""}`,
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
    };
  });
}
