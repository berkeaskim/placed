import { describe, it, expect, vi } from "vitest";
import { ingestCompany, type IngestStore, type JobRow } from "@/lib/ingest/run";
import type { RawJob } from "@/lib/types";
import { heuristicTagJob } from "@/lib/ai/heuristics";

const company = { id: 1, slug: "acme", name: "Acme", ats: "lever" as const, api_host: null, enabled: true };
const raw = (over: Partial<RawJob>): RawJob => ({
  extId: "1", title: "Data Analyst Intern", url: "https://jobs.lever.co/acme/1?utm_source=x", location: "London",
  remote: false, html: "<h3>Requirements</h3><ul><li>SQL</li></ul>", postedAt: null, ...over,
});

function fakeStore(existing = new Map<string, { content_hash: string | null; tag_status: string }>()) {
  const upserted: JobRow[] = [];
  const store: IngestStore = {
    existing: async () => existing,
    upsert: async (rows) => { upserted.push(...rows); },
    touch: vi.fn(async () => {}),
    markDead: vi.fn(async () => 2),
  };
  return { store, upserted };
}

describe("ingestCompany", () => {
  it("filters non-early-career and non-UK jobs, keeps and flags cohort clashes, tags and upserts the rest", async () => {
    const { store, upserted } = fakeStore();
    const tag = vi.fn(async (i: { title: string; textLines: string[] }) => heuristicTagJob(i));
    const r = await ingestCompany(company, {
      fetchJobs: async () => [
        raw({ extId: "1" }),
        raw({ extId: "2", title: "Senior Data Engineer" }),
        raw({ extId: "3", location: "San Francisco, CA" }),
        raw({ extId: "4", title: "SWE Intern (Winter 2027)" }),
      ],
      tagJob: tag, store,
    });
    expect(r.fetched).toBe(4);
    expect(r.kept).toBe(2);
    expect(tag).toHaveBeenCalledTimes(2);
    expect(upserted[0].url).toBe("https://jobs.lever.co/acme/1");
    expect(upserted[0].requirements[0].skill).toBe("SQL");
    expect(store.markDead).toHaveBeenCalledWith(1, ["1", "4"]);
    expect(upserted.find((u) => u.ext_id === "4")?.cohort_clash).toBe(true);
    expect(upserted.find((u) => u.ext_id === "1")?.cohort_clash).toBe(false);
  });

  it("does not re-tag unchanged jobs that were tagged ok", async () => {
    const { contentHash } = await import("@/lib/ingest/fingerprint");
    const { htmlToLines } = await import("@/lib/text/jd");
    const job = raw({});
    const hash = contentHash(job.title + "\n" + htmlToLines(job.html).join("\n"));
    const { store } = fakeStore(new Map([["1", { content_hash: hash, tag_status: "ok" }]]));
    const tag = vi.fn();
    const r = await ingestCompany(company, { fetchJobs: async () => [job], tagJob: tag as never, store });
    expect(tag).not.toHaveBeenCalled();
    expect(store.touch).toHaveBeenCalledWith(1, ["1"]);
    expect(r.tagged).toBe(0);
  });

  it("does not mark jobs dead when the fetch fails", async () => {
    const { store } = fakeStore();
    await expect(ingestCompany(company, { fetchJobs: async () => { throw new Error("HTTP 500"); }, tagJob: vi.fn() as never, store })).rejects.toThrow();
    expect(store.markDead).not.toHaveBeenCalled();
  });
});
